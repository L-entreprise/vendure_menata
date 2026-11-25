import { Injectable } from '@nestjs/common';
import { Customer, CustomerGroup, ID, idsAreEqual, RequestContext, TransactionalConnection } from '@vendure/core';
import { In, IsNull } from 'typeorm';

import { CrmForbiddenError, CrmRuleError } from '../common/crm-errors';
import { CustomerGroupEdge } from '../entities/customer-group-edge.entity';
import { COMPANY_GROUP_TYPE, crmAdminPermission, DEFAULT_MEMBER_SCOPE, GROUP_TYPES, GroupType, MemberScope } from '../constants';

/** The CRM fields of a group, whether it exists already or is about to be created. */
export interface GroupProfile {
    id?: ID;
    name: string;
    groupType?: string | null;
    memberScope?: string | null;
}

export type StructureFields = Pick<GroupProfile, 'groupType' | 'memberScope'>;

function isGroupType(value: unknown): value is GroupType {
    return typeof value === 'string' && (GROUP_TYPES as readonly string[]).includes(value);
}

/**
 * R1: the scope stored on the group, else the default of its type. A group without a
 * CRM type (created before the plugin) stays unrestricted.
 */
export function resolveMemberScope(profile: StructureFields): MemberScope {
    if (profile.memberScope) {
        return profile.memberScope as MemberScope;
    }
    return isGroupType(profile.groupType) ? DEFAULT_MEMBER_SCOPE[profile.groupType] : 'both';
}

/**
 * The structure fields an input would leave on the group. When only the type changes,
 * the scope follows the new type's default (R1: "valeur proposée selon le type").
 */
export function nextStructure(current: StructureFields, input: Record<string, unknown>): StructureFields {
    const groupType = 'groupType' in input ? (input.groupType as string | null) : current.groupType;
    const typeChanged = groupType !== current.groupType;
    const memberScope =
        'memberScope' in input
            ? (input.memberScope as string | null)
            : typeChanged && isGroupType(groupType)
              ? DEFAULT_MEMBER_SCOPE[groupType]
              : current.memberScope;
    return { groupType: groupType ?? null, memberScope: memberScope ?? null };
}

/**
 * Membership rules R1-R5 of the CDC. Called by the resolvers that replace the native
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
            groupType: customFields.groupType ?? null,
            memberScope: customFields.memberScope ?? null,
        };
    }

    /** Group type and member scope are structure: super admin only (CDC "Permissions"). */
    assertCanChangeStructure(ctx: RequestContext, current: StructureFields, next: StructureFields): void {
        const changed = current.groupType !== next.groupType || current.memberScope !== next.memberScope;
        if (changed && !ctx.userHasPermissions([crmAdminPermission.Permission])) {
            throw new CrmForbiddenError('crm-structure-admin-only');
        }
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

    /** R5: a type or scope change must not leave members that the new rule forbids. */
    async assertStructureChangeAllowed(ctx: RequestContext, current: GroupProfile, next: StructureFields) {
        if (!current.id) {
            return;
        }
        const memberIds = await this.memberIds(ctx, current.id);
        if (resolveMemberScope(next) === 'groups' && memberIds.length > 0) {
            throw new CrmRuleError('crm-scope-change-has-customers', {
                groupName: current.name,
                count: memberIds.length,
            });
        }
        if (resolveMemberScope(next) === 'customers') {
            const childCount = await this.connection
                .getRepository(ctx, CustomerGroupEdge)
                .count({ where: { parentId: current.id } });
            if (childCount > 0) {
                throw new CrmRuleError('crm-scope-change-has-groups', { groupName: current.name, count: childCount });
            }
        }
        if (next.groupType === COMPANY_GROUP_TYPE && current.groupType !== COMPANY_GROUP_TYPE) {
            await this.assertNoOtherCompany(ctx, current, memberIds);
        }
    }

    async memberIds(ctx: RequestContext, groupId: ID): Promise<ID[]> {
        const customers = await this.connection
            .getRepository(ctx, Customer)
            .createQueryBuilder('customer')
            .innerJoin('customer.groups', 'grp', 'grp.id = :groupId', { groupId })
            .where('customer.deletedAt IS NULL')
            .select(['customer.id'])
            .getMany();
        return customers.map(customer => customer.id);
    }

    /** The single company a customer belongs to (R3), if any. */
    async companyOf(ctx: RequestContext, customerId: ID): Promise<CustomerGroup | undefined> {
        const customer = await this.connection
            .getRepository(ctx, Customer)
            .findOne({ where: { id: customerId, deletedAt: IsNull() }, relations: { groups: true } });
        return customer?.groups.find(isCompany);
    }

    /** R3: a customer belongs to one company at most. */
    private async assertNoOtherCompany(ctx: RequestContext, group: GroupProfile, customerIds: ID[]) {
        if (customerIds.length === 0) {
            return;
        }
        const customers = await this.connection
            .getRepository(ctx, Customer)
            .find({ where: { id: In(customerIds) }, relations: { groups: true } });

        for (const customer of customers) {
            const otherCompany = customer.groups.find(
                candidate => isCompany(candidate) && !(group.id && idsAreEqual(candidate.id, group.id)),
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

export function isCompany(group: CustomerGroup): boolean {
    return (group.customFields as Record<string, unknown> | undefined)?.groupType === COMPANY_GROUP_TYPE;
}
