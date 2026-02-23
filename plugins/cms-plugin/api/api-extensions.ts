import { gql } from 'graphql-tag';

const commonApiExtensions = gql`
    enum ContentBlockType {
        IMAGE
        TEXT
    }

    type ContentBlockTranslation {
        id: ID!
        languageCode: LanguageCode!
        name: String!
        textContent: String
        altText: String
    }

    type ContentBlock implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        key: String!
        type: ContentBlockType!
        enabled: Boolean!
        featuredAsset: Asset
        metadata: JSON
        translations: [ContentBlockTranslation!]!
        name: String!
        textContent: String
        altText: String
    }

    type ContentBlockList implements PaginatedList {
        items: [ContentBlock!]!
        totalItems: Int!
    }

    # Auto-generated at runtime by ListQueryBuilder
    input ContentBlockListOptions
`;

export const shopApiExtensions = gql`
    ${commonApiExtensions}

    extend type Query {
        contentBlock(id: ID!): ContentBlock
        contentBlockByKey(key: String!): ContentBlock
        contentBlocks(options: ContentBlockListOptions): ContentBlockList!
    }
`;

export const adminApiExtensions = gql`
    ${commonApiExtensions}

    input ContentBlockTranslationInput {
        id: ID
        languageCode: LanguageCode!
        name: String!
        textContent: String
        altText: String
    }

    input CreateContentBlockInput {
        key: String!
        type: ContentBlockType!
        enabled: Boolean
        featuredAssetId: ID
        metadata: JSON
        translations: [ContentBlockTranslationInput!]!
    }

    input UpdateContentBlockInput {
        id: ID!
        key: String
        enabled: Boolean
        featuredAssetId: ID
        metadata: JSON
        translations: [ContentBlockTranslationInput!]
    }

    extend type Query {
        contentBlock(id: ID!): ContentBlock
        contentBlocks(options: ContentBlockListOptions): ContentBlockList!
    }

    extend type Mutation {
        createContentBlock(input: CreateContentBlockInput!): ContentBlock!
        updateContentBlock(input: UpdateContentBlockInput!): ContentBlock!
        deleteContentBlock(id: ID!): DeletionResponse!
    }
`;
