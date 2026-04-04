import { gql } from 'graphql-tag';

const commonApiExtensions = gql`
    enum ContentBlockType {
        TEXT_SHORT
        TEXT_LONG
        RICH_TEXT
        BOOLEAN
        ENUM
        IMAGE
        IMAGE_GALLERY
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
        acceptsSubmissions: Boolean!
        isCollection: Boolean!
        pinnedInSidebar: Boolean!
        allowCustomerCreation: Boolean!
        sidebarOrder: Int!
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

    type FormSubmission implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        data: JSON!
    }

    type FormSubmissionList implements PaginatedList {
        items: [FormSubmission!]!
        totalItems: Int!
    }

    # Auto-generated at runtime by ListQueryBuilder
    input FormSubmissionListOptions

    input SubmitFormInput {
        pageKey: String!
        fields: JSON!
    }

    type SubmitFormResult {
        success: Boolean!
    }

    extend type Query {
        contentBlock(id: ID!): ContentBlock
        contentBlockByKey(key: String!): ContentBlock
        contentBlocks(options: ContentBlockListOptions): ContentBlockList!
        cmsPage(id: ID!): CmsPage
        cmsPageByKey(key: String!): CmsPage
        cmsPages(options: CmsPageListOptions): CmsPageList!
        collectionEntries(pageKey: String!, options: FormSubmissionListOptions): FormSubmissionList!
        collectionEntry(pageKey: String!, entryId: ID!): FormSubmission
    }

    extend type Mutation {
        submitForm(input: SubmitFormInput!): SubmitFormResult!
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
        metadata: JSON
        dateValue: DateTime
        numberValue: Float
        translations: [ContentBlockTranslationInput!]
    }

    input CreateCmsPageInput {
        key: String!
        enabled: Boolean
        acceptsSubmissions: Boolean
        isCollection: Boolean
        pinnedInSidebar: Boolean
        allowCustomerCreation: Boolean
        sidebarOrder: Int
        translations: [CmsPageTranslationInput!]!
        contentBlocks: [UpdatePageContentBlockInput!]
    }

    input UpdateCmsPageInput {
        id: ID!
        key: String
        enabled: Boolean
        acceptsSubmissions: Boolean
        isCollection: Boolean
        pinnedInSidebar: Boolean
        allowCustomerCreation: Boolean
        sidebarOrder: Int
        translations: [CmsPageTranslationInput!]
        contentBlocks: [UpdatePageContentBlockInput!]
    }

    input CreateCollectionEntryInput {
        pageId: ID!
        data: JSON!
    }

    input UpdateCollectionEntryInput {
        id: ID!
        data: JSON!
    }

    type FormSubmission implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        data: JSON!
    }

    type CreateCustomerFromSubmissionResult {
        submission: FormSubmission!
        customerId: ID!
        existing: Boolean!
    }

    type FormSubmissionList implements PaginatedList {
        items: [FormSubmission!]!
        totalItems: Int!
    }

    # Auto-generated at runtime by ListQueryBuilder
    input FormSubmissionListOptions

    extend type Query {
        contentBlock(id: ID!): ContentBlock
        contentBlocks(options: ContentBlockListOptions): ContentBlockList!
        cmsPage(id: ID!): CmsPage
        cmsPages(options: CmsPageListOptions): CmsPageList!
        formSubmissions(pageId: ID!, options: FormSubmissionListOptions): FormSubmissionList!
        pinnedCmsPages: [CmsPage!]!
    }

    extend type Mutation {
        createContentBlock(input: CreateContentBlockInput!): ContentBlock!
        updateContentBlock(input: UpdateContentBlockInput!): ContentBlock!
        deleteContentBlock(id: ID!): DeletionResponse!
        createCmsPage(input: CreateCmsPageInput!): CmsPage!
        updateCmsPage(input: UpdateCmsPageInput!): CmsPage!
        deleteCmsPage(id: ID!): DeletionResponse!
        deleteFormSubmission(id: ID!): DeletionResponse!
        createCollectionEntry(input: CreateCollectionEntryInput!): FormSubmission!
        updateCollectionEntry(input: UpdateCollectionEntryInput!): FormSubmission!
        createCustomerFromSubmission(submissionId: ID!): CreateCustomerFromSubmissionResult!
    }
`;
