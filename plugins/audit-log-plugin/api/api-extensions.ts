import { gql } from 'graphql-tag';

export const adminApiExtensions = gql`
    type AuditLogEntry implements Node {
        id: ID!
        createdAt: DateTime!
        action: String!
        category: String!
        entityType: String!
        entityId: String
        userId: String
        userName: String
        apiType: String
        ipAddress: String
        severity: String!
        success: Boolean!
        detail: JSON
    }

    type AuditLogEntryList implements PaginatedList {
        items: [AuditLogEntry!]!
        totalItems: Int!
    }

    type AuditLogCategoryStat {
        category: String!
        count: Int!
    }

    type AuditLogUserStat {
        userName: String!
        count: Int!
    }

    type AuditLogStats {
        totalEntries: Int!
        todayEntries: Int!
        categories: [AuditLogCategoryStat!]!
        topUsers: [AuditLogUserStat!]!
        recentCritical: [AuditLogEntry!]!
    }

    # Auto-generated at runtime by ListQueryBuilder
    input AuditLogEntryListOptions

    extend type Query {
        auditLog(options: AuditLogEntryListOptions): AuditLogEntryList!
        auditLogStats: AuditLogStats!
    }

    extend type Mutation {
        clearAuditLog: Int!
    }
`;
