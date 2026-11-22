import { Channel, Customer, TransactionalConnection } from '@vendure/core';
import { gql } from 'graphql-tag';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createPluginTestEnvironment, initialData, TEST_SETUP_TIMEOUT_MS } from '../../../deploy/e2e/test-environment';
import { CrmPlugin } from '../crm.plugin';

import { ADD_CUSTOMERS_TO_GROUP, ADD_NOTE_TO_CUSTOMER, Commercial, COMMERCIAL_PASSWORD, CREATE_CUSTOMER_GROUP, createAdminWithPermissions, createCommercialFactory } from './helpers';
import { createDraft, createTestVariant, payDraft } from './order-helpers';

const CREATE_CUSTOMER = gql`
    mutation Create($input: CreateCustomerInput!) { createCustomer(input: $input) { ... on Customer { id crmCode } } }
`;
const SEARCH = gql`
    query Search($term: String!) {
        crmSearch(term: $term) { customers { id crmCode emailAddress } groups { id crmCode name } }
    }
`;
const RESOLVE = gql`
    query Resolve($code: String!) { crmResolveCode(code: $code) { kind id } }
`;
const SUGGEST = gql`
    query Suggest($customerId: ID!) { crmCompanySuggestions(customerId: $customerId) { id name } }
`;
const BY_EMAIL = gql`
    query ByEmail($email: String!) { crmCustomerByEmail(email: $email) { id crmCode } }
`;
const DUPLICATES = gql`
    query { crmDuplicateEmails { email customers { id } } }
`;
const CONFLICTS = gql`
    query { crmCompanyConflicts { customer { id } companies { name } } }
`;
const MERGE = gql`
    mutation Merge($sourceId: ID!, $targetId: ID!) {
        mergeCustomers(sourceId: $sourceId, targetId: $targetId) {
            id groups { name } orders { totalItems } history { items { type data } }
            addresses { id defaultShippingAddress defaultBillingAddress }
        }
    }
`;
const CREATE_ADDRESS = gql`
    mutation CreateAddress($id: ID!, $input: CreateAddressInput!) { createCustomerAddress(customerId: $id, input: $input) { id } }
`;
const CUSTOMER = gql`
    query Customer($id: ID!) { customer(id: $id) { id } }
`;

