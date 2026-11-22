import { gql } from 'graphql-tag';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createPluginTestEnvironment, initialData, TEST_SETUP_TIMEOUT_MS } from '../../../deploy/e2e/test-environment';
import { CrmPlugin } from '../crm.plugin';

import {
    ADD_CUSTOMERS_TO_GROUP,
    Commercial,
    COMMERCIAL_PASSWORD,
    CREATE_CUSTOMER_GROUP,
    createCommercialFactory,
    createCustomer,
} from './helpers';

const ADD_PARENT = gql`
    mutation AddParent($childId: ID!, $parentId: ID!) {
        addCustomerGroupParent(childId: $childId, parentId: $parentId) {
            id
            crmParents { id }
        }
    }
`;

const REMOVE_PARENT = gql`
    mutation RemoveParent($childId: ID!, $parentId: ID!) {
        removeCustomerGroupParent(childId: $childId, parentId: $parentId) {
            id
            crmParents { id }
        }
    }
`;

const GROUP_HIERARCHY = gql`
    query GroupHierarchy($id: ID!) {
        customerGroup(id: $id) {
            id
            crmParents { id }
            crmChildren { id }
            crmAncestors { id }
            crmBreadcrumb { id name }
        }
    }
`;

const DELETE_GROUP = gql`
    mutation DeleteGroup($id: ID!) {
        deleteCustomerGroup(id: $id) { result }
    }
`;

const TREE = gql`
    query {
        crmGroupTree { group { id } parentIds }
    }
`;

const MOVE = gql`
    mutation Move($customerId: ID!, $companyId: ID!) {
        moveCustomerToCompany(customerId: $customerId, companyId: $companyId) {
            id
            groups { id }
        }
    }
`;

const ELIGIBLE = gql`
    query Eligible($customerId: ID!) {
        crmEligibleGroups(customerId: $customerId) { id }
    }
`;

const UPDATE_GROUP = gql`
    mutation UpdateGroup($input: UpdateCustomerGroupInput!) {
        updateCustomerGroup(input: $input) { id }
    }
`;

