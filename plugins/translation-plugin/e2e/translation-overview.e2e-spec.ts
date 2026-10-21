import { gql } from 'graphql-tag';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createPluginTestEnvironment, initialData, TEST_SETUP_TIMEOUT_MS } from '../../../deploy/e2e/test-environment';
import { AuditLogPlugin } from '../../audit-log-plugin/audit-log.plugin';
import { CmsPlugin } from '../../cms-plugin/cms.plugin';
import { TranslationPlugin } from '../translation.plugin';

const CREATE_PAGE = gql`
    mutation CreateCmsPage($input: CreateCmsPageInput!) {
        createCmsPage(input: $input) {
            id
            contentBlocks {
                id
                key
            }
        }
    }
`;

const CREATE_ENTRY = gql`
    mutation CreateEntry($input: CreateCollectionEntryInput!) {
        createCollectionEntry(input: $input) {
            id
        }
    }
`;

const UPDATE_PAGE_TRANSLATIONS = gql`
    mutation UpdatePage($input: UpdateCmsPageTranslationsInput!) {
        updateCmsPageTranslations(input: $input) {
            id
        }
    }
`;

const UPDATE_ENTRY_TRANSLATIONS = gql`
    mutation UpdateEntry($input: UpdateCollectionEntryTranslationsInput!) {
        updateCollectionEntryTranslations(input: $input) {
            id
        }
    }
`;

const PROGRESS = gql`
    query Progress($pageIds: [ID!]!) {
        cmsTranslationProgress(pageIds: $pageIds) {
            pageId
            languageCode
            total
            translated
        }
    }
`;

const ENTRIES_TRANSLATIONS = gql`
    query Entries($pageId: ID!) {
        collectionEntriesTranslations(pageId: $pageId) {
            entryId
            languageCode
            entries {
                fieldName
                value
            }
        }
    }
`;

const SHOP_TRANSLATIONS_BY_KEY = gql`
    query ByKey($pageKey: String!, $languageCode: String!) {
        cmsPageTranslationsByKey(pageKey: $pageKey, languageCode: $languageCode) {
            entries {
                fieldName
                value
                blockKey
            }
        }
    }
`;

type Progress = { pageId: string; languageCode: string; total: number; translated: number };

function textBlock(key: string, position: number, textContent: string) {
    return { key, type: 'TEXT_SHORT', position, translations: [{ languageCode: 'en', name: key, textContent }] };
}

function progressOf(rows: Progress[], pageId: string, languageCode: string) {
    const row = rows.find(r => r.pageId === pageId && r.languageCode === languageCode);
    return row && { total: row.total, translated: row.translated };
}

