import { Injectable } from '@nestjs/common';
import { Customer, CustomerGroup, CustomerGroupService, ID, idsAreEqual, RequestContext, TransactionalConnection } from '@vendure/core';

import { CrmRuleError } from '../common/crm-errors';

import { isCompany, MembershipRulesService, resolveMemberScope, StructureFields } from './membership-rules.service';

/** Membership operations offered by the CRM UI: R3 "move" and R4 eligible groups. */
@Injectable()
export class CustomerMembershipService {
    constructor(
        private connection: TransactionalConnection,
        private customerGroupService: CustomerGroupService,
        private membershipRules: MembershipRulesService,
    ) {}

    /** R3: moving replaces the customer's company instead of adding a second one. */
    async moveToCompany(ctx: RequestContext, customerId: ID, companyId: ID): Promise<Customer> {
        const target = await this.connection.getEntityOrThrow(ctx, CustomerGroup, companyId);
        if (!isCompany(target)) {
            throw new CrmRuleError('crm-not-a-company', { groupName: target.name });
        }
        if (resolveMemberScope((target.customFields ?? {}) as StructureFields) === 'groups') {
            throw new CrmRuleError('crm-group-accepts-groups-only', { groupName: target.name });
        }
        const current = await this.membershipRules.companyOf(ctx, customerId);
        if (current && !idsAreEqual(current.id, target.id)) {
            await this.customerGroupService.removeCustomersFromGroup(ctx, {
                customerGroupId: current.id,
                customerIds: [customerId],
            });
        }
        if (!current || !idsAreEqual(current.id, target.id)) {
            await this.customerGroupService.addCustomersToGroup(ctx, {
                customerGroupId: target.id,
                customerIds: [customerId],
            });
        }
        return this.connection.getEntityOrThrow(ctx, Customer, customerId, { relations: { groups: true } });
    }

    /**
     * R4: groups the customer can join directly. Groups reserved for groups and groups the
     * customer is already in are left out; companies too once the customer has one (moving
     * is the only way to change company).
     */
    async eligibleGroups(ctx: RequestContext, customerId: ID): Promise<CustomerGroup[]> {
        const customer = await this.connection.getEntityOrThrow(ctx, Customer, customerId, {
            relations: { groups: true },
        });
        const hasCompany = customer.groups.some(isCompany);
        const memberOf = new Set(customer.groups.map(group => String(group.id)));
        const groups = await this.connection.getRepository(ctx, CustomerGroup).find({ order: { name: 'ASC' } });
        return groups.filter(
            group =>
                !memberOf.has(String(group.id)) &&
                resolveMemberScope((group.customFields ?? {}) as StructureFields) !== 'groups' &&
                !(hasCompany && isCompany(group)),
        );
    }
}
