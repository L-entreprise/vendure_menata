import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createPluginTestEnvironment, initialData, TEST_SETUP_TIMEOUT_MS } from '../../../deploy/e2e/test-environment';
import { CrmPlugin } from '../crm.plugin';

import {
    ADD_CUSTOMERS_TO_GROUP,
    Commercial,
    COMMERCIAL_PASSWORD,
    CREATE_CUSTOMER_GROUP,
    CRM_GROUP_FIELDS,
    createCommercialFactory,
    createCustomer,
} from './helpers';

/**
 * CDC R1 / R2 / R3: a group accepts customers, groups or both, and a customer belongs
 * to one company at most. The rules hold on the native Vendure mutations too, so a
 * direct API call cannot bypass them.
 */
describe('CrmPlugin — membership rules (R1, R2, R3)', () => {
    const { server, adminClient } = createPluginTestEnvironment({ plugins: [CrmPlugin] });

    let commercial: Commercial;

    beforeAll(async () => {
        await server.init({ initialData, customerCount: 0 });
        await adminClient.asSuperAdmin();
        const createCommercial = await createCommercialFactory(adminClient);
        commercial = await createCommercial('Alexandre', 'Martin');
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    async function createGroup(name: string, customFields: Record<string, string> = {}, customerIds: string[] = []) {
        await adminClient.asSuperAdmin();
        const { createCustomerGroup } = await adminClient.query(CREATE_CUSTOMER_GROUP, {
            input: { name, customFields, customerIds },
        });
        return createCustomerGroup;
    }

    it('derives the member scope from the group type when none is set (R1)', async () => {
        const company = await createGroup('MENATA-Strasbourg', { groupType: 'company' });
        const holding = await createGroup('MENATA', { groupType: 'companyGroup' });

        expect(company.customFields).toEqual({ groupType: 'company', memberScope: 'customers' });
        expect(holding.customFields).toEqual({ groupType: 'companyGroup', memberScope: 'groups' });
    });

    it('refuses a customer in a group reserved for groups (R2)', async () => {
        const portfolio = await createGroup('Portefeuille Alexandre', { groupType: 'portfolio' });
        const customerId = await createCustomer(adminClient, 'r2@menata.test');

        await expect(
            adminClient.query(ADD_CUSTOMERS_TO_GROUP, { customerGroupId: portfolio.id, customerIds: [customerId] }),
        ).rejects.toThrow(/only accepts groups/i);
    });

    it('accepts a customer in a segment (R1 default: both)', async () => {
        const segment = await createGroup('Clients industrie', { groupType: 'segment' });
        const customerId = await createCustomer(adminClient, 'segment@menata.test');

        const { addCustomersToGroup } = await adminClient.query(ADD_CUSTOMERS_TO_GROUP, {
            customerGroupId: segment.id,
            customerIds: [customerId],
        });

        expect(addCustomersToGroup.id).toBe(segment.id);
    });

    it('refuses a second company for the same customer, even for a sales rep (R3)', async () => {
        const colmar = await createGroup('MENATA-Colmar', { groupType: 'company' });
        const safran = await createGroup('Safran Munich', { groupType: 'company' });
        const customerId = await createCustomer(adminClient, 'r3@menata.test');
        await adminClient.query(ADD_CUSTOMERS_TO_GROUP, { customerGroupId: colmar.id, customerIds: [customerId] });

        await adminClient.asUserWithCredentials(commercial.username, COMMERCIAL_PASSWORD);

        await expect(
            adminClient.query(ADD_CUSTOMERS_TO_GROUP, { customerGroupId: safran.id, customerIds: [customerId] }),
        ).rejects.toThrow(/already belongs to the company "MENATA-Colmar"/i);
    });

    it('refuses to create a company with a customer who already has one (R3)', async () => {
        const first = await createGroup('Entreprise A', { groupType: 'company' });
        const customerId = await createCustomer(adminClient, 'r3-create@menata.test');
        await adminClient.query(ADD_CUSTOMERS_TO_GROUP, { customerGroupId: first.id, customerIds: [customerId] });

        await expect(createGroup('Entreprise B', { groupType: 'company' }, [customerId])).rejects.toThrow(
            /already belongs to the company "Entreprise A"/i,
        );
    });

    it('keeps groups without a CRM type unrestricted (existing data)', async () => {
        const legacy = await createGroup('Ancien groupe');
        const customerId = await createCustomer(adminClient, 'legacy@menata.test');

        const { addCustomersToGroup } = await adminClient.query(ADD_CUSTOMERS_TO_GROUP, {
            customerGroupId: legacy.id,
            customerIds: [customerId],
        });

        expect(addCustomersToGroup.id).toBe(legacy.id);
    });

    it('lets a sales rep read the CRM type and effective scope of a group', async () => {
        const company = await createGroup('Entreprise lisible', { groupType: 'company' });
        const legacy = await createGroup('Groupe sans type');
        await adminClient.asUserWithCredentials(commercial.username, COMMERCIAL_PASSWORD);

        const { customerGroups } = await adminClient.query(CRM_GROUP_FIELDS, {
            options: { filter: { id: { in: [company.id, legacy.id] } } },
        });
        const byId = Object.fromEntries(customerGroups.items.map((group: any) => [group.id, group]));

        expect(byId[company.id]).toMatchObject({ crmGroupType: 'company', crmMemberScope: 'customers' });
        expect(byId[legacy.id]).toMatchObject({ crmGroupType: null, crmMemberScope: 'both' });
    });

    it('does not let a sales rep set the group type (super admin only)', async () => {
        await adminClient.asUserWithCredentials(commercial.username, COMMERCIAL_PASSWORD);

        await expect(
            adminClient.query(CREATE_CUSTOMER_GROUP, {
                input: { name: 'Groupe du commercial', customFields: { groupType: 'company' } },
            }),
        ).rejects.toThrow();
    });
});
