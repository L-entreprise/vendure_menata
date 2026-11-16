import { graphql } from '@/graphql/graphql';
import { i18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import { api, Button, DashboardAlertDefinition } from '@vendure/dashboard';

const topLevelPagesDocument = graphql(`
    query GetCmsTopLevelPageIds($options: CmsPageListOptions) {
        cmsPages(options: $options) {
            items {
                id
            }
        }
    }
`);

// One batched progress call (a fixed number of queries) rather than one per page.
const progressDocument = graphql(`
    query GetCmsPagesTranslationProgress($pageIds: [ID!]!) {
        cmsTranslationProgress(pageIds: $pageIds) {
            pageId
            languageCode
            total
            translated
        }
    }
`);

interface IncompleteCount {
    languageCode: string;
    pages: number;
}

// Top-level pages count their tabs (child pages), as on the page list.
const MAX_PAGES = 200;
const RECHECK_MS = 5 * 60 * 1000;

/** Bell alert: CMS pages whose translation is not finished, per language. */
export const cmsTranslationsAlert: DashboardAlertDefinition<IncompleteCount[]> = {
    id: 'cms-incomplete-translations',
    title: () => i18n._(msg`Pages not fully translated`),
    // The dashboard calls these before the first check resolves (data undefined).
    description: counts =>
        (counts ?? [])
            .filter(c => c.pages > 0)
            .map(c => `${c.languageCode.toUpperCase()} ${c.pages}`)
            .join(', '),
    severity: 'info',
    check: async () => {
        try {
            const pages: any = await api.query(topLevelPagesDocument, {
                options: { filter: { parentId: { isNull: true } }, take: MAX_PAGES },
            });
            const pageIds = (pages?.cmsPages?.items ?? []).map((page: any) => page.id);
            if (pageIds.length === 0) return [];
            const result: any = await api.query(progressDocument, { pageIds });
            const rows: any[] = result?.cmsTranslationProgress ?? [];
            const languages = [...new Set<string>(rows.map((r: any) => r.languageCode))];
            return languages.map(languageCode => ({
                languageCode,
                pages: rows.filter((r: any) => r.languageCode === languageCode && r.translated < r.total).length,
            }));
        } catch {
            // No CMS permission, or the server is unreachable: no alert.
            return [];
        }
    },
    shouldShow: counts => (counts ?? []).some(c => c.pages > 0),
    recheckInterval: RECHECK_MS,
    actions: [
        {
            component: ({ dismiss }) => (
                <Button size="sm" variant="outline" render={<Link to="/cms-pages" onClick={() => dismiss()} />}>
                    <Trans>See pages</Trans>
                </Button>
            ),
        },
    ],
};