describe('TranslationPlugin dashboard overview', () => {
    const { server, adminClient, shopClient } = createPluginTestEnvironment({
        plugins: [
            AuditLogPlugin.init({}),
            CmsPlugin,
            TranslationPlugin.init({
                languages: [
                    { code: 'en', name: 'English', isDefault: true },
                    { code: 'fr', name: 'French' },
                    { code: 'de', name: 'German' },
                ],
            }),
        ],
    });

    let homeId: string;
    let titleBlockId: string;
    let faqId: string;
    let firstEntryId: string;
    let secondEntryId: string;

    beforeAll(async () => {
        await server.init({ initialData, customerCount: 0 });
        await adminClient.asSuperAdmin();

        const { createCmsPage: home } = await adminClient.query(CREATE_PAGE, {
            input: {
                key: 'home',
                enabled: true,
                translations: [{ languageCode: 'en', name: 'Home', slug: 'home' }],
                contentBlocks: [textBlock('title', 0, 'Welcome'), textBlock('empty', 1, '  ')],
            },
        });
        homeId = home.id;
        titleBlockId = home.contentBlocks.find((b: { key: string }) => b.key === 'title').id;

        const { createCmsPage: faq } = await adminClient.query(CREATE_PAGE, {
            input: {
                key: 'faq',
                enabled: true,
                isCollection: true,
                translations: [{ languageCode: 'en', name: 'FAQ', slug: 'faq' }],
                contentBlocks: [textBlock('question', 0, ''), { ...textBlock('answer', 1, ''), type: 'TEXT_LONG' }],
            },
        });
        faqId = faq.id;
        const first = await adminClient.query(CREATE_ENTRY, {
            input: { pageId: faqId, data: { question: 'Opening hours?', answer: '8 to 18' } },
        });
        firstEntryId = first.createCollectionEntry.id;
        const second = await adminClient.query(CREATE_ENTRY, {
            input: { pageId: faqId, data: { question: 'Parking?', answer: '' } },
        });
        secondEntryId = second.createCollectionEntry.id;
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    it('counts the fields with source text per language, without the page name and slug', async () => {
        await adminClient.query(UPDATE_PAGE_TRANSLATIONS, {
            input: { pageId: homeId, languageCode: 'fr', entries: [{ fieldName: 'name', value: 'Accueil' }] },
        });

        const { cmsTranslationProgress } = await adminClient.query(PROGRESS, { pageIds: [homeId] });

        expect(progressOf(cmsTranslationProgress, homeId, 'fr')).toEqual({ total: 1, translated: 0 });
        expect(progressOf(cmsTranslationProgress, homeId, 'de')).toEqual({ total: 1, translated: 0 });
        expect(progressOf(cmsTranslationProgress, homeId, 'en')).toBeUndefined();
    });

    it('counts a translated field in its language only', async () => {
        await adminClient.query(UPDATE_PAGE_TRANSLATIONS, {
            input: {
                pageId: homeId,
                languageCode: 'fr',
                entries: [{ contentBlockId: titleBlockId, fieldName: 'textContent', value: 'Bienvenue' }],
            },
        });

        const { cmsTranslationProgress } = await adminClient.query(PROGRESS, { pageIds: [homeId] });

        expect(progressOf(cmsTranslationProgress, homeId, 'fr')).toEqual({ total: 1, translated: 1 });
        expect(progressOf(cmsTranslationProgress, homeId, 'de')).toEqual({ total: 1, translated: 0 });
    });

    it('counts every entry of a list, and pages are reported separately', async () => {
        await adminClient.query(UPDATE_ENTRY_TRANSLATIONS, {
            input: {
                pageId: faqId,
                entryId: firstEntryId,
                languageCode: 'de',
                entries: [{ fieldName: 'question', value: 'Öffnungszeiten?' }],
            },
        });

        const { cmsTranslationProgress } = await adminClient.query(PROGRESS, { pageIds: [homeId, faqId] });

        expect(progressOf(cmsTranslationProgress, faqId, 'de')).toEqual({ total: 3, translated: 1 });
        expect(progressOf(cmsTranslationProgress, faqId, 'fr')).toEqual({ total: 3, translated: 0 });
        expect(progressOf(cmsTranslationProgress, homeId, 'de')).toEqual({ total: 1, translated: 0 });
    });

    it('returns every list entry in creation order, default language from the entry data', async () => {
        const { collectionEntriesTranslations } = await adminClient.query(ENTRIES_TRANSLATIONS, { pageId: faqId });

        expect(collectionEntriesTranslations).toEqual([
            {
                entryId: firstEntryId,
                languageCode: 'en',
                entries: [
                    { fieldName: 'question', value: 'Opening hours?' },
                    { fieldName: 'answer', value: '8 to 18' },
                ],
            },
            { entryId: firstEntryId, languageCode: 'de', entries: [{ fieldName: 'question', value: 'Öffnungszeiten?' }] },
            {
                entryId: secondEntryId,
                languageCode: 'en',
                entries: [
                    { fieldName: 'question', value: 'Parking?' },
                    { fieldName: 'answer', value: '' },
                ],
            },
        ]);
    });

    it('keeps serving the default language on the Shop API from the CMS content', async () => {
        const { cmsPageTranslationsByKey } = await shopClient.query(SHOP_TRANSLATIONS_BY_KEY, {
            pageKey: 'home',
            languageCode: 'en',
        });

        expect(cmsPageTranslationsByKey.entries).toEqual([
            { fieldName: 'name', value: 'Home', blockKey: null },
            { fieldName: 'slug', value: 'home', blockKey: null },
            { fieldName: 'textContent', value: 'Welcome', blockKey: 'title' },
            { fieldName: 'textContent', value: '  ', blockKey: 'empty' },
        ]);
    });
});
