import { gql } from 'graphql-tag';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createPluginTestEnvironment, initialData, TEST_SETUP_TIMEOUT_MS } from '../../../deploy/e2e/test-environment';
import { CrmPlugin } from '../crm.plugin';

import { ADD_CUSTOMERS_TO_GROUP, CREATE_CUSTOMER_GROUP, createCustomer } from './helpers';

const ADDRESS_FIELDS = 'id kind label fullName company streetLine1 city postalCode countryCode defaultShipping defaultBilling';
const CREATE_ADDRESS = gql`
    mutation Create($groupId: ID!, $input: CrmGroupAddressInput!) {
        createCustomerGroupAddress(groupId: $groupId, input: $input) { ${ADDRESS_FIELDS} }
    }
`;
const UPDATE_ADDRESS = gql`
    mutation Update($id: ID!, $input: CrmGroupAddressInput!) {
        updateCustomerGroupAddress(id: $id, input: $input) { ${ADDRESS_FIELDS} }
    }
`;
const DELETE_ADDRESS = gql`
    mutation Delete($id: ID!) { deleteCustomerGroupAddress(id: $id) { result } }
`;
const LIST = gql`
    query List($groupId: ID!) { customerGroupAddresses(groupId: $groupId) { ${ADDRESS_FIELDS} } }
`;
const SUGGESTIONS = gql`
    query Suggestions($customerId: ID!) {
        crmAddressSuggestions(customerId: $customerId) { source groupName address { streetLine1 } }
    }
`;
const ADD_PARENT = gql`
    mutation AddParent($childId: ID!, $parentId: ID!) { addCustomerGroupParent(childId: $childId, parentId: $parentId) { id } }
`;
const CREATE_DRAFT = gql`
    mutation { createDraftOrder { id } }
`;
const SET_DRAFT_COMPANY = gql`
    mutation SetDraftCompany($orderId: ID!, $companyId: ID!) {
        setDraftOrderCompany(orderId: $orderId, companyId: $companyId) { id crmCompany { name } }
    }
`;
const SET_SHIPPING_ADDRESS = gql`
    mutation SetAddress($orderId: ID!, $input: CreateAddressInput!) {
        setDraftOrderShippingAddress(orderId: $orderId, input: $input) { id shippingAddress { streetLine1 } }
    }
`;
const ORDER_ADDRESS = gql`
    query OrderAddress($id: ID!) { order(id: $id) { shippingAddress { streetLine1 } } }
`;

const address = (streetLine1: string, extra: Record<string, unknown> = {}) => ({
    kind: 'shipping',
    label: streetLine1,
    fullName: 'Accueil',
    company: 'MENATA',
    streetLine1,
    city: 'Colmar',
    postalCode: '68000',
    countryCode: 'FR',
    defaultShipping: false,
    defaultBilling: false,
    ...extra,
});

describe('CrmPlugin — company addresses and ordering by company (A1-A4)', () => {
    const { server, adminClient } = createPluginTestEnvironment({ plugins: [CrmPlugin] });

    beforeAll(async () => {
        await server.init({ initialData, customerCount: 0 });
        await adminClient.asSuperAdmin();
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    async function group(name: string, groupType: string): Promise<string> {
        const { createCustomerGroup } = await adminClient.query(CREATE_CUSTOMER_GROUP, { input: { name, customFields: { groupType } } });
        return createCustomerGroup.id;
    }

    it('keeps an address book with one default per use (A1)', async () => {
        const groupId = await group('Address company', 'company');
        const { createCustomerGroupAddress: first } = await adminClient.query(CREATE_ADDRESS, {
            groupId, input: address('1 siège', { kind: 'headquarters', defaultShipping: true }),
        });
        const { createCustomerGroupAddress: second } = await adminClient.query(CREATE_ADDRESS, {
            groupId, input: address('2 dépôt', { defaultShipping: true, defaultBilling: true }),
        });

        const { customerGroupAddresses } = await adminClient.query(LIST, { groupId });
        const byId = Object.fromEntries(customerGroupAddresses.map((a: any) => [a.id, a]));
        expect(byId[first.id].defaultShipping).toBe(false);
        expect(byId[second.id]).toMatchObject({ defaultShipping: true, defaultBilling: true });

        const { updateCustomerGroupAddress } = await adminClient.query(UPDATE_ADDRESS, { id: first.id, input: address('1 bis siège', { kind: 'headquarters' }) });
        expect(updateCustomerGroupAddress.streetLine1).toBe('1 bis siège');
        await adminClient.query(DELETE_ADDRESS, { id: first.id });
        expect((await adminClient.query(LIST, { groupId })).customerGroupAddresses).toHaveLength(1);
    });

    it('refuses an unknown country', async () => {
        const groupId = await group('Country company', 'company');
        await expect(adminClient.query(CREATE_ADDRESS, { groupId, input: address('x', { countryCode: 'ZZ' }) })).rejects.toThrow(/country/i);
    });

    it('suggests the company address, then the addresses of the groups above (A3)', async () => {
        const holding = await group('Fallback holding', 'companyGroup');
        const company = await group('Fallback company', 'company');
        await adminClient.query(ADD_PARENT, { childId: company, parentId: holding });
        await adminClient.query(CREATE_ADDRESS, { groupId: company, input: address('10 rue de la filiale') });
        await adminClient.query(CREATE_ADDRESS, { groupId: holding, input: address('20 rue du groupe') });
        const customerId = await createCustomer(adminClient, 'fallback@menata.test');
        await adminClient.query(ADD_CUSTOMERS_TO_GROUP, { customerGroupId: company, customerIds: [customerId] });

        const { crmAddressSuggestions } = await adminClient.query(SUGGESTIONS, { customerId });

        expect(crmAddressSuggestions.map((s: any) => [s.source, s.groupName, s.address.streetLine1])).toEqual([
            ['company', 'Fallback company', '10 rue de la filiale'],
            ['ancestor', 'Fallback holding', '20 rue du groupe'],
        ]);
    });

    it('starts a draft from a company and keeps a frozen copy of its address (A2, A4)', async () => {
        const company = await group('Draft company', 'company');
        const segment = await group('Draft segment', 'segment');
        const { createCustomerGroupAddress } = await adminClient.query(CREATE_ADDRESS, { groupId: company, input: address('5 rue Initiale') });
        const { createDraftOrder } = await adminClient.query(CREATE_DRAFT);

        const { setDraftOrderCompany } = await adminClient.query(SET_DRAFT_COMPANY, { orderId: createDraftOrder.id, companyId: company });
        expect(setDraftOrderCompany.crmCompany.name).toBe('Draft company');
        await expect(adminClient.query(SET_DRAFT_COMPANY, { orderId: createDraftOrder.id, companyId: segment })).rejects.toThrow(/not a company/i);

        const { id, kind, label, defaultShipping, defaultBilling, ...addressInput } = createCustomerGroupAddress;
        await adminClient.query(SET_SHIPPING_ADDRESS, { orderId: createDraftOrder.id, input: addressInput });
        await adminClient.query(UPDATE_ADDRESS, { id, input: address('6 rue Modifiée') });

        const { order } = await adminClient.query(ORDER_ADDRESS, { id: createDraftOrder.id });
        expect(order.shippingAddress.streetLine1).toBe('5 rue Initiale');
    });
});
