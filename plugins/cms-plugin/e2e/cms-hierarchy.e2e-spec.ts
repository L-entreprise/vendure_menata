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
            parentId
            previewUrl
        }
    }
`;

const UPDATE_PAGE = gql`
    mutation UpdateCmsPage($input: UpdateCmsPageInput!) {
        updateCmsPage(input: $input) {
            id
            parentId
            previewUrl
        }
    }
`;

const DELETE_PAGE = gql`
    mutation DeleteCmsPage($id: ID!) {
        deleteCmsPage(id: $id) {
            result
        }
    }
`;

const ADMIN_PAGE = gql`
    query CmsPage($id: ID!) {
        cmsPage(id: $id) {
            id
            key
            parentId
            parent {
                id
                key
            }
            children {
                id
                key
            }
        }
    }
`;

const ADMIN_PAGES = gql`
    query CmsPages($options: CmsPageListOptions) {
        cmsPages(options: $options) {
            items {
                key
            }
            totalItems
        }
    }
`;

const PINNED_PAGES = gql`
    query PinnedCmsPages {
        pinnedCmsPages {
            key
        }
    }
`;

const SHOP_PAGE_BY_KEY = gql`
    query CmsPageByKey($key: String!) {
        cmsPageByKey(key: $key) {
            key
            contentBlocks {
                key
                textContent
            }
        }
    }
