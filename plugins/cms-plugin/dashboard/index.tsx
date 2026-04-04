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

// Register core CMS extension synchronously so routes/nav are available immediately
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
    ],
});

// Async: add pinned pages to sidebar after fetching (non-blocking)
void (async () => {
    try {
        const result = await Promise.race([
            api.query(pinnedCmsPagesDocument, {}),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
        ]) as any;
        const pinnedPages = result?.pinnedCmsPages ?? [];
        if (pinnedPages.length > 0) {
            defineDashboardExtension({
                routes: pinnedPages.map((page: any) => ({
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
                })),
            });
        }
    } catch {
        // Silently fail — pinned pages are a convenience, not critical
    }
})();