describe('CrmPlugin — search, suggestions, duplicates, merge (S1, I3, C2, D2, D3)', () => {
    const { server, adminClient } = createPluginTestEnvironment({ plugins: [CrmPlugin] });
    let commercial: Commercial;

    beforeAll(async () => {
        await server.init({ initialData, customerCount: 0 });
        await adminClient.asSuperAdmin();
        commercial = await (await createCommercialFactory(adminClient))('Alexandre', 'Martin');
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    async function customer(emailAddress: string, firstName: string, lastName: string, customFields: Record<string, unknown> = {}) {
        await adminClient.asSuperAdmin();
        const { createCustomer } = await adminClient.query(CREATE_CUSTOMER, { input: { emailAddress, firstName, lastName, customFields } });
        return createCustomer as { id: string; crmCode: string };
    }
    async function company(name: string, groupType = 'company') {
        await adminClient.asSuperAdmin();
        const { createCustomerGroup } = await adminClient.query(CREATE_CUSTOMER_GROUP, { input: { name, customFields: { groupType } } });
        return createCustomerGroup.id as string;
    }

    it('finds customers and groups by name, e-mail or code, for a sales rep (S1, I3)', async () => {
        const claire = await customer('claire@menata-colmar.test', 'Claire', 'Martin');
        const groupId = await company('Recherche Colmar');
        await adminClient.asUserWithCredentials(commercial.username, COMMERCIAL_PASSWORD);

        expect((await adminClient.query(SEARCH, { term: 'marti' })).crmSearch.customers.map((c: any) => c.id)).toContain(claire.id);
        expect((await adminClient.query(SEARCH, { term: 'claire mart' })).crmSearch.customers.map((c: any) => c.id)).toEqual([claire.id]);
        expect((await adminClient.query(SEARCH, { term: 'claire dupont' })).crmSearch.customers).toEqual([]);
        expect((await adminClient.query(SEARCH, { term: 'MENATA-COLMAR' })).crmSearch.customers.map((c: any) => c.id)).toContain(claire.id);
        expect((await adminClient.query(SEARCH, { term: 'recherche' })).crmSearch.groups.map((g: any) => g.id)).toEqual([groupId]);
        const byCode = (await adminClient.query(SEARCH, { term: claire.crmCode.toLowerCase() })).crmSearch;
        expect(byCode.customers.map((c: any) => c.id)).toEqual([claire.id]);

        expect((await adminClient.query(RESOLVE, { code: claire.crmCode })).crmResolveCode).toEqual({ kind: 'customer', id: claire.id });
        expect((await adminClient.query(RESOLVE, { code: 'GRP-999999' })).crmResolveCode).toBeNull();
    });

    it('never returns customers to a role that may only read groups, nor anything for wildcards', async () => {
        await customer('perm@menata.test', 'Permission', 'Probe');
        await company('Permission group');
        await adminClient.asSuperAdmin();
        const username = await createAdminWithPermissions(adminClient, 'groups-only', ['ReadCustomerGroup']);
        await adminClient.asUserWithCredentials(username, COMMERCIAL_PASSWORD);

        const { crmSearch } = await adminClient.query(SEARCH, { term: 'permission' });
        expect(crmSearch.customers).toEqual([]);
        expect(crmSearch.groups.map((g: any) => g.name)).toEqual(['Permission group']);
        await adminClient.asSuperAdmin();
        expect((await adminClient.query(SEARCH, { term: '%%' })).crmSearch).toEqual({ customers: [], groups: [] });
        expect((await adminClient.query(SEARCH, { term: '__ _' })).crmSearch).toEqual({ customers: [], groups: [] });
    });

    it('suggests a company from the stated company or the e-mail domain, only by click (C2)', async () => {
        const target = await company('Safran Munich');
        await company('Autre société');
        const byHint = await customer('jb@gmail.test', 'Julia', 'Bauer', { companyNameHint: 'safran munich gmbh' });
        const byDomain = await customer('anna@safran-munich.test', 'Anna', 'Weber');

        expect((await adminClient.query(SUGGEST, { customerId: byHint.id })).crmCompanySuggestions.map((g: any) => g.id)).toEqual([target]);
        expect((await adminClient.query(SUGGEST, { customerId: byDomain.id })).crmCompanySuggestions.map((g: any) => g.id)).toEqual([target]);
        await adminClient.query(ADD_CUSTOMERS_TO_GROUP, { customerGroupId: target, customerIds: [byHint.id] });
        expect((await adminClient.query(SUGGEST, { customerId: byHint.id })).crmCompanySuggestions).toEqual([]);
    });

    it('finds an existing customer from an e-mail typed with other case or spaces (D2)', async () => {
        const existing = await customer('dupe@menata.test', 'Dupe', 'One');
        await adminClient.asUserWithCredentials(commercial.username, COMMERCIAL_PASSWORD);

        expect((await adminClient.query(BY_EMAIL, { email: '  DUPE@Menata.test ' })).crmCustomerByEmail).toMatchObject({ id: existing.id });
        expect((await adminClient.query(BY_EMAIL, { email: 'nobody@menata.test' })).crmCustomerByEmail).toBeNull();
    });

    it('audits duplicate e-mails and customers in several companies, super admin only', async () => {
        const original = await customer('legacy@menata.test', 'Legacy', 'One');
        const repository = server.app.get(TransactionalConnection).rawConnection.getRepository(Customer);
        const defaultChannel = await server.app.get(TransactionalConnection).rawConnection.getRepository(Channel).findOneOrFail({ where: {} });
        await repository.save(new Customer({ emailAddress: 'Legacy@Menata.test ', firstName: 'Legacy', lastName: 'Two', channels: [defaultChannel] }));
        const a = await company('Conflict A');
        const b = await company('Conflict B');
        const both = await customer('both@menata.test', 'Both', 'Companies');
        const join = server.app.get(TransactionalConnection).rawConnection;
        for (const groupId of [a, b]) {
            await join.createQueryBuilder().relation(Customer, 'groups').of(both.id.replace('T_', '')).add(groupId.replace('T_', ''));
        }

        const { crmDuplicateEmails } = await adminClient.query(DUPLICATES);
        const legacy = crmDuplicateEmails.find((d: any) => d.email === 'legacy@menata.test');
        expect(legacy.customers.map((c: any) => c.id)).toContain(original.id);
        expect(legacy.customers).toHaveLength(2);
        const { crmCompanyConflicts } = await adminClient.query(CONFLICTS);
        expect(crmCompanyConflicts.find((c: any) => c.customer.id === both.id).companies.map((g: any) => g.name).sort()).toEqual(['Conflict A', 'Conflict B']);

        await adminClient.asUserWithCredentials(commercial.username, COMMERCIAL_PASSWORD);
        await expect(adminClient.query(DUPLICATES)).rejects.toThrow();
    });

    it('merges a duplicate into the kept customer with orders, notes and groups (D3)', async () => {
        await adminClient.asSuperAdmin();
        const variantId = await createTestVariant(adminClient);
        const companyId = await company('Merge company');
        const segmentId = await company('Merge segment', 'segment');
        const kept = await customer('kept@menata.test', 'Kept', 'Customer');
        const dupe = await customer('kept.old@menata.test', 'Kept', 'Old');
        await adminClient.query(ADD_CUSTOMERS_TO_GROUP, { customerGroupId: companyId, customerIds: [dupe.id] });
        await adminClient.query(ADD_CUSTOMERS_TO_GROUP, { customerGroupId: segmentId, customerIds: [dupe.id] });
        await adminClient.query(ADD_NOTE_TO_CUSTOMER, { input: { id: dupe.id, note: 'Note sur le doublon', isPublic: false } });
        for (const id of [kept.id, dupe.id]) {
            await adminClient.query(CREATE_ADDRESS, { id, input: { streetLine1: `1 rue ${id}`, countryCode: 'FR', defaultShippingAddress: true, defaultBillingAddress: true } });
        }
        await payDraft(adminClient, await createDraft(adminClient, dupe.id, variantId));

        await adminClient.asUserWithCredentials(commercial.username, COMMERCIAL_PASSWORD);
        await expect(adminClient.query(MERGE, { sourceId: dupe.id, targetId: kept.id })).rejects.toThrow();
        await adminClient.asSuperAdmin();
        const { mergeCustomers } = await adminClient.query(MERGE, { sourceId: dupe.id, targetId: kept.id });

        expect(mergeCustomers.groups.map((g: any) => g.name).sort()).toEqual(['Merge company', 'Merge segment']);
        expect(mergeCustomers.orders.totalItems).toBe(1);
        expect(mergeCustomers.addresses).toHaveLength(2);
        expect(mergeCustomers.addresses.filter((a: any) => a.defaultShippingAddress)).toHaveLength(1);
        expect(mergeCustomers.addresses.filter((a: any) => a.defaultBillingAddress)).toHaveLength(1);
        const types = mergeCustomers.history.items.map((i: any) => i.type);
        expect(types).toEqual(expect.arrayContaining(['CUSTOMER_NOTE', 'CUSTOMER_MERGED']));
        expect((await adminClient.query(CUSTOMER, { id: dupe.id })).customer).toBeNull();
        await expect(adminClient.query(MERGE, { sourceId: kept.id, targetId: kept.id })).rejects.toThrow(/itself/i);
    });

    it('refuses to merge customers of two different companies (D3 + R3)', async () => {
        const a = await company('Merge conflict A');
        const b = await company('Merge conflict B');
        const first = await customer('m1@menata.test', 'M', 'One');
        const second = await customer('m2@menata.test', 'M', 'Two');
        await adminClient.query(ADD_CUSTOMERS_TO_GROUP, { customerGroupId: a, customerIds: [first.id] });
        await adminClient.query(ADD_CUSTOMERS_TO_GROUP, { customerGroupId: b, customerIds: [second.id] });

        await expect(adminClient.query(MERGE, { sourceId: first.id, targetId: second.id })).rejects.toThrow(/different companies/i);
    });
});
