import { defineDashboardExtension } from '@vendure/dashboard';
import { LanguagesIcon } from 'lucide-react';

import { translationDetail } from './translation-detail';
import { translationList } from './translation-list';
import { translationSettings } from './translation-settings';

defineDashboardExtension({
    navSections: [
        {
            id: 'translations',
            title: 'Translations',
            icon: LanguagesIcon,
        },
    ],
    routes: [
        translationList,
        translationDetail,
        translationSettings,
    ],
});
