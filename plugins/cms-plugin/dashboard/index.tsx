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
        cmsPageList,
        cmsPageDetail,
        contentBlockList,
        contentBlockDetail,
    ],
});
