import { PermissionDefinition } from '@vendure/core';

export const loggerCtx = 'CrmPlugin';

/**
 * Super admin rights of the CDC: group hierarchy, group types, membership rules,
 * customer merge, statistics, deleting someone else's note. Sales reps never get it.
 * The SuperAdmin role holds every permission, so it has this one too.
 */
export const crmAdminPermission = new PermissionDefinition({
    name: 'CrmAdmin',
    description: 'Manage the CRM structure (group types, membership rules, merges) and delete any note',
});

/** Group types of the CDC (G7). Kept as plain strings: they are stored in a custom field. */
export const GROUP_TYPES = ['company', 'companyGroup', 'portfolio', 'segment', 'other'] as const;
export type GroupType = (typeof GROUP_TYPES)[number];

/** Who may join a group (R1). */
export const MEMBER_SCOPES = ['customers', 'groups', 'both'] as const;
export type MemberScope = (typeof MEMBER_SCOPES)[number];

/** R1: member scope proposed for each type when the super admin does not pick one. */
export const DEFAULT_MEMBER_SCOPE: Readonly<Record<GroupType, MemberScope>> = {
    company: 'customers',
    companyGroup: 'groups',
    portfolio: 'groups',
    segment: 'both',
    other: 'both',
};

/** The type a customer may belong to only once (R3). */
export const COMPANY_GROUP_TYPE: GroupType = 'company';
