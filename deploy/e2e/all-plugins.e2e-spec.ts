import { gql } from 'graphql-tag';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuditLogPlugin } from '../../plugins/audit-log-plugin/audit-log.plugin';
import { CmsPlugin } from '../../plugins/cms-plugin/cms.plugin';
import { ContentI18nPlugin } from '../../plugins/content-i18n/content-i18n.plugin';
import { CrmPlugin } from '../../plugins/crm-plugin/crm.plugin';
import { DiagnosticsPlugin } from '../../plugins/diagnostics-plugin/diagnostics.plugin';
import { MenataBrandingPlugin } from '../../plugins/menata-branding/menata-branding.plugin';

import { createPluginTestEnvironment, initialData, TEST_SETUP_TIMEOUT_MS } from './test-environment';

/**
 * Boots every Menata plugin together, as vendure-config.ts does in production, so a
 * schema clash or a DI conflict between plugins fails here rather than on deploy.
 */
describe('All Menata plugins together', () => {
    const { server, adminClient, shopClient } = createPluginTestEnvironment({
        plugins: [
            AuditLogPlugin.init({ retentionDays: 90 }),
            CmsPlugin,
            ContentI18nPlugin,
            CrmPlugin,
            DiagnosticsPlugin.init({ apiBaseUrl: 'http://127.0.0.1:9', apiKey: 'k', clientId: 'c' }),
            MenataBrandingPlugin,
        ],
    });

    beforeAll(async () => {
        await server.init({ initialData, customerCount: 0 });
        await adminClient.asSuperAdmin();
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    it('exposes every plugin on the Admin API', async () => {
        const result = await adminClient.query(gql`
            query {
                auditLogStats {
                    totalEntries
                }
                cmsPages {
                    totalItems
                }
                productTranslationSummary {
                    languageCode
                }
                diagnostic {
                    available
                }
            }
        `);

        // The default channel offers one language: nothing to translate.
        expect(result.productTranslationSummary).toEqual([]);
        expect(result.diagnostic.available).toBe(false);
    });

    it('exposes the CMS on the Shop API', async () => {
        const result = await shopClient.query(gql`
            query {
                cmsPages {
                    totalItems
                }
                cmsPageByKey(key: "missing") {
                    key
                }
            }
        `);

        expect(result.cmsPages.totalItems).toBe(0);
        expect(result.cmsPageByKey).toBeNull();
    });
});
