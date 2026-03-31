import { defineDashboardExtension } from '@vendure/dashboard';

import { auditLogList } from './audit-log-list';

defineDashboardExtension({
    routes: [auditLogList],
});
