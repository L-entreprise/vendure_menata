import { i18n } from '@lingui/core';
import { compileMessage } from '@lingui/message-utils/compileMessage';
import { defineDashboardExtension } from '@vendure/dashboard';
import { LanguagesIcon } from 'lucide-react';

import { translationDetail } from './translation-detail';
import { translationList } from './translation-list';
import { translationSettings } from './translation-settings';

// Plugin .po catalogs reach the production dashboard as raw (uncompiled) ICU strings
// and are merged over the compiled core catalog, so placeholders would render literally
// ("Page {0} of {1}", "{count} images"). Let Lingui compile them at runtime.
i18n.setMessagesCompiler(compileMessage);

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
