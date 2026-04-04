import { ID } from '@vendure/common/lib/shared-types';

export interface TranslationLanguageInput {
    code: string;
    name: string;
    enabled?: boolean;
    isDefault?: boolean;
    position?: number;
}

export interface TranslationEntryInput {
    contentBlockId?: ID | null;
    entryId?: ID | null;
    fieldName: string;
    value: string;
}

export interface UpdateCmsPageTranslationsInput {
    pageId: ID;
    languageCode: string;
    entries: TranslationEntryInput[];
}

export interface UpdateCollectionEntryTranslationsInput {
    pageId: ID;
    entryId: ID;
    languageCode: string;
    entries: TranslationEntryInput[];
}
