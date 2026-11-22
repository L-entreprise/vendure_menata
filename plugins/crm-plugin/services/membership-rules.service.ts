import { Injectable } from '@nestjs/common';
import { Customer, CustomerGroup, ID, idsAreEqual, RequestContext, TransactionalConnection } from '@vendure/core';
import { In } from 'typeorm';

import { CrmRuleError } from '../common/crm-errors';
import { COMPANY_GROUP_TYPE, DEFAULT_MEMBER_SCOPE, GROUP_TYPES, GroupType, MemberScope } from '../constants';

/** The CRM fields of a group, whether it exists already or is about to be created. */
export interface GroupProfile {
    id?: ID;
    name: string;
    groupType?: string | null;
    memberScope?: string | null;
}

function isGroupType(value: unknown): value is GroupType {
    return typeof value === 'string' && (GROUP_TYPES as readonly string[]).includes(value);
}

/**
 * R1: the scope stored on the group, else the default of its type. A group without a
 * CRM type (created before the plugin) stays unrestricted.
 */
export function resolveMemberScope(profile: Pick<GroupProfile, 'groupType' | 'memberScope'>): MemberScope {
    if (profile.memberScope) {
        return profile.memberScope as MemberScope;
    }
    return isGroupType(profile.groupType) ? DEFAULT_MEMBER_SCOPE[profile.groupType] : 'both';
}

/**
 * Membership rules R2 and R3 of the CDC. Called by the resolvers that replace the native
 * Vendure mutations, so the rules also hold for direct API calls.
 */
@Injectable()
export class MembershipRulesService {
    constructor(private connection: TransactionalConnection) {}

    async loadProfile(ctx: RequestContext, groupId: ID): Promise<GroupProfile> {
        const group = await this.connection.getEntityOrThrow(ctx, CustomerGroup, groupId);
        const customFields = (group.customFields ?? {}) as Record<string, string | null>;
        return {
            id: group.id,
            name: group.name,
            groupType: customFields.groupType,
            memberScope: customFields.memberScope,
        };
    }

    async assertCustomersCanJoin(ctx: RequestContext, group: GroupProfile, customerIds: ID[]): Promise<void> {
        if (customerIds.length === 0) {
            return;
        }
        if (resolveMemberScope(group) === 'groups') {
            throw new CrmRuleError('crm-group-accepts-groups-only', { groupName: group.name });
        }
        if (group.groupType === COMPANY_GROUP_TYPE) {
            await this.assertNoOtherCompany(ctx, group, customerIds);
        }
    }

    /** R3: a customer belongs to one company at most. */
    private async assertNoOtherCompany(ctx: RequestContext, group: GroupProfile, customerIds: ID[]) {
        const customers = await this.connection
            .getRepository(ctx, Customer)
            .find({ where: { id: In(customerIds) }, relations: { groups: true } });

        for (const customer of customers) {
            const otherCompany = customer.groups.find(
                candidate =>
                    (candidate.customFields as Record<string, unknown>)?.groupType === COMPANY_GROUP_TYPE &&
                    !(group.id && idsAreEqual(candidate.id, group.id)),
            );
            if (otherCompany) {
                throw new CrmRuleError('crm-customer-already-in-company', {
                    customerName: `${customer.firstName} ${customer.lastName}`.trim() || customer.emailAddress,
                    companyName: otherCompany.name,
                });
            }
        }
    }
}
