import { Order, RequestContextService, TransactionalConnection } from '@vendure/core';
import { gql } from 'graphql-tag';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createPluginTestEnvironment, initialData, TEST_SETUP_TIMEOUT_MS, waitFor } from '../../../deploy/e2e/test-environment';
import { CrmPlugin } from '../crm.plugin';
import { LifecycleService } from '../services/lifecycle.service';

import { ADD_CUSTOMERS_TO_GROUP, Commercial, COMMERCIAL_PASSWORD, CREATE_CUSTOMER_GROUP, createCommercialFactory, createCustomer } from './helpers';
import { cancelOrder, createDraft, createTestVariant, payDraft, refund } from './order-helpers';

const ORDER_CRM = gql`
    query OrderCrm($id: ID!) {
        order(id: $id) { id crmSalesRepName customFields { companyGroup { id name } } }
    }
`;
const GROUP_LIFECYCLE = gql`
    query GroupLifecycle($id: ID!) {
        customerGroup(id: $id) { id customFields { lifecycle lifecycleVia } }
    }
`;
const ADD_PARENT = gql`
    mutation AddParent($childId: ID!, $parentId: ID!) { addCustomerGroupParent(childId: $childId, parentId: $parentId) { id } }
`;
const MOVE = gql`
    mutation Move($customerId: ID!, $companyId: ID!) { moveCustomerToCompany(customerId: $customerId, companyId: $companyId) { id } }
`;
const SET_ORDER_COMPANY = gql`
    mutation SetOrderCompany($orderId: ID!, $companyId: ID) { setOrderCompany(orderId: $orderId, companyId: $companyId) { id } }
`;
const GROUP_ORDERS = gql`
    query GroupOrders($groupId: ID!, $options: CrmGroupOrdersOptions) {
        crmGroupOrders(groupId: $groupId, options: $options) { totalItems items { order { id } company { name } customer { lastName } } }
    }
`;
const SALES_SUMMARY = gql`
    query Summary($groupId: ID!) {
        crmGroupSalesSummary(groupId: $groupId) { orderCount totalWithTax averageWithTax lastOrderAt }
    }
`;
const UPDATE_SETTINGS = gql`
    mutation Settings($input: UpdateCrmSettingsInput!) { updateCrmSettings(input: $input) { dormantThresholdDays } }
`;

