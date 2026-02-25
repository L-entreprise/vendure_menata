import { gql } from 'graphql-tag';

const commonApiExtensions = gql`
    enum ContentBlockType {
        IMAGE
        TEXT
        RICH_TEXT
        DATE
        NUMBER
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
        page: CmsPage
        position: Int!
        dateValue: DateTime
        numberValue: Float
    }

    type ContentBlockList implements PaginatedList {
        items: [ContentBlock!]!
        totalItems: Int!
    }

    # Auto-generated at runtime by ListQueryBuilder
    input ContentBlockListOptions

    type CmsPageTranslation {
        id: ID!
        languageCode: LanguageCode!
        name: String!
        slug: String!
    }

    type CmsPage implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        key: String!
        enabled: Boolean!
        name: String!
        slug: String!
        translations: [CmsPageTranslation!]!
        contentBlocks: [ContentBlock!]!
    }

    type CmsPageList implements PaginatedList {
        items: [CmsPage!]!
        totalItems: Int!
    }

    # Auto-generated at runtime by ListQueryBuilder
    input CmsPageListOptions
`;

export const shopApiExtensions = gql`
    ${commonApiExtensions}

    extend type Query {
        contentBlock(id: ID!): ContentBlock
        contentBlockByKey(key: String!): ContentBlock
        contentBlocks(options: ContentBlockListOptions): ContentBlockList!
        cmsPage(id: ID!): CmsPage
        cmsPageByKey(key: String!): CmsPage
        cmsPages(options: CmsPageListOptions): CmsPageList!
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

    input CmsPageTranslationInput {
        id: ID
        languageCode: LanguageCode!
        name: String!
        slug: String!
    }

    input UpdatePageContentBlockInput {
        id: ID
        type: ContentBlockType!
        key: String!
        position: Int!
        enabled: Boolean
        featuredAssetId: ID
        dateValue: DateTime
        numberValue: Float
        translations: [ContentBlockTranslationInput!]
    }

    input CreateCmsPageInput {
        key: String!
        enabled: Boolean
        translations: [CmsPageTranslationInput!]!
        contentBlocks: [UpdatePageContentBlockInput!]
    }

    input UpdateCmsPageInput {
        id: ID!
        key: String
        enabled: Boolean
        translations: [CmsPageTranslationInput!]
        contentBlocks: [UpdatePageContentBlockInput!]
    }

    extend type Query {
        contentBlock(id: ID!): ContentBlock
        contentBlocks(options: ContentBlockListOptions): ContentBlockList!
        cmsPage(id: ID!): CmsPage
        cmsPages(options: CmsPageListOptions): CmsPageList!
    }

    extend type Mutation {
        createContentBlock(input: CreateContentBlockInput!): ContentBlock!
        updateContentBlock(input: UpdateContentBlockInput!): ContentBlock!
        deleteContentBlock(id: ID!): DeletionResponse!
        createCmsPage(input: CreateCmsPageInput!): CmsPage!
        updateCmsPage(input: UpdateCmsPageInput!): CmsPage!
        deleteCmsPage(id: ID!): DeletionResponse!
    }
`;
