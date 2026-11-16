import { gql } from 'graphql-tag';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createPluginTestEnvironment, initialData, TEST_SETUP_TIMEOUT_MS } from '../../../deploy/e2e/test-environment';
import { AuditLogPlugin } from '../../audit-log-plugin/audit-log.plugin';
import { CmsPlugin } from '../cms.plugin';

/**
 * The CMS on Vendure's native translations: the content language of an Admin API call
 * (`?languageCode=`) picks the translation row that is written, and the Shop API falls
 * back field by field to the channel's default language.
 */

const SET_LANGUAGES = gql`
    mutation SetLanguages($codes: [LanguageCode!]!) {
        updateGlobalSettings(input: { availableLanguages: $codes }) {
            ... on GlobalSettings {
                id
            }
        }
        updateChannel(input: { id: "T_1", availableLanguageCodes: $codes, defaultLanguageCode: en }) {
            ... on Channel {
                id
            }
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

const UPDATE_PAGE = gql`
    mutation UpdateCmsPage($input: UpdateCmsPageInput!) {
        updateCmsPage(input: $input) {
            id
        }
    }
`;

const ADMIN_PAGE = gql`
    query AdminPage($id: ID!) {
        cmsPage(id: $id) {
            id
            translations {
                languageCode
                name
                slug
            }
            contentBlocks {
                id
                key
                type
                position
                translations {
                    languageCode
                    name
                    textContent
                    translatedMetadata
                }
            }
        }
    }
`;

const ADMIN_PAGE_METADATA = gql`
    query AdminPageMetadata($id: ID!) {
        cmsPage(id: $id) {
            contentBlocks {
                key
                metadata
            }
        }
    }
