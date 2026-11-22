import { ScheduledTask } from '@vendure/core';

import { NotificationService } from '../services/notification.service';

/** K4: every morning, one notification per follow-up due that day. */
export const crmDueTasksTask = new ScheduledTask({
    id: 'crm-due-tasks',
    description: 'CRM: notify sales reps of the follow-ups due today',
    schedule: '0 7 * * *',
    execute: ({ injector, scheduledContext }) =>
        injector.get(NotificationService).createDueTaskNotifications(scheduledContext),
});

export const CRM_SCHEDULED_TASKS = [crmDueTasksTask];
