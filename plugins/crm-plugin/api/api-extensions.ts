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

/** N2 pinned notes, N4 group notes, N5 company journal. */
const notes = gql`
    type CrmGroupNote {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        note: String!
        pinned: Boolean!
        authorName: String
        "True when the current administrator wrote the note (only the author may edit it)"
        isMine: Boolean!
    }
    type CrmJournalEntry {
        id: ID!
        createdAt: DateTime!
        type: String!
        data: JSON!
        authorName: String
    }
    type CrmJournalList {
        items: [CrmJournalEntry!]!
        totalItems: Int!
    }
    extend type Query {
        "Pinned notes first, then oldest first"
        customerGroupNotes(groupId: ID!): [CrmGroupNote!]!
        "Newest first, company groups only"
        crmJournal(groupId: ID!, skip: Int, take: Int): CrmJournalList!
    }
    extend type Mutation {
        setCustomerNotePinned(noteId: ID!, pinned: Boolean!): HistoryEntry!
        addCustomerGroupNote(groupId: ID!, note: String!): CrmGroupNote!
        updateCustomerGroupNote(noteId: ID!, note: String!): CrmGroupNote!
        deleteCustomerGroupNote(noteId: ID!): DeletionResponse!
        setCustomerGroupNotePinned(noteId: ID!, pinned: Boolean!): CrmGroupNote!
    }
`;

/** K1-K4 follow-ups, mentions, notifications. */
const tasks = gql`
    enum CrmTaskBucket {
        OVERDUE
        TODAY
        UPCOMING
        DONE
    }
    type CrmTask {
        id: ID!
        createdAt: DateTime!
        title: String!
        "Calendar day YYYY-MM-DD"
        dueDate: String!
        done: Boolean!
        doneAt: DateTime
        assigneeName: String
        isMine: Boolean!
        customer: Customer
        group: CustomerGroup
        sourceNoteId: ID
        sourceNoteKind: String
    }
    input CreateCrmTaskInput {
        title: String!
        dueDate: String!
        customerId: ID
        groupId: ID
        sourceNoteId: ID
        sourceNoteKind: String
    }
    type CrmPerson {
        id: ID!
        firstName: String!
        lastName: String!
    }
    type CrmNotification {
        id: ID!
        createdAt: DateTime!
        type: String!
        read: Boolean!
        data: JSON!
    }
    type CrmNotificationList {
        items: [CrmNotification!]!
        unreadCount: Int!
    }
    extend type Query {
        myCrmTasks(bucket: CrmTaskBucket!): [CrmTask!]!
        crmTasksFor(customerId: ID, groupId: ID): [CrmTask!]!
        crmMentionableAdministrators: [CrmPerson!]!
        myCrmNotifications(unreadOnly: Boolean): CrmNotificationList!
    }
    extend type Mutation {
        "Always assigned to the current administrator"
        createCrmTask(input: CreateCrmTaskInput!): CrmTask!
        setCrmTaskDone(id: ID!, done: Boolean!): CrmTask!
        deleteCrmTask(id: ID!): DeletionResponse!
        "Marks the given notifications, or all of them when ids is empty, as read; returns how many changed"
        markCrmNotificationsRead(ids: [ID!]): Int!
    }
`;

/** O1-O6 orders and group sales. */
const sales = gql`
    input CrmGroupOrdersOptions {
        from: DateTime
        to: DateTime
        states: [String!]
        "Limit to this subsidiary and the groups below it"
        subsidiaryId: ID
        customerId: ID
        skip: Int
        take: Int
    }
    type CrmGroupOrder {
        order: Order!
        "The company frozen on the order (O3)"
        company: CustomerGroup
        customer: Customer
    }
    type CrmGroupOrderList {
        items: [CrmGroupOrder!]!
        totalItems: Int!
    }
    type CrmSalesSummary {
        orderCount: Int!
        "Tax excluded"
        total: Money!
        totalWithTax: Money!
        averageWithTax: Money!
        lastOrderAt: DateTime
        currencyCode: CurrencyCode
    }
    extend type Order {
        "Name of the sales rep recorded on the order (O6)"
        crmSalesRepName: String
        "The company frozen on the order (O1)"
        crmCompany: CustomerGroup
    }
    extend type Query {
        "Placed orders of the group and every group below it, newest first"
        crmGroupOrders(groupId: ID!, options: CrmGroupOrdersOptions): CrmGroupOrderList!
        "Totals over the counted orders (payment settled, not cancelled nor fully refunded)"
        crmGroupSalesSummary(groupId: ID!, from: DateTime, to: DateTime): CrmSalesSummary!
    }
    extend type Mutation {
        setOrderCompany(orderId: ID!, companyId: ID): Order!
    }
`;

/** A1-A3 company addresses and ordering by company. */
const addresses = gql`
    type CrmGroupAddress {
        id: ID!
        "headquarters, shipping or billing"
        kind: String!
        label: String!
        fullName: String!
        company: String!
        streetLine1: String!
        streetLine2: String!
        city: String!
        province: String!
        postalCode: String!
        countryCode: String!
        phoneNumber: String!
        defaultShipping: Boolean!
        defaultBilling: Boolean!
    }
    input CrmGroupAddressInput {
        kind: String!
        label: String
        fullName: String
        company: String
        streetLine1: String!
        streetLine2: String
        city: String
        province: String
        postalCode: String
        countryCode: String!
        phoneNumber: String
        defaultShipping: Boolean
        defaultBilling: Boolean
    }
    type CrmAddressSuggestion {
        "company: the contact's company; ancestor: a group above it"
        source: String!
        groupId: ID!
        groupName: String!
        address: CrmGroupAddress!
    }
    extend type Query {
        customerGroupAddresses(groupId: ID!): [CrmGroupAddress!]!
        "Addresses proposed for a contact: their company first, then each group above it"
        crmAddressSuggestions(customerId: ID!): [CrmAddressSuggestion!]!
    }
    extend type Mutation {
        createCustomerGroupAddress(groupId: ID!, input: CrmGroupAddressInput!): CrmGroupAddress!
        updateCustomerGroupAddress(id: ID!, input: CrmGroupAddressInput!): CrmGroupAddress!
        deleteCustomerGroupAddress(id: ID!): DeletionResponse!
        setDraftOrderCompany(orderId: ID!, companyId: ID!): Order!
    }
`;

export const adminApiExtensions = gql`
    ${settings}
    ${customer}
    ${group}
    ${hierarchy}
    ${notes}
    ${tasks}
    ${sales}
    ${addresses}
`;
