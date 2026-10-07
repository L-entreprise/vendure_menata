import { gql } from 'graphql-tag';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
    createPluginTestEnvironment,
    initialData,
    TEST_SETUP_TIMEOUT_MS,
    waitFor,
} from '../../../deploy/e2e/test-environment';
import { AuditLogPlugin } from '../../audit-log-plugin/audit-log.plugin';
import { CmsPlugin } from '../../cms-plugin/cms.plugin';
import { TranslationPlugin } from '../translation.plugin';

const LANGUAGES = gql`
    query {
        translationLanguages {
            code
            isDefault
            enabled
        }
    }
`;

const CREATE_PAGE = gql`
    mutation CreateCmsPage($input: CreateCmsPageInput!) {
        createCmsPage(input: $input) {
            id
        }
    }
`;

const TRANSLATABLE_FIELDS = gql`
    query Fields($pageId: ID!) {
        cmsPageTranslatableFields(pageId: $pageId) {
            contentBlockId
            fieldName
            blockKey
        }
    }
`;

const UPDATE_TRANSLATIONS = gql`
    mutation Update($input: UpdateCmsPageTranslationsInput!) {
        updateCmsPageTranslations(input: $input) {
            fieldName
            value
        }
    }
`;

const SHOP_TRANSLATIONS_BY_KEY = gql`
    query ByKey($pageKey: String!, $languageCode: String!) {
        cmsPageTranslationsByKey(pageKey: $pageKey, languageCode: $languageCode) {
            languageCode
            entries {
                fieldName
                value
                blockKey
            }
        }
    }
`;

const AUDIT_LOG = gql`
    query AuditLog($options: AuditLogEntryListOptions) {
        auditLog(options: $options) {
            items {
                detail
            }
        }
    }
`;

type Field = { contentBlockId: string | null; fieldName: string; blockKey: string | null };

function pageWithTitle(key: string, enabled = true) {
    return {
        key,
        enabled,
        translations: [{ languageCode: 'en', name: key, slug: key }],
        contentBlocks: [
            {
                key: 'title',
                type: 'TEXT_SHORT',
                position: 0,
                translations: [{ languageCode: 'en', name: 'Title', textContent: 'Welcome' }],
            },
        ],
    };
}

describe('TranslationPlugin', () => {
    const { server, adminClient, shopClient } = createPluginTestEnvironment({
        plugins: [
            AuditLogPlugin.init({}),
            CmsPlugin,
            TranslationPlugin.init({
                languages: [
                    { code: 'en', name: 'English', isDefault: true },
                    { code: 'fr', name: 'French' },
                ],
            }),
        ],
    });

    let pageId: string;
    let titleField: Field;

    beforeAll(async () => {
        await server.init({ initialData, customerCount: 0 });
        await adminClient.asSuperAdmin();

        const { createCmsPage } = await adminClient.query(CREATE_PAGE, { input: pageWithTitle('about') });
        pageId = createCmsPage.id;
        const { cmsPageTranslatableFields } = await adminClient.query(TRANSLATABLE_FIELDS, { pageId });
        titleField = cmsPageTranslatableFields.find((f: Field) => f.blockKey === 'title');
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    it('seeds the configured languages on bootstrap', async () => {
        const { translationLanguages } = await adminClient.query(LANGUAGES);

        expect(translationLanguages).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ code: 'en', isDefault: true, enabled: true }),
                expect.objectContaining({ code: 'fr', isDefault: false, enabled: true }),
            ]),
        );
    });

    it('lists the page fields and the text block as translatable', async () => {
        const { cmsPageTranslatableFields } = await adminClient.query(TRANSLATABLE_FIELDS, { pageId });
        const names = cmsPageTranslatableFields.map((f: Field) => `${f.blockKey ?? 'page'}.${f.fieldName}`);

        expect(names).toEqual(expect.arrayContaining(['page.name', 'page.slug', 'title.textContent']));
    });

    it('serves a saved translation on the Shop API, keyed by block', async () => {
        await adminClient.query(UPDATE_TRANSLATIONS, {
            input: {
                pageId,
                languageCode: 'fr',
                entries: [
                    { fieldName: 'name', value: 'À propos' },
                    { contentBlockId: titleField.contentBlockId, fieldName: 'textContent', value: 'Bienvenue' },
                ],
            },
        });

        const { cmsPageTranslationsByKey } = await shopClient.query(SHOP_TRANSLATIONS_BY_KEY, {
            pageKey: 'about',
            languageCode: 'fr',
        });

        expect(cmsPageTranslationsByKey.entries).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ fieldName: 'name', value: 'À propos', blockKey: null }),
                expect.objectContaining({ fieldName: 'textContent', value: 'Bienvenue', blockKey: 'title' }),
            ]),
        );
    });

    it('records the translation change in the audit log', async () => {
        const { auditLog } = await waitFor(
            () =>
                adminClient.query(AUDIT_LOG, {
                    options: { filter: { action: { eq: 'TranslationUpdated' } } },
                }),
            r => r.auditLog.items.length > 0,
        );

        expect(auditLog.items[0].detail.languageCode).toBe('fr');
    });

    it('refuses to write the default language, which the CMS owns', async () => {
        await expect(
            adminClient.query(UPDATE_TRANSLATIONS, {
                input: { pageId, languageCode: 'en', entries: [{ fieldName: 'name', value: 'x' }] },
            }),
        ).rejects.toThrow('Default-language translations are managed in the CMS.');
    });

    it('does not expose the translations of a disabled page', async () => {
        await adminClient.query(CREATE_PAGE, { input: pageWithTitle('hidden', false) });

        const { cmsPageTranslationsByKey } = await shopClient.query(SHOP_TRANSLATIONS_BY_KEY, {
            pageKey: 'hidden',
            languageCode: 'fr',
        });

        expect(cmsPageTranslationsByKey).toBeNull();
    });
});