describe('CrmPlugin — orders, lifecycle, group sales (O1-O6, T1-T4)', () => {
    const { server, adminClient } = createPluginTestEnvironment({ plugins: [CrmPlugin] });
    let alexandre: Commercial;
    let variantId: string;

    beforeAll(async () => {
        await server.init({ initialData, customerCount: 0 });
        await adminClient.asSuperAdmin();
        alexandre = await (await createCommercialFactory(adminClient))('Alexandre', 'Martin');
        variantId = await createTestVariant(adminClient);
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    async function group(name: string, groupType: string, parentId?: string): Promise<string> {
        await adminClient.asSuperAdmin();
        const { createCustomerGroup } = await adminClient.query(CREATE_CUSTOMER_GROUP, { input: { name, customFields: { groupType } } });
        if (parentId) {
            await adminClient.query(ADD_PARENT, { childId: createCustomerGroup.id, parentId });
        }
        return createCustomerGroup.id;
    }
    async function contact(email: string, companyId: string): Promise<string> {
        await adminClient.asSuperAdmin();
        const customerId = await createCustomer(adminClient, email);
        await adminClient.query(ADD_CUSTOMERS_TO_GROUP, { customerGroupId: companyId, customerIds: [customerId] });
        return customerId;
    }
    async function lifecycle(groupId: string) {
        await adminClient.asSuperAdmin();
        return (await adminClient.query(GROUP_LIFECYCLE, { id: groupId })).customerGroup.customFields;
    }
    const waitLifecycle = (groupId: string, expected: string | null) =>
        waitFor(() => lifecycle(groupId), fields => fields.lifecycle === expected);

    it('freezes the company and records the sales rep who created the order (O1, O6)', async () => {
        const colmar = await group('O1 Colmar', 'company');
        const strasbourg = await group('O1 Strasbourg', 'company');
        const customerId = await contact('o1@menata.test', colmar);
        await adminClient.asUserWithCredentials(alexandre.username, COMMERCIAL_PASSWORD);
        const orderId = await createDraft(adminClient, customerId, variantId);
        await adminClient.asSuperAdmin();
        await payDraft(adminClient, orderId);

        await adminClient.query(MOVE, { customerId, companyId: strasbourg });
        await adminClient.asUserWithCredentials(alexandre.username, COMMERCIAL_PASSWORD);
        const { order } = await adminClient.query(ORDER_CRM, { id: orderId });

        expect(order.customFields.companyGroup.name).toBe('O1 Colmar');
        expect(order.crmSalesRepName).toBe('Alexandre Martin');
    });

    it('makes the company and its parent clients, never the sister company (T1, T3)', async () => {
        const holding = await group('T1 Holding', 'companyGroup');
        const colmar = await group('T1 Colmar', 'company', holding);
        const strasbourg = await group('T1 Strasbourg', 'company', holding);
        const portfolio = await group('T1 Portfolio', 'portfolio');
        await adminClient.query(ADD_PARENT, { childId: colmar, parentId: portfolio });
        const customerId = await contact('t1@menata.test', colmar);
        expect((await lifecycle(colmar)).lifecycle).toBe('prospect');

        await payDraft(adminClient, await createDraft(adminClient, customerId, variantId));

        expect(await waitLifecycle(colmar, 'client')).toEqual({ lifecycle: 'client', lifecycleVia: 'direct' });
        expect(await waitLifecycle(holding, 'client')).toEqual({ lifecycle: 'client', lifecycleVia: 'subsidiary' });
        expect(await lifecycle(strasbourg)).toEqual({ lifecycle: 'prospect', lifecycleVia: null });
        expect((await lifecycle(portfolio)).lifecycle).toBeNull();
    });

    it('keeps a partly refunded order, drops a fully refunded one (T1)', async () => {
        const company = await group('Refund company', 'company');
        const customerId = await contact('refund@menata.test', company);
        const paid = await payDraft(adminClient, await createDraft(adminClient, customerId, variantId));
        await waitLifecycle(company, 'client');

        await refund(adminClient, paid.paymentId, 1_000);
        await new Promise(resolve => setTimeout(resolve, 300));
        expect((await lifecycle(company)).lifecycle).toBe('client');

        await refund(adminClient, paid.paymentId, paid.totalWithTax - 1_000);
        expect((await waitLifecycle(company, 'prospect')).lifecycle).toBe('prospect');
    });

    it('drops a cancelled order (T1)', async () => {
        const company = await group('Cancel company', 'company');
        const customerId = await contact('cancel@menata.test', company);
        const orderId = await createDraft(adminClient, customerId, variantId);
        await payDraft(adminClient, orderId);
        await waitLifecycle(company, 'client');

        await cancelOrder(adminClient, orderId);

        expect((await waitLifecycle(company, 'prospect')).lifecycle).toBe('prospect');
    });

    it('turns a client dormant only once a threshold is set (T2)', async () => {
        const company = await group('Dormant company', 'company');
        const customerId = await contact('dormant@menata.test', company);
        const { orderId } = await payDraft(adminClient, await createDraft(adminClient, customerId, variantId));
        await waitLifecycle(company, 'client');
        const connection = server.app.get(TransactionalConnection);
        await connection.rawConnection.getRepository(Order).update({ id: orderId.replace('T_', '') }, { orderPlacedAt: new Date('2025-01-01') });
        const ctx = await server.app.get(RequestContextService).create({ apiType: 'admin' });
        const lifecycleService = server.app.get(LifecycleService);

        await lifecycleService.recomputeAll(ctx);
        expect((await lifecycle(company)).lifecycle).toBe('client');

        const settings = {
            customerStatuses: [{ code: 'active', label: 'Actif' }], statusTransitions: null, defaultStatus: 'active',
            roleOptions: [], leadSourceOptions: [],
        };
        await adminClient.query(UPDATE_SETTINGS, { input: { ...settings, dormantThresholdDays: 90 } });
        await lifecycleService.recomputeAll(ctx);
        expect((await lifecycle(company)).lifecycle).toBe('dormant');

        await adminClient.query(UPDATE_SETTINGS, { input: { ...settings, dormantThresholdDays: null } });
        await lifecycleService.recomputeAll(ctx);
        expect((await lifecycle(company)).lifecycle).toBe('client');
    });

    it('lists the orders of a group and its subsidiaries once each, with totals (O2-O5)', async () => {
        const top = await group('Sales top', 'companyGroup');
        const left = await group('Sales left', 'companyGroup', top);
        const right = await group('Sales right', 'companyGroup', top);
        const shop = await group('Sales shop', 'company', left);
        await adminClient.query(ADD_PARENT, { childId: shop, parentId: right });
        const customerId = await contact('sales@menata.test', shop);
        const first = await payDraft(adminClient, await createDraft(adminClient, customerId, variantId));
        await payDraft(adminClient, await createDraft(adminClient, customerId, variantId));

        const { crmGroupOrders } = await adminClient.query(GROUP_ORDERS, { groupId: top });
        expect(crmGroupOrders.totalItems).toBe(2);
        expect(crmGroupOrders.items[0]).toMatchObject({ company: { name: 'Sales shop' }, customer: { lastName: 'sales' } });
        const filtered = await adminClient.query(GROUP_ORDERS, { groupId: top, options: { subsidiaryId: right } });
        expect(filtered.crmGroupOrders.totalItems).toBe(2);

        const { crmGroupSalesSummary } = await adminClient.query(SALES_SUMMARY, { groupId: top });
        expect(crmGroupSalesSummary.orderCount).toBe(2);
        expect(crmGroupSalesSummary.totalWithTax).toBe(first.totalWithTax * 2);
        expect(crmGroupSalesSummary.averageWithTax).toBe(first.totalWithTax);
    });

    it('lets only the super admin change the company of an order (O1)', async () => {
        const company = await group('Change company', 'company');
        const other = await group('Change other', 'company');
        const customerId = await contact('change@menata.test', company);
        const { orderId } = await payDraft(adminClient, await createDraft(adminClient, customerId, variantId));

        await adminClient.asUserWithCredentials(alexandre.username, COMMERCIAL_PASSWORD);
        await expect(adminClient.query(SET_ORDER_COMPANY, { orderId, companyId: other })).rejects.toThrow();
        await adminClient.asSuperAdmin();
        await adminClient.query(SET_ORDER_COMPANY, { orderId, companyId: other });

        expect((await adminClient.query(ORDER_CRM, { id: orderId })).order.customFields.companyGroup.name).toBe('Change other');
        expect((await waitLifecycle(company, 'prospect')).lifecycle).toBe('prospect');
        expect((await waitLifecycle(other, 'client')).lifecycle).toBe('client');
    });
});
