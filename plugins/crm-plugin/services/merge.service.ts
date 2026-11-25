import { Injectable } from '@nestjs/common';
import {
    Address,
    Customer,
    CustomerGroupService,
    CustomerHistoryEntry,
    CustomerService,
    HistoryService,
    ID,
    idsAreEqual,
    Order,
    RequestContext,
    TransactionalConnection,
} from '@vendure/core';

import { crmCode } from '../common/crm-codes';
import { CrmRuleError } from '../common/crm-errors';
import { CUSTOMER_MERGED } from '../common/history-types';
import { CrmTask } from '../entities/crm-task.entity';

import { MembershipRulesService } from './membership-rules.service';

/**
 * D3: merges a duplicate (source) into the customer kept (target): orders, addresses,
 * history, follow-ups and group memberships move over, then the source is deleted.
 * Two customers of different companies are refused (R3): move one first.
 */
@Injectable()
export class MergeService {
    constructor(
        private connection: TransactionalConnection,
        private membershipRules: MembershipRulesService,
        private customerGroupService: CustomerGroupService,
        private customerService: CustomerService,
        private historyService: HistoryService,
    ) {}

    async merge(ctx: RequestContext, sourceId: ID, targetId: ID): Promise<Customer> {
        if (idsAreEqual(sourceId, targetId)) {
            throw new CrmRuleError('crm-merge-same-customer');
        }
        const source = await this.connection.getEntityOrThrow(ctx, Customer, sourceId, { relations: { groups: true, user: true } });
        const target = await this.connection.getEntityOrThrow(ctx, Customer, targetId, { relations: { groups: true, user: true } });
        // Deleting the source also deletes its shop login: keep the record that has one.
        if (source.user && !target.user) {
            throw new CrmRuleError('crm-merge-source-has-account', { sourceEmail: source.emailAddress });
        }
        await this.assertCompatibleCompanies(ctx, source, target);

        // Placed orders move; an open cart stays with the deleted source so the kept customer
        // never ends up with two active orders.
        await this.connection
            .getRepository(ctx, Order)
            .update({ customerId: source.id, active: false }, { customerId: target.id });
        await this.moveAddresses(ctx, source.id, target.id);
        await this.reassign(ctx, CustomerHistoryEntry, source.id, target.id);
        await this.connection.getRepository(ctx, CrmTask).update({ customerId: source.id }, { customerId: target.id });
        await this.moveGroups(ctx, source, target);

        await this.historyService.createHistoryEntryForCustomer({
            ctx,
            customerId: target.id,
            type: CUSTOMER_MERGED as any,
            data: { sourceCode: crmCode('CLI', source.id), sourceEmail: source.emailAddress },
        });
        await this.customerService.softDelete(ctx, source.id);
        return this.connection.getEntityOrThrow(ctx, Customer, target.id, { relations: { groups: true } });
    }

    private async assertCompatibleCompanies(ctx: RequestContext, source: Customer, target: Customer) {
        const sourceCompany = await this.membershipRules.companyOf(ctx, source.id);
        const targetCompany = await this.membershipRules.companyOf(ctx, target.id);
        if (sourceCompany && targetCompany && !idsAreEqual(sourceCompany.id, targetCompany.id)) {
            throw new CrmRuleError('crm-merge-company-conflict', { sourceCompany: sourceCompany.name, targetCompany: targetCompany.name });
        }
    }

    private async moveGroups(ctx: RequestContext, source: Customer, target: Customer) {
        const targetGroups = new Set(target.groups.map(group => String(group.id)));
        for (const group of source.groups) {
            await this.customerGroupService.removeCustomersFromGroup(ctx, { customerGroupId: group.id, customerIds: [source.id] });
            if (!targetGroups.has(String(group.id))) {
                await this.customerGroupService.addCustomersToGroup(ctx, { customerGroupId: group.id, customerIds: [target.id] });
            }
        }
    }

    /** Moved addresses lose their default flags when the kept customer already has a default of that kind. */
    private async moveAddresses(ctx: RequestContext, fromId: ID, toId: ID) {
        const repository = this.connection.getRepository(ctx, Address);
        const kept = await repository.find({ where: { customer: { id: toId } } });
        const keptHasShipping = kept.some(address => address.defaultShippingAddress);
        const keptHasBilling = kept.some(address => address.defaultBillingAddress);
        const moved = await repository.find({ where: { customer: { id: fromId } } });
        for (const address of moved) {
            await repository.update({ id: address.id }, {
                customer: { id: toId },
                ...(keptHasShipping ? { defaultShippingAddress: false } : {}),
                ...(keptHasBilling ? { defaultBillingAddress: false } : {}),
            } as any);
        }
    }

    /** Entities that only expose the `customer` relation (no customerId column property). */
    private async reassign(ctx: RequestContext, entity: typeof CustomerHistoryEntry, fromId: ID, toId: ID) {
        const repository = this.connection.getRepository(ctx, entity);
        const rows = await repository.find({ where: { customer: { id: fromId } } });
        for (const row of rows) {
            await repository.update({ id: row.id }, { customer: { id: toId } } as any);
        }
    }
}
