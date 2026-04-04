import { defineDashboardExtension, loadI18nMessages } from '@vendure/dashboard';
import { i18n } from '@lingui/core';

import { MenataLoginBeforeForm } from './menata-login-logo';

// Detect browser language and activate French if applicable
const browserLang = navigator.language?.split('-')[0];
if (browserLang === 'fr') {
    void (async () => {
        try {
            const messages = await loadI18nMessages('fr');
            i18n.load('fr', messages);
            i18n.activate('fr');
        } catch {
            // Silently fail — English fallback is fine
        }
    })();
}

defineDashboardExtension({
    login: {
        beforeForm: {
            component: MenataLoginBeforeForm,
        },
    },
});
