import { defineDashboardExtension } from '@vendure/dashboard';
import { FileTextIcon } from 'lucide-react';

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
    routes: [contentBlockList, contentBlockDetail],
});
