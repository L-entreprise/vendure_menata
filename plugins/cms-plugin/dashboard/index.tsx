import { defineDashboardExtension } from '@vendure/dashboard';
import { FileTextIcon } from 'lucide-react';

import { cmsPageDetail } from './cms-page-detail';
import { cmsPageList } from './cms-page-list';
import { contentBlockDetail } from './content-block-detail';
import { contentBlockList } from './content-block-list';

defineDashboardExtension({
    navSections: [
        {
            id: 'cms',
            title: 'CMS',
            icon: FileTextIcon,
        },
    ],
    routes: [
        {
            navMenuItem: {
                sectionId: 'cms',
                id: 'cms-create',
                url: '/cms-pages/new',
                title: 'Créer',
                requiresPermission: ['CreateCmsPage'],
            },
        },
        cmsPageList,
        cmsPageDetail,
        contentBlockList,
        contentBlockDetail,
    ],
});
