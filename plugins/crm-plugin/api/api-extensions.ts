import { gql } from 'graphql-tag';

/**
 * Read-only CRM view of a group. The `groupType` / `memberScope` custom fields carry
 * `requiresPermission: CrmAdmin`, which Vendure applies to reads too, so sales reps would
 * not see them. These fields are readable by anyone who can read the group; writes stay
 * on the custom fields, super admin only.
 */
export const adminApiExtensions = gql`
    extend type CustomerGroup {
        "CRM type of the group (company, companyGroup, portfolio, segment, other), null when untyped"
        crmGroupType: String
        "Who may join: the stored scope, else the default of the type, else both"
        crmMemberScope: String!
    }
`;
