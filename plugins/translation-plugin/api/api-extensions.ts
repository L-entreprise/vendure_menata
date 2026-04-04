import { gql } from 'graphql-tag';

export const adminApiExtensions = gql`
    type TranslationLanguage implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        code: String!
        name: String!
        enabled: Boolean!
        isDefault: Boolean!
        position: Int!
    }

    input TranslationLanguageInput {
        code: String!
        name: String!
        enabled: Boolean
        isDefault: Boolean
        position: Int
    }

    type CmsTranslationEntry implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        languageCode: String!
        pageId: ID!
        contentBlockId: ID
        entryId: ID
        fieldName: String!
        value: String!
    }

    type PageTranslations {
        pageId: ID!
        languageCode: String!
        entries: [CmsTranslationEntry!]!
    }

    type TranslatableField {
        contentBlockId: ID
        fieldName: String!
        blockKey: String
        blockType: String
    }

    type DefaultContentEntry {
        languageCode: String!
        pageId: ID!
        contentBlockId: ID
        fieldName: String!
        value: String!
    }

    type CollectionEntryTranslatableField {
        fieldName: String!
        blockType: String
    }

    input TranslationEntryInput {
        contentBlockId: ID
        entryId: ID
        fieldName: String!
        value: String!
    }

    input UpdateCmsPageTranslationsInput {
        pageId: ID!
        languageCode: String!
        entries: [TranslationEntryInput!]!
    }

    input UpdateCollectionEntryTranslationsInput {
        pageId: ID!
        entryId: ID!
        languageCode: String!
        entries: [TranslationEntryInput!]!
    }

    extend type Query {
        translationLanguages: [TranslationLanguage!]!
        cmsPageTranslatableFields(pageId: ID!): [TranslatableField!]!
        cmsPageTranslations(pageId: ID!, languageCode: String): [PageTranslations!]!
        cmsPageDefaultContent(pageId: ID!): [DefaultContentEntry!]!
        collectionEntryTranslatableFields(pageId: ID!): [CollectionEntryTranslatableField!]!
        collectionEntryTranslations(pageId: ID!, entryId: ID!, languageCode: String): [PageTranslations!]!
        collectionEntryDefaultContent(pageId: ID!, entryId: ID!): [DefaultContentEntry!]!
    }

    extend type Mutation {
        setTranslationLanguages(input: [TranslationLanguageInput!]!): [TranslationLanguage!]!
        updateCmsPageTranslations(input: UpdateCmsPageTranslationsInput!): [CmsTranslationEntry!]!
        updateCollectionEntryTranslations(input: UpdateCollectionEntryTranslationsInput!): [CmsTranslationEntry!]!
    }
`;

export const shopApiExtensions = gql`
    type CmsTranslationEntry {
        id: ID!
        languageCode: String!
        pageId: ID!
        contentBlockId: ID
        fieldName: String!
        value: String!
    }

    type PageTranslations {
        pageId: ID!
        languageCode: String!
        entries: [CmsTranslationEntry!]!
    }

    extend type Query {
        cmsPageTranslations(pageId: ID!, languageCode: String!): PageTranslations
        cmsPageTranslationsByKey(pageKey: String!, languageCode: String!): PageTranslations
        collectionEntryTranslations(pageId: ID!, entryId: ID!, languageCode: String!): PageTranslations
    }
`;
