import { defineDashboardExtension } from '@vendure/dashboard';
import { ActivityIcon } from 'lucide-react';

import { diagnosticsPage } from './diagnostics-page';

defineDashboardExtension({
    navSections: [
        {
            id: 'diagnostics',
            title: 'Diagnostic',
            icon: ActivityIcon,
        },
    ],
    routes: [diagnosticsPage],
});
