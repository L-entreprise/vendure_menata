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
        const source = await this.connection.getEntityOrThrow(ctx, Customer, sourceId, { relations: { groups: true } });
        const target = await this.connection.getEntityOrThrow(ctx, Customer, targetId, { relations: { groups: true } });
        await this.assertCompatibleCompanies(ctx, source, target);

        await this.connection.getRepository(ctx, Order).update({ customerId: source.id }, { customerId: target.id });
        await this.reassign(ctx, Address, source.id, target.id);
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

    /** Entities that only expose the `customer` relation (no customerId column property). */
    private async reassign(ctx: RequestContext, entity: typeof Address | typeof CustomerHistoryEntry, fromId: ID, toId: ID) {
        const repository = this.connection.getRepository(ctx, entity as typeof Address);
        const rows = await repository.find({ where: { customer: { id: fromId } } });
        for (const row of rows) {
            await repository.update({ id: row.id }, { customer: { id: toId } } as any);
        }
    }
}