describe('CrmPlugin — hierarchy and membership UI rules (G1-G6, R3 move, R4)', () => {
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

    async function group(name: string, groupType: string): Promise<string> {
        await adminClient.asSuperAdmin();
        const { createCustomerGroup } = await adminClient.query(CREATE_CUSTOMER_GROUP, {
            input: { name, customFields: { groupType } },
        });
        return createCustomerGroup.id;
    }
    const link = (childId: string, parentId: string) => adminClient.query(ADD_PARENT, { childId, parentId });
    const ids = (items: Array<{ id: string }>) => items.map(item => item.id).sort();

    it('links a company to its group and a portfolio, and navigates both ways (G1, G2, G4)', async () => {
        const menata = await group('MENATA', 'companyGroup');
        const portfolio = await group('Portefeuille', 'portfolio');
        const colmar = await group('MENATA-Colmar', 'company');
        await link(colmar, menata);
        const { addCustomerGroupParent } = await link(colmar, portfolio);

        expect(ids(addCustomerGroupParent.crmParents)).toEqual([menata, portfolio].sort());
        const { customerGroup } = await adminClient.query(GROUP_HIERARCHY, { id: menata });
        expect(ids(customerGroup.crmChildren)).toEqual([colmar]);
        const { crmGroupTree } = await adminClient.query(TREE);
        expect(crmGroupTree.find((entry: any) => entry.group.id === colmar).parentIds.sort()).toEqual([menata, portfolio].sort());
    });

    it('refuses self links and loops of two and three groups (G3)', async () => {
        const a = await group('A', 'companyGroup');
        const b = await group('B', 'companyGroup');
        const c = await group('C', 'companyGroup');
        await link(b, a);
        await link(c, b);

        await expect(link(a, a)).rejects.toThrow(/own parent/i);
        await expect(link(a, b)).rejects.toThrow(/loop/i);
        await expect(link(a, c)).rejects.toThrow(/loop/i);
    });

    it('accepts 5 levels and refuses a 6th (G5)', async () => {
        const levels = [];
        for (let i = 1; i <= 6; i++) {
            levels.push(await group(`Level ${i}`, i === 6 ? 'company' : 'companyGroup'));
        }
        for (let i = 1; i <= 4; i++) {
            await link(levels[i], levels[i - 1]);
        }
        const { customerGroup } = await adminClient.query(GROUP_HIERARCHY, { id: levels[4] });
        expect(customerGroup.crmBreadcrumb.map((g: any) => g.name)).toEqual(['Level 1', 'Level 2', 'Level 3', 'Level 4']);
        expect(ids(customerGroup.crmAncestors)).toEqual(levels.slice(0, 4).sort());

        await expect(link(levels[5], levels[4])).rejects.toThrow(/5 levels/i);
    });

    it('refuses a parent that only accepts customers (R1)', async () => {
        const company = await group('Customers only parent', 'company');
        const child = await group('Would-be child', 'company');

        await expect(link(child, company)).rejects.toThrow(/only accepts customers/i);
    });

    it('keeps the hierarchy super admin only', async () => {
        const parent = await group('Admin parent', 'companyGroup');
        const child = await group('Admin child', 'company');
        await adminClient.asUserWithCredentials(commercial.username, COMMERCIAL_PASSWORD);

        await expect(link(child, parent)).rejects.toThrow();
    });

    it('orphans the children when a parent is deleted (G6)', async () => {
        const parent = await group('Parent to delete', 'companyGroup');
        const child = await group('Orphan to be', 'company');
        await link(child, parent);

        await adminClient.query(DELETE_GROUP, { id: parent });
        const { customerGroup } = await adminClient.query(GROUP_HIERARCHY, { id: child });

        expect(customerGroup.crmParents).toEqual([]);
    });

    it('unlinks a parent', async () => {
        const parent = await group('Unlink parent', 'companyGroup');
        const child = await group('Unlink child', 'company');
        await link(child, parent);

        const { removeCustomerGroupParent } = await adminClient.query(REMOVE_PARENT, { childId: child, parentId: parent });

        expect(removeCustomerGroupParent.crmParents).toEqual([]);
    });

    it('refuses limiting a parent to customers while it has sub-groups (R5)', async () => {
        const parent = await group('Parent with children', 'companyGroup');
        const child = await group('Its child', 'company');
        await link(child, parent);

        await expect(
            adminClient.query(UPDATE_GROUP, { input: { id: parent, customFields: { memberScope: 'customers' } } }),
        ).rejects.toThrow(/1 sub-group/i);
    });

    it('moves a customer from one company to another, as a sales rep (R3)', async () => {
        const from = await group('Move from', 'company');
        const to = await group('Move to', 'company');
        const segment = await group('Move segment', 'segment');
        const customerId = await createCustomer(adminClient, 'move@menata.test');
        await adminClient.query(ADD_CUSTOMERS_TO_GROUP, { customerGroupId: from, customerIds: [customerId] });
        await adminClient.query(ADD_CUSTOMERS_TO_GROUP, { customerGroupId: segment, customerIds: [customerId] });
        await adminClient.asUserWithCredentials(commercial.username, COMMERCIAL_PASSWORD);

        const { moveCustomerToCompany } = await adminClient.query(MOVE, { customerId, companyId: to });

        expect(ids(moveCustomerToCompany.groups)).toEqual([segment, to].sort());
        await expect(adminClient.query(MOVE, { customerId, companyId: segment })).rejects.toThrow(/not a company/i);
    });

    it('offers only the groups a customer can join (R4)', async () => {
        const current = await group('Eligible current company', 'company');
        const other = await group('Eligible other company', 'company');
        const holding = await group('Eligible holding', 'companyGroup');
        const segment = await group('Eligible segment', 'segment');
        const customerId = await createCustomer(adminClient, 'eligible@menata.test');
        await adminClient.query(ADD_CUSTOMERS_TO_GROUP, { customerGroupId: current, customerIds: [customerId] });

        const { crmEligibleGroups } = await adminClient.query(ELIGIBLE, { customerId });
        const eligible = crmEligibleGroups.map((g: any) => g.id);

        expect(eligible).toContain(segment);
        expect(eligible).not.toContain(current);
        expect(eligible).not.toContain(other);
        expect(eligible).not.toContain(holding);
    });
});