`;

const SHOP_PAGE_PARENT_ID = gql`
    query CmsPageParentId($key: String!) {
        cmsPageByKey(key: $key) {
            parentId
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

describe('CmsPlugin page hierarchy', () => {
    const { server, adminClient, shopClient } = createPluginTestEnvironment({
        plugins: [AuditLogPlugin.init({}), CmsPlugin],
    });

    async function createPage(key: string, extra: Record<string, unknown> = {}) {
        const { createCmsPage } = await adminClient.query(CREATE_PAGE, { input: pageInput(key, extra) });
        return createCmsPage as { id: string; key: string; parentId: string | null; previewUrl: string | null };
    }

    beforeAll(async () => {
        await server.init({ initialData, customerCount: 0 });
        await adminClient.asSuperAdmin();
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    describe('parent and children', () => {
        let parentId: string;
        let childId: string;

        beforeAll(async () => {
            parentId = (await createPage('faq-page')).id;
            childId = (await createPage('faq-questions', { isCollection: true, parentId })).id;
        });

        it('creates a page under a parent', async () => {
            const { cmsPage } = await adminClient.query(ADMIN_PAGE, { id: childId });

            expect(cmsPage.parentId).toBe(parentId);
            expect(cmsPage.parent).toEqual({ id: parentId, key: 'faq-page' });
        });

        it('lists the children of a parent', async () => {
            const { cmsPage } = await adminClient.query(ADMIN_PAGE, { id: parentId });

            expect(cmsPage.parentId).toBeNull();
            expect(cmsPage.children).toEqual([{ id: childId, key: 'faq-questions' }]);
        });

        it('lists only top-level pages when filtering on a missing parent', async () => {
            const { cmsPages } = await adminClient.query(ADMIN_PAGES, {
                options: { filter: { parentId: { isNull: true } } },
            });
            const keys = cmsPages.items.map((p: any) => p.key);

            expect(keys).toContain('faq-page');
            expect(keys).not.toContain('faq-questions');
        });

        it('attaches an existing page and detaches it with null', async () => {
            const loose = await createPage('loose-list');

            const attached = await adminClient.query(UPDATE_PAGE, { input: { id: loose.id, parentId } });
            const detached = await adminClient.query(UPDATE_PAGE, { input: { id: loose.id, parentId: null } });

            expect(attached.updateCmsPage.parentId).toBe(parentId);
            expect(detached.updateCmsPage.parentId).toBeNull();
        });

        it('keeps the parent when an update does not mention it', async () => {
            const { updateCmsPage } = await adminClient.query(UPDATE_PAGE, {
                input: { id: childId, enabled: true },
            });

            expect(updateCmsPage.parentId).toBe(parentId);
        });

        it('records a parent change in the audit log', async () => {
            const page = await createPage('audited-list');
            await adminClient.query(UPDATE_PAGE, { input: { id: page.id, parentId } });

            const findEntry = (r: any) => r.auditLog.items.find((e: any) => e.detail?.key === 'audited-list');
            const result = await waitFor(
                () =>
                    adminClient.query(AUDIT_LOG, {
                        options: { filter: { action: { eq: 'CmsPageUpdated' } } },
                    }),
                r => !!findEntry(r),
            );

            // The log stores the raw database id, not the API-encoded one the test client sees
            expect(findEntry(result).detail.changes.parentId).toEqual({ from: null, to: expect.any(String) });
        });
    });

    describe('invalid parents', () => {
        let rootId: string;
        let childId: string;

        beforeAll(async () => {
            rootId = (await createPage('root-a')).id;
            childId = (await createPage('child-a', { parentId: rootId })).id;
        });

        it('refuses a page as its own parent', async () => {
            await expect(
                adminClient.query(UPDATE_PAGE, { input: { id: rootId, parentId: rootId } }),
            ).rejects.toThrow('cannot be its own parent');
        });

        it('refuses a parent that is itself a child', async () => {
            await expect(createPage('grandchild', { parentId: childId })).rejects.toThrow(
                'must be a top-level page',
            );
        });

        it('refuses to move a page that has children under another page', async () => {
            const otherRoot = await createPage('root-b');

            await expect(
                adminClient.query(UPDATE_PAGE, { input: { id: rootId, parentId: otherRoot.id } }),
            ).rejects.toThrow('has child pages');
        });

        it('refuses an unknown parent', async () => {
            await expect(createPage('orphan', { parentId: '99999' })).rejects.toThrow('No CMS page');
        });
    });

    describe('deleting a parent', () => {
        it('detaches its children instead of deleting them', async () => {
            const parent = await createPage('to-delete');
            const child = await createPage('survivor', { parentId: parent.id });

            await adminClient.query(DELETE_PAGE, { id: parent.id });
            const { cmsPage } = await adminClient.query(ADMIN_PAGE, { id: child.id });

            expect(cmsPage).toMatchObject({ key: 'survivor', parentId: null, parent: null });
        });
    });

    describe('sidebar', () => {
        it('pins only top-level pages', async () => {
            const root = await createPage('pinned-root', { pinnedInSidebar: true });
            await createPage('pinned-child', { pinnedInSidebar: true, parentId: root.id });

            const { pinnedCmsPages } = await adminClient.query(PINNED_PAGES);
            const keys = pinnedCmsPages.map((p: any) => p.key);

            expect(keys).toContain('pinned-root');
            expect(keys).not.toContain('pinned-child');
        });
    });

    describe('preview URL', () => {
        it('stores an absolute http(s) address', async () => {
            const page = await createPage('previewed', { previewUrl: ' https://example.com/maintenance ' });

            expect(page.previewUrl).toBe('https://example.com/maintenance');
        });

        it('clears the address with an empty string', async () => {
            const page = await createPage('preview-cleared', { previewUrl: 'https://example.com/a' });

            const { updateCmsPage } = await adminClient.query(UPDATE_PAGE, {
                input: { id: page.id, previewUrl: '' },
            });

            expect(updateCmsPage.previewUrl).toBeNull();
        });

        it('refuses a non-http address', async () => {
            await expect(createPage('bad-preview', { previewUrl: 'javascript:alert(1)' })).rejects.toThrow(
                'absolute http(s) address',
            );
        });
    });

    describe('Shop API', () => {
        it('still serves a child page by its key', async () => {
            const parent = await createPage('shop-parent');
            await createPage('shop-child', {
                parentId: parent.id,
                contentBlocks: [
                    {
                        key: 'delay',
                        type: 'TEXT_SHORT',
                        position: 0,
                        translations: [{ languageCode: 'en', name: 'Delay', textContent: '48 h' }],
                    },
                ],
            });

            const { cmsPageByKey } = await shopClient.query(SHOP_PAGE_BY_KEY, { key: 'shop-child' });

            expect(cmsPageByKey).toEqual({
                key: 'shop-child',
                contentBlocks: [{ key: 'delay', textContent: '48 h' }],
            });
        });

        it('does not expose the hierarchy', async () => {
            await expect(shopClient.query(SHOP_PAGE_PARENT_ID, { key: 'shop-child' })).rejects.toThrow(
                'Cannot query field "parentId"',
            );
        });
    });
});
