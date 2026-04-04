import { graphql } from '@/graphql/graphql';
import { api, defineDashboardExtension } from '@vendure/dashboard';
import { FileTextIcon, PinIcon } from 'lucide-react';

import { cmsCollectionEntry } from './cms-collection-entry';
import { cmsPageDetail } from './cms-page-detail';
import { cmsPageList } from './cms-page-list';
import { cmsSubmissionDetail } from './cms-submission-detail';
import { contentBlockDetail } from './content-block-detail';
import { contentBlockList } from './content-block-list';

const pinnedCmsPagesDocument = graphql(`
    query GetPinnedCmsPagesNav {
        pinnedCmsPages {
            id
            name
            key
            sidebarOrder
        }
    }
`);

void (async () => {
    let pinnedPages: Array<{ id: string; name: string; key: string }> = [];
    try {
        const result = await Promise.race([
            api.query(pinnedCmsPagesDocument, {}),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
        ]) as any;
        pinnedPages = result?.pinnedCmsPages ?? [];
    } catch {
        // Silently fail — pinned pages are a convenience, not critical
    }

    const pinnedPageRoutes = pinnedPages.map(page => ({
        path: '',
        component: () => null,
        navMenuItem: {
            id: `cms-pinned-${page.id}`,
            title: page.name || page.key,
            url: `/cms-pages/${page.id}`,
            sectionId: 'cms',
            icon: PinIcon,
            order: 100 + (page.sidebarOrder ?? 0),
        },
    }));

    defineDashboardExtension({
        navSections: [
            {
                id: 'cms',
                title: 'CMS',
                icon: FileTextIcon,
            },
        ],
        routes: [
            cmsPageList,
            cmsPageDetail,
            cmsCollectionEntry,
            cmsSubmissionDetail,
            contentBlockList,
            contentBlockDetail,
            ...pinnedPageRoutes,
        ],
    });
})();