`;

const SHOP_PAGE = gql`
    query ShopPage($key: String!) {
        cmsPageByKey(key: $key) {
            name
            contentBlocks {
                key
                textContent
                metadata
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

const UPDATE_ENTRY = gql`
    mutation UpdateEntry($input: UpdateCollectionEntryInput!) {
        updateCollectionEntry(input: $input) {
            id
        }
    }
`;

const ADMIN_ENTRIES = gql`
    query AdminEntries($pageId: ID!) {
        formSubmissions(pageId: $pageId) {
            items {
                id
                data
                translations {
                    languageCode
                    data
                }
            }
        }
    }
`;

const SHOP_ENTRIES = gql`
    query ShopEntries($pageKey: String!) {
        collectionEntries(pageKey: $pageKey) {
            items {
                data
            }
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

const PROGRESS_PARTS = gql`
    query ProgressParts($pageIds: [ID!]!) {
        cmsTranslationProgress(pageIds: $pageIds) {
            languageCode
            total
            translated
            parts {
                pageId
                name
                advanced
                total
                translated
            }
        }
    }
`;

const PAGE_LIST_PROGRESS = gql`
    query PageListProgress {
        cmsPages {
            items {
                id
                translationProgress {
                    languageCode
                    total
                    translated
                }
            }
        }
    }
`;

const CREATE_ROLE = gql`
    mutation CreateRole($input: CreateRoleInput!) {
        createRole(input: $input) {
            id
        }
    }
`;

const CREATE_ADMIN = gql`
    mutation CreateAdmin($input: CreateAdministratorInput!) {
        createAdministrator(input: $input) {
            id
        }
    }
`;

const textBlock = (key: string, text: string, position: number) => ({
    key,
    type: 'TEXT_SHORT',
    position,
    translations: [{ languageCode: 'en', name: key, textContent: text }],
});

describe('CMS on native translations', () => {
    const { server, adminClient, shopClient } = createPluginTestEnvironment({
        plugins: [AuditLogPlugin.init({}), CmsPlugin],
    });
    let pageId: string;
    let blocks: Array<{ id: string; key: string; type: string; position: number }>;

    beforeAll(async () => {
        await server.init({ initialData, customerCount: 0 });
        await adminClient.asSuperAdmin();
        await adminClient.query(SET_LANGUAGES, { codes: ['en', 'fr', 'de'] });
        const { createCmsPage } = await adminClient.query(CREATE_PAGE, {
            input: {
                key: 'about',
                translations: [{ languageCode: 'en', name: 'About', slug: 'about' }],
                contentBlocks: [textBlock('title', 'Welcome', 0), textBlock('body', 'Body text', 1)],
            },
        });
        pageId = createCmsPage.id;
        const { cmsPage } = await adminClient.query(ADMIN_PAGE, { id: pageId });
        blocks = cmsPage.contentBlocks;
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    const blockInput = (key: string, row: Record<string, unknown>) => {
        const block = blocks.find(b => b.key === key)!;
        return { id: block.id, key, type: block.type, position: block.position, translations: [row] };
    };

    describe('page blocks', () => {
        beforeAll(async () => {
            await adminClient.query(
                UPDATE_PAGE,
                {
                    input: {
                        id: pageId,
                        contentBlocks: [
                            blockInput('title', {
                                languageCode: 'fr',
                                name: 'Titre',
                                textContent: 'Bienvenue',
                                translatedMetadata: { description: 'Légende' },
                            }),
                            blockInput('body', { languageCode: 'fr', name: 'Corps', textContent: '' }),
                        ],
                    },
                },
                { languageCode: 'fr' },
            );
        });

        it('keeps the default-language row when another language is saved', async () => {
            const { cmsPage } = await adminClient.query(ADMIN_PAGE, { id: pageId });
            const title = cmsPage.contentBlocks.find((b: any) => b.key === 'title');
            expect(title.translations).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ languageCode: 'en', textContent: 'Welcome' }),
                    expect.objectContaining({
                        languageCode: 'fr',
                        textContent: 'Bienvenue',
                        translatedMetadata: { description: 'Légende' },
                    }),
                ]),
            );
        });

        it('keeps the original image texts on the Admin API, whatever the content language', async () => {
            const { cmsPage } = await adminClient.query(ADMIN_PAGE_METADATA, { id: pageId }, { languageCode: 'fr' });
            const title = cmsPage.contentBlocks.find((b: any) => b.key === 'title');
            expect(title.metadata?.description).toBeUndefined();
        });

        it('serves each language with per-field fallback to the default language', async () => {
            const fr = await shopClient.query(SHOP_PAGE, { key: 'about' }, { languageCode: 'fr' });
            expect(fr.cmsPageByKey.contentBlocks.map((b: any) => [b.key, b.textContent])).toEqual([
                ['title', 'Bienvenue'],
                ['body', 'Body text'],
            ]);
            expect(fr.cmsPageByKey.contentBlocks[0].metadata).toMatchObject({ description: 'Légende' });
            expect(fr.cmsPageByKey.name).toBe('About');

            const de = await shopClient.query(SHOP_PAGE, { key: 'about' }, { languageCode: 'de' });
            expect(de.cmsPageByKey.contentBlocks.map((b: any) => b.textContent)).toEqual(['Welcome', 'Body text']);
        });

        it('counts translated fields per language', async () => {
            const { cmsTranslationProgress } = await adminClient.query(PROGRESS, { pageIds: [pageId] });
            expect(cmsTranslationProgress).toEqual(
                expect.arrayContaining([
                    { pageId, languageCode: 'fr', total: 2, translated: 1 },
                    { pageId, languageCode: 'de', total: 2, translated: 0 },
                ]),
            );
            expect(cmsTranslationProgress).toHaveLength(2);
        });

        it('exposes the progress on the page list', async () => {
            const { cmsPages } = await adminClient.query(PAGE_LIST_PROGRESS);
            const about = cmsPages.items.find((p: any) => p.id === pageId);
            expect(about.translationProgress).toEqual(
                expect.arrayContaining([{ languageCode: 'fr', total: 2, translated: 1 }]),
            );
        });
    });

    describe('collection entries', () => {
        let listId: string;
        let entryId: string;

        beforeAll(async () => {
            const { createCmsPage } = await adminClient.query(CREATE_PAGE, {
                input: {
                    key: 'oils',
                    isCollection: true,
                    translations: [{ languageCode: 'en', name: 'Oils', slug: 'oils' }],
                    contentBlocks: [
                        { key: 'name', type: 'TEXT_SHORT', position: 0, translations: [{ languageCode: 'en', name: 'Name' }] },
                        { key: 'price', type: 'NUMBER', position: 1, translations: [{ languageCode: 'en', name: 'Price' }] },
                    ],
                },
            });
            listId = createCmsPage.id;
            const { createCollectionEntry } = await adminClient.query(CREATE_ENTRY, {
                input: { pageId: listId, data: { name: 'Engine oil', price: 12 } },
            });
            entryId = createCollectionEntry.id;
            await adminClient.query(
                UPDATE_ENTRY,
                { input: { id: entryId, data: { name: 'Huile moteur', price: 15 } } },
                { languageCode: 'fr' },
            );
        });

        it('stores texts per language and structural values on the entry', async () => {
            const { formSubmissions } = await adminClient.query(ADMIN_ENTRIES, { pageId: listId });
            expect(formSubmissions.items[0].data).toEqual({ name: 'Engine oil', price: 15 });
            expect(formSubmissions.items[0].translations).toEqual([
                { languageCode: 'fr', data: { name: 'Huile moteur' } },
            ]);
        });

        it('serves entries per language with fallback', async () => {
            const fr = await shopClient.query(SHOP_ENTRIES, { pageKey: 'oils' }, { languageCode: 'fr' });
            expect(fr.collectionEntries.items[0].data).toEqual({ name: 'Huile moteur', price: 15 });
            const de = await shopClient.query(SHOP_ENTRIES, { pageKey: 'oils' }, { languageCode: 'de' });
            expect(de.collectionEntries.items[0].data).toEqual({ name: 'Engine oil', price: 15 });
        });

        it('counts entry texts in the list progress', async () => {
            const { cmsTranslationProgress } = await adminClient.query(PROGRESS, { pageIds: [listId] });
            expect(cmsTranslationProgress).toEqual(
                expect.arrayContaining([
                    { pageId: listId, languageCode: 'fr', total: 1, translated: 1 },
                    { pageId: listId, languageCode: 'de', total: 1, translated: 0 },
                ]),
            );
        });
    });

    describe('child pages (tabs)', () => {
        let parentId: string;
        let childId: string;

        beforeAll(async () => {
            const parent = await adminClient.query(CREATE_PAGE, {
                input: {
                    key: 'site',
                    translations: [{ languageCode: 'en', name: 'Site settings', slug: 'site' }],
                    contentBlocks: [textBlock('phone', '+33 3 88', 0), textBlock('city', 'Haguenau', 1)],
                },
            });
            parentId = parent.createCmsPage.id;
            const child = await adminClient.query(CREATE_PAGE, {
                input: {
                    key: 'site-ui',
                    parentId,
                    advanced: true,
                    translations: [{ languageCode: 'en', name: 'Interface texts', slug: 'site-ui' }],
                    contentBlocks: [textBlock('home', 'Home', 0)],
                },
            });
            childId = child.createCmsPage.id;
            const { cmsPage } = await adminClient.query(ADMIN_PAGE, { id: childId });
            const home = cmsPage.contentBlocks[0];
            await adminClient.query(
                UPDATE_PAGE,
                {
                    input: {
                        id: childId,
                        translations: [{ languageCode: 'fr', name: "Textes de l'interface", slug: 'site-ui' }],
                        contentBlocks: [
                            {
                                id: home.id,
                                key: 'home',
                                type: home.type,
                                position: 0,
                                translations: [{ languageCode: 'fr', name: 'home', textContent: 'Accueil' }],
                            },
                        ],
                    },
                },
                { languageCode: 'fr' },
            );
        });

        it('splits the total into the page and each tab, named in the content language', async () => {
            const { cmsTranslationProgress } = await adminClient.query(
                PROGRESS_PARTS,
                { pageIds: [parentId] },
                { languageCode: 'fr' },
            );
            const fr = cmsTranslationProgress.find((p: any) => p.languageCode === 'fr');
            expect(fr).toEqual({
                languageCode: 'fr',
                total: 3,
                translated: 1,
                parts: [
                    { pageId: parentId, name: 'Site settings', advanced: false, total: 2, translated: 0 },
                    { pageId: childId, name: "Textes de l'interface", advanced: true, total: 1, translated: 1 },
                ],
            });
        });
    });

    describe('editors without SuperAdmin', () => {
        beforeAll(async () => {
            const { createRole } = await adminClient.query(CREATE_ROLE, {
                input: {
                    code: 'cms-editor',
                    description: 'CMS editor',
                    permissions: ['ReadCmsPage', 'UpdateCmsPage'],
                    channelIds: ['T_1'],
                },
            });
            await adminClient.query(CREATE_ADMIN, {
                input: {
                    firstName: 'Ed',
                    lastName: 'Itor',
                    emailAddress: 'editor@test.local',
                    password: 'editor-pass',
                    roleIds: [createRole.id],
                },
            });
            await adminClient.asUserWithCredentials('editor@test.local', 'editor-pass');
            await adminClient.query(
                UPDATE_PAGE,
                {
                    input: {
                        id: pageId,
                        translations: [
                            { languageCode: 'fr', name: 'À propos', slug: 'a-propos' },
                            { languageCode: 'en', name: 'Hacked', slug: 'hacked' },
                        ],
                    },
                },
                { languageCode: 'fr' },
            );
            await adminClient.asSuperAdmin();
        });

        it('may translate the page name and slug, not change the original', async () => {
            const { cmsPage } = await adminClient.query(ADMIN_PAGE, { id: pageId });
            expect(cmsPage.translations).toEqual(
                expect.arrayContaining([
                    { languageCode: 'en', name: 'About', slug: 'about' },
                    { languageCode: 'fr', name: 'À propos', slug: 'a-propos' },
                ]),
            );
        });
    });
});
