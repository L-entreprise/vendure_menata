import { ID } from '@vendure/common/lib/shared-types';
import { LanguageCode } from '@vendure/core';

export interface ContentBlockTranslationInput {
    id?: ID;
    languageCode: LanguageCode;
    name: string;
    textContent?: string;
    altText?: string;
}

export interface CreateContentBlockInput {
    key: string;
    type: string;
    enabled?: boolean;
    featuredAssetId?: ID;
    metadata?: Record<string, unknown>;
    translations: ContentBlockTranslationInput[];
}

export interface UpdateContentBlockInput {
    id: ID;
    key?: string;
    enabled?: boolean;
    featuredAssetId?: ID;
    metadata?: Record<string, unknown>;
    translations?: ContentBlockTranslationInput[];
}

export interface CmsPageTranslationInput {
    id?: ID;
    languageCode: LanguageCode;
    name: string;
    slug: string;
}

export interface UpdatePageContentBlockInput {
    id?: ID;
    type: string;
    key: string;
    position: number;
    enabled?: boolean;
    featuredAssetId?: ID;
    metadata?: Record<string, unknown>;
    dateValue?: string;
    numberValue?: number;
    translations?: ContentBlockTranslationInput[];
}

export interface CreateCmsPageInput {
    key: string;
    enabled?: boolean;
    acceptsSubmissions?: boolean;
    translations: CmsPageTranslationInput[];
    contentBlocks?: UpdatePageContentBlockInput[];
}

export interface UpdateCmsPageInput {
    id: ID;
    key?: string;
    enabled?: boolean;
    acceptsSubmissions?: boolean;
    translations?: CmsPageTranslationInput[];
    contentBlocks?: UpdatePageContentBlockInput[];
}

export interface SubmitFormInput {
    pageKey: string;
    fields: Record<string, unknown>;
}

export interface ListQueryArgs {
    options?: any;
}
