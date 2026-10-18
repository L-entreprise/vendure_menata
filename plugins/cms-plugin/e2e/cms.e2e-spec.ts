import { gql } from 'graphql-tag';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
    createPluginTestEnvironment,
    initialData,
    TEST_SETUP_TIMEOUT_MS,
    waitFor,
} from '../../../deploy/e2e/test-environment';
import { AuditLogPlugin } from '../../audit-log-plugin/audit-log.plugin';
import { CmsPlugin } from '../cms.plugin';

const CREATE_PAGE = gql`
    mutation CreateCmsPage($input: CreateCmsPageInput!) {
        createCmsPage(input: $input) {
            id
            key
        }
    }
`;

const SHOP_PAGE_BY_KEY = gql`
    query CmsPageByKey($key: String!) {
        cmsPageByKey(key: $key) {
            key
            name
            slug
            contentBlocks {
                key
                type
                textContent
            }
        }
    }
`;

const SUBMIT_FORM = gql`
    mutation SubmitForm($input: SubmitFormInput!) {
        submitForm(input: $input) {
            success
        }
    }
`;

const FORM_SUBMISSIONS = gql`
    query FormSubmissions($pageId: ID!) {
        formSubmissions(pageId: $pageId) {
            totalItems
            items {
                data
            }
        }
    }
`;

const CREATE_ENTRY = gql`
    mutation CreateCollectionEntry($input: CreateCollectionEntryInput!) {
        createCollectionEntry(input: $input) {
            id
            data
        }
    }
`;

const SHOP_COLLECTION_ENTRIES = gql`
    query CollectionEntries($pageKey: String!) {
        collectionEntries(pageKey: $pageKey) {
            totalItems
            items {
                data
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

function pageInput(key: string, extra: Record<string, unknown> = {}) {
    return {
        key,
        translations: [{ languageCode: 'en', name: key, slug: key }],
        ...extra,
    };
}

describe('CmsPlugin', () => {
    const { server, adminClient, shopClient } = createPluginTestEnvironment({
        plugins: [AuditLogPlugin.init({}), CmsPlugin],
    });

    beforeAll(async () => {
        await server.init({ initialData, customerCount: 0 });
        await adminClient.asSuperAdmin();
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    describe('pages', () => {
        it('serves an enabled page and its blocks on the Shop API', async () => {
            await adminClient.query(CREATE_PAGE, {
                input: pageInput('home', {
                    contentBlocks: [
                        {
                            key: 'title',
                            type: 'TEXT_SHORT',
                            position: 0,
                            translations: [{ languageCode: 'en', name: 'Title', textContent: 'Welcome' }],
                        },
                    ],
                }),
            });

            const { cmsPageByKey } = await shopClient.query(SHOP_PAGE_BY_KEY, { key: 'home' });

            expect(cmsPageByKey).toMatchObject({ key: 'home', slug: 'home' });
            expect(cmsPageByKey.contentBlocks).toEqual([
                { key: 'title', type: 'TEXT_SHORT', textContent: 'Welcome' },
            ]);
        });

        it('hides a disabled page from the Shop API', async () => {
            await adminClient.query(CREATE_PAGE, { input: pageInput('draft', { enabled: false }) });

            const { cmsPageByKey } = await shopClient.query(SHOP_PAGE_BY_KEY, { key: 'draft' });

            expect(cmsPageByKey).toBeNull();
        });

        it('strips scripts and event handlers from rich text (stored XSS)', async () => {
            await adminClient.query(CREATE_PAGE, {
                input: pageInput('rich', {
                    contentBlocks: [
                        {
                            key: 'body',
                            type: 'RICH_TEXT',
                            position: 0,
                            translations: [
                                {
                                    languageCode: 'en',
                                    name: 'Body',
                                    textContent:
                                        '<p onclick="steal()">Hello</p><script>alert(1)</script><strong>ok</strong>',
                                },
                            ],
                        },
                    ],
                }),
            });

            const { cmsPageByKey } = await shopClient.query(SHOP_PAGE_BY_KEY, { key: 'rich' });
            const html = cmsPageByKey.contentBlocks[0].textContent;

            expect(html).not.toContain('<script');
            expect(html).not.toContain('onclick');
            expect(html).toContain('<strong>ok</strong>');
        });

        it('refuses page creation without admin rights', async () => {
            await adminClient.asAnonymousUser();
            await expect(adminClient.query(CREATE_PAGE, { input: pageInput('nope') })).rejects.toThrow();
            await adminClient.asSuperAdmin();
        });
    });

    describe('form submissions', () => {
        let contactPageId: string;

        beforeAll(async () => {
            const { createCmsPage } = await adminClient.query(CREATE_PAGE, {
                input: pageInput('contact', { acceptsSubmissions: true }),
            });
            contactPageId = createCmsPage.id;
        });

        it('accepts a submission from a visitor and shows it to the admin', async () => {
            const fields = { nom: 'Jean Dupont', mail: 'jean@example.com', message: 'Bonjour' };

            const { submitForm } = await shopClient.query(SUBMIT_FORM, {
                input: { pageKey: 'contact', fields },
            });
            const { formSubmissions } = await adminClient.query(FORM_SUBMISSIONS, {
                pageId: contactPageId,
            });

            expect(submitForm.success).toBe(true);
            expect(formSubmissions.items.map((s: any) => s.data)).toContainEqual(fields);
        });

        it('logs only the field names of a submission, never the visitor data', async () => {
            const { auditLog } = await waitFor(
                () =>
                    adminClient.query(AUDIT_LOG, {
                        options: { filter: { action: { eq: 'FormSubmissionCreated' } } },
                    }),
                r => r.auditLog.items.length > 0,
            );
            const detail = auditLog.items[0].detail;

            expect(detail.fields).toEqual(['nom', 'mail', 'message']);
            expect(JSON.stringify(detail)).not.toContain('jean@example.com');
            expect(JSON.stringify(detail)).not.toContain('Jean Dupont');
        });

        it('rejects a submission to a page that does not accept them', async () => {
            await expect(
                shopClient.query(SUBMIT_FORM, { input: { pageKey: 'home', fields: { a: 'b' } } }),
            ).rejects.toThrow('This page does not accept submissions');
        });

        it('rejects prototype-polluting field keys', async () => {
            await expect(
                shopClient.query(SUBMIT_FORM, {
                    input: { pageKey: 'contact', fields: { constructor: 'x' } },
                }),
            ).rejects.toThrow('is not allowed');
        });
    });

    describe('collections', () => {
        let blogPageId: string;

        beforeAll(async () => {
            const { createCmsPage } = await adminClient.query(CREATE_PAGE, {
                input: pageInput('blog', {
                    isCollection: true,
                    contentBlocks: [{ key: 'title', type: 'TEXT_SHORT', position: 0 }],
                }),
            });
            blogPageId = createCmsPage.id;
        });

        it('publishes an entry created by the admin on the Shop API', async () => {
            await adminClient.query(CREATE_ENTRY, {
                input: { pageId: blogPageId, data: { title: 'First post' } },
            });

            const { collectionEntries } = await shopClient.query(SHOP_COLLECTION_ENTRIES, {
                pageKey: 'blog',
            });

            expect(collectionEntries.items.map((e: any) => e.data)).toEqual([{ title: 'First post' }]);
        });

        it('rejects entry fields that are not declared as blocks', async () => {
            await expect(
                adminClient.query(CREATE_ENTRY, {
                    input: { pageId: blogPageId, data: { unknown: 'x' } },
                }),
            ).rejects.toThrow('Unknown field: unknown');
        });
    });
});
