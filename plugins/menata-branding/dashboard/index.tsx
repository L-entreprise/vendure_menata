import { defineDashboardExtension } from '@vendure/dashboard';

import { MenataLoginLogo } from './menata-login-logo';

defineDashboardExtension({
    login: {
        logo: {
            component: MenataLoginLogo,
        },
    },
});
