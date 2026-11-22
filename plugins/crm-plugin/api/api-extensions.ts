import { gql } from 'graphql-tag';

const settings = gql`
    type CrmOption {
        code: String!
        label: String!
    }
    type CrmStatusTransition {
        from: String!
        to: [String!]!
    }
    type CrmSettings {
        customerStatuses: [CrmOption!]!
        "null: any status can follow any other"
        statusTransitions: [CrmStatusTransition!]
        defaultStatus: String!
        "null: the dormant state is disabled"
        dormantThresholdDays: Int
        roleOptions: [CrmOption!]!
        leadSourceOptions: [CrmOption!]!
    }
    input CrmOptionInput {
        code: String!
        label: String!
    }
    input CrmStatusTransitionInput {
        from: String!
        to: [String!]!
    }
    input UpdateCrmSettingsInput {
        customerStatuses: [CrmOptionInput!]!
        statusTransitions: [CrmStatusTransitionInput!]
        defaultStatus: String!
        dormantThresholdDays: Int
        roleOptions: [CrmOptionInput!]!
        leadSourceOptions: [CrmOptionInput!]!
    }
    extend type Query {
        crmSettings: CrmSettings!
    }
    extend type Mutation {
        updateCrmSettings(input: UpdateCrmSettingsInput!): CrmSettings!
    }
`;

const customer = gql`
    extend enum HistoryEntryType {
        CUSTOMER_STATUS_CHANGED
    }
    extend type Customer {
        "Internal code CLI-000123 (I1), derived from the id"
        crmCode: String!
        "CRM status (C3): the stored one, else the default status of the settings"
        crmStatus: String!
    }
    extend type Mutation {
        setCustomerStatus(customerId: ID!, status: String!): Customer!
    }
`;

/**
 * Read-only CRM view of a group, readable by anyone who can read the group.
 */
const group = gql`
    extend type CustomerGroup {
        "Internal code GRP-000045 (I2), derived from the id"
        crmCode: String!
        "CRM type of the group (company, companyGroup, portfolio, segment, other), null when untyped"
        crmGroupType: String
        "Who may join: the stored scope, else the default of the type, else both"
        crmMemberScope: String!
    }
`;

/** G1-G6 hierarchy, R3 move, R4 eligible groups. */
const hierarchy = gql`
    type CrmTreeEntry {
        group: CustomerGroup!
        parentIds: [ID!]!
    }
    extend type CustomerGroup {
        crmParents: [CustomerGroup!]!
        crmChildren: [CustomerGroup!]!
        "Every group above, nearest first, each once"
        crmAncestors: [CustomerGroup!]!
        "One path from a top group down to the parent, following the oldest parent link"
        crmBreadcrumb: [CustomerGroup!]!
    }
    extend type Query {
        crmGroupTree: [CrmTreeEntry!]!
        crmEligibleGroups(customerId: ID!): [CustomerGroup!]!
    }
    extend type Mutation {
        addCustomerGroupParent(childId: ID!, parentId: ID!): CustomerGroup!
        removeCustomerGroupParent(childId: ID!, parentId: ID!): CustomerGroup!
        moveCustomerToCompany(customerId: ID!, companyId: ID!): Customer!
    }
`;

export const adminApiExtensions = gql`
    ${settings}
    ${customer}
    ${group}
    ${hierarchy}
`;
