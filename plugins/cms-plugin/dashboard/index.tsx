import { graphql } from '@/graphql/graphql';
import { api, defineDashboardExtension } from '@vendure/dashboard';
import { FileTextIcon, PinIcon } from 'lucide-react';

import { cmsCollectionEntry } from './cms-collection-entry';
import { cmsPageDetail } from './cms-page-detail';
import { cmsPageList } from './cms-page-list';
import { contentBlockDetail } from './content-block-detail';
import { contentBlockList } from './content-block-list';

const pinnedCmsPagesDocument = graphql(`
    query GetPinnedCmsPagesNav {
        pinnedCmsPages {
            id
            name
            key
        }
    }
`);

// Top-level await: blocks extension import resolution until pinned pages are fetched.
// This ensures nav items are registered BEFORE the sidebar renders.
// Timeout prevents hanging if the API is slow or user is not yet authenticated.
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

// Build nav-only route entries for pinned pages.
// Empty path = no route registered, but navMenuItem still gets added to the sidebar.
const pinnedPageRoutes = pinnedPages.map(page => ({
    path: '',
    component: () => null,
    navMenuItem: {
        id: `cms-pinned-${page.id}`,
        title: page.name || page.key,
        url: `/cms-pages/${page.id}`,
        sectionId: 'cms',
        icon: PinIcon,
        order: 100,
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
        contentBlockList,
        contentBlockDetail,
        ...pinnedPageRoutes,
    ],
});
