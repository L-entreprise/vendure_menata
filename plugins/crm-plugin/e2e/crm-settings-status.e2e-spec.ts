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

const CRM_SETTINGS = gql`
    query {
        crmSettings {
            customerStatuses { code label }
            statusTransitions { from to }
            defaultStatus
            dormantThresholdDays
            roleOptions { code label }
            leadSourceOptions { code label }
        }
    }
`;

const UPDATE_CRM_SETTINGS = gql`
    mutation UpdateCrmSettings($input: UpdateCrmSettingsInput!) {
        updateCrmSettings(input: $input) {
            defaultStatus
            dormantThresholdDays
            statusTransitions { from to }
        }
    }
`;

const SET_CUSTOMER_STATUS = gql`
    mutation SetCustomerStatus($customerId: ID!, $status: String!) {
        setCustomerStatus(customerId: $customerId, status: $status) {
            id
            crmStatus
        }
    }
`;

const CUSTOMER_CRM = gql`
    query CustomerCrm($id: ID!) {
        customer(id: $id) {
            crmCode
            crmStatus
            customFields { companyRoles leadSource companyNameHint }
            history { items { type data } }
        }
    }
`;

const GROUP_CODE = gql`
    query GroupCode($id: ID!) {
        customerGroup(id: $id) {
            crmCode
            customFields { groupType memberScope }
        }
    }
`;

const UPDATE_CUSTOMER_GROUP = gql`
    mutation UpdateCustomerGroup($input: UpdateCustomerGroupInput!) {
        updateCustomerGroup(input: $input) {
            id
            customFields { groupType memberScope }
        }
    }
`;

const DEFAULT_SETTINGS_INPUT = {
    customerStatuses: [
        { code: 'active', label: 'Actif' },
        { code: 'inactive', label: 'Inactif' },
        { code: 'left', label: 'Parti' },
    ],
    statusTransitions: null,
    defaultStatus: 'active',
    dormantThresholdDays: null,
    roleOptions: [{ code: 'buyer', label: 'Acheteur' }],
    leadSourceOptions: [{ code: 'form', label: 'Formulaire' }],
};

