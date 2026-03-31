import { gql } from 'graphql-tag';

export const adminApiExtensions = gql`
    type AuditLogEntry implements Node {
        id: ID!
        createdAt: DateTime!
        action: String!
        entityType: String!
        entityId: String
        userId: String
        userName: String
        detail: JSON
    }

    type AuditLogEntryList implements PaginatedList {
        items: [AuditLogEntry!]!
        totalItems: Int!
    }

    # Auto-generated at runtime by ListQueryBuilder
    input AuditLogEntryListOptions

    extend type Query {
        auditLog(options: AuditLogEntryListOptions): AuditLogEntryList!
    }
`;
