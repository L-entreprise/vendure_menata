import { gql } from 'graphql-tag';

export const adminApiExtensions = gql`
    "Translation progress of a product in one target language of the channel."
    type LanguageProgress {
        languageCode: LanguageCode!
        "Fields with original text (default language)."
        total: Int!
        "Of those, fields filled in this language."
        translated: Int!
        "Untranslated fields: name, description, customFields.<name>, variant:<id>:name."
        missing: [String!]!
    }

    type ProductTranslationSummary {
        languageCode: LanguageCode!
        incompleteProducts: Int!
    }

    extend type Product {
        translationProgress: [LanguageProgress!]!
    }

    extend type Query {
        productTranslationSummary: [ProductTranslationSummary!]!
    }
`;