describe('CrmPlugin — settings, status, codes, structure guard (C3, C4, I1, I2, R5)', () => {
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

    const asCommercial = () => adminClient.asUserWithCredentials(commercial.username, COMMERCIAL_PASSWORD);

    it('returns default settings to a sales rep', async () => {
        await asCommercial();
        const { crmSettings } = await adminClient.query(CRM_SETTINGS);

        expect(crmSettings.customerStatuses.map((s: any) => s.code)).toEqual(['active', 'inactive', 'left']);
        expect(crmSettings).toMatchObject({ defaultStatus: 'active', dormantThresholdDays: null, statusTransitions: null });
        expect(crmSettings.roleOptions.map((o: any) => o.code)).toEqual(['buyer', 'accountant', 'decision-maker']);
    });

    it('refuses settings changes from a sales rep', async () => {
        await asCommercial();
        await expect(adminClient.query(UPDATE_CRM_SETTINGS, { input: DEFAULT_SETTINGS_INPUT })).rejects.toThrow();
    });

    it('refuses invalid settings (default status not in the list)', async () => {
        await adminClient.asSuperAdmin();
        await expect(
            adminClient.query(UPDATE_CRM_SETTINGS, { input: { ...DEFAULT_SETTINGS_INPUT, defaultStatus: 'ghost' } }),
        ).rejects.toThrow(/default status/i);
    });

    it('gives customers a CLI- code, a default status and CRM fields', async () => {
        await asCommercial();
        const customerId = await createCustomer(adminClient, 'code@menata.test');
        const { customer } = await adminClient.query(CUSTOMER_CRM, { id: customerId });

        expect(customer.crmCode).toMatch(/^CLI-\d{6}$/);
        expect(customer.crmStatus).toBe('active');
        expect(customer.customFields).toEqual({ companyRoles: null, leadSource: null, companyNameHint: null });
    });

    it('changes a status freely and logs it in the history (C3, C4)', async () => {
        await asCommercial();
        const customerId = await createCustomer(adminClient, 'status@menata.test');

        const { setCustomerStatus } = await adminClient.query(SET_CUSTOMER_STATUS, { customerId, status: 'left' });
        const { customer } = await adminClient.query(CUSTOMER_CRM, { id: customerId });

        expect(setCustomerStatus.crmStatus).toBe('left');
        const entry = customer.history.items.find((item: any) => item.type === 'CUSTOMER_STATUS_CHANGED');
        expect(entry.data).toEqual({ from: 'active', to: 'left' });
    });

    it('refuses an unknown status and a transition the settings forbid', async () => {
        await adminClient.asSuperAdmin();
        await adminClient.query(UPDATE_CRM_SETTINGS, {
            input: { ...DEFAULT_SETTINGS_INPUT, statusTransitions: [{ from: 'active', to: ['inactive'] }] },
        });
        await asCommercial();
        const customerId = await createCustomer(adminClient, 'transition@menata.test');

        await expect(adminClient.query(SET_CUSTOMER_STATUS, { customerId, status: 'ghost' })).rejects.toThrow(/unknown/i);
        await expect(adminClient.query(SET_CUSTOMER_STATUS, { customerId, status: 'left' })).rejects.toThrow(/not allowed/i);
        const { setCustomerStatus } = await adminClient.query(SET_CUSTOMER_STATUS, { customerId, status: 'inactive' });
        expect(setCustomerStatus.crmStatus).toBe('inactive');

        await adminClient.asSuperAdmin();
        await adminClient.query(UPDATE_CRM_SETTINGS, { input: DEFAULT_SETTINGS_INPUT });
    });

    it('gives groups a GRP- code readable by a sales rep, with the type custom field', async () => {
        await adminClient.asSuperAdmin();
        const { createCustomerGroup } = await adminClient.query(CREATE_CUSTOMER_GROUP, {
            input: { name: 'Code group', customFields: { groupType: 'company' } },
        });
        await asCommercial();
        const { customerGroup } = await adminClient.query(GROUP_CODE, { id: createCustomerGroup.id });

        expect(customerGroup.crmCode).toMatch(/^GRP-\d{6}$/);
        expect(customerGroup.customFields).toEqual({ groupType: 'company', memberScope: 'customers' });
    });

    it('refuses a sales rep changing the group type through updateCustomerGroup', async () => {
        await adminClient.asSuperAdmin();
        const { createCustomerGroup } = await adminClient.query(CREATE_CUSTOMER_GROUP, {
            input: { name: 'Typed by admin', customFields: { groupType: 'segment' } },
        });
        await asCommercial();

        await expect(
            adminClient.query(UPDATE_CUSTOMER_GROUP, {
                input: { id: createCustomerGroup.id, customFields: { groupType: 'company' } },
            }),
        ).rejects.toThrow(/super admin/i);
        const { updateCustomerGroup } = await adminClient.query(UPDATE_CUSTOMER_GROUP, {
            input: { id: createCustomerGroup.id, name: 'Renamed by rep' },
        });
        expect(updateCustomerGroup.customFields.groupType).toBe('segment');
    });

    it('blocks a scope change that would strand existing members (R5)', async () => {
        await adminClient.asSuperAdmin();
        const { createCustomerGroup: group } = await adminClient.query(CREATE_CUSTOMER_GROUP, {
            input: { name: 'Populated segment', customFields: { groupType: 'segment' } },
        });
        const customerId = await createCustomer(adminClient, 'r5@menata.test');
        await adminClient.query(ADD_CUSTOMERS_TO_GROUP, { customerGroupId: group.id, customerIds: [customerId] });

        await expect(
            adminClient.query(UPDATE_CUSTOMER_GROUP, { input: { id: group.id, customFields: { memberScope: 'groups' } } }),
        ).rejects.toThrow(/1 customer/i);
    });

    it('blocks turning a group into a company when a member already has one (R5 + R3)', async () => {
        await adminClient.asSuperAdmin();
        const { createCustomerGroup: company } = await adminClient.query(CREATE_CUSTOMER_GROUP, {
            input: { name: 'Existing company', customFields: { groupType: 'company' } },
        });
        const { createCustomerGroup: segment } = await adminClient.query(CREATE_CUSTOMER_GROUP, {
            input: { name: 'Segment to convert', customFields: { groupType: 'segment' } },
        });
        const customerId = await createCustomer(adminClient, 'r5-company@menata.test');
        await adminClient.query(ADD_CUSTOMERS_TO_GROUP, { customerGroupId: company.id, customerIds: [customerId] });
        await adminClient.query(ADD_CUSTOMERS_TO_GROUP, { customerGroupId: segment.id, customerIds: [customerId] });

        await expect(
            adminClient.query(UPDATE_CUSTOMER_GROUP, { input: { id: segment.id, customFields: { groupType: 'company' } } }),
        ).rejects.toThrow(/already belongs to the company "Existing company"/i);
    });
});
