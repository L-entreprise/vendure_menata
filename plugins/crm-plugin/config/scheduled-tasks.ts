import { ScheduledTask } from '@vendure/core';

import { LifecycleService } from '../services/lifecycle.service';
import { NotificationService } from '../services/notification.service';

/** K4: every morning, one notification per follow-up due that day. */
export const crmDueTasksTask = new ScheduledTask({
    id: 'crm-due-tasks',
    description: 'CRM: notify sales reps of the follow-ups due today',
    schedule: '0 7 * * *',
    execute: ({ injector, scheduledContext }) =>
        injector.get(NotificationService).createDueTaskNotifications(scheduledContext),
});

/** T2: every night, refresh prospect / client / dormant (dormancy only changes with time). */
export const crmLifecycleTask = new ScheduledTask({
    id: 'crm-lifecycle',
    description: 'CRM: recompute prospect, client and dormant companies',
    schedule: '30 2 * * *',
    execute: ({ injector, scheduledContext }) => injector.get(LifecycleService).recomputeAll(scheduledContext),
});

export const CRM_SCHEDULED_TASKS = [crmDueTasksTask, crmLifecycleTask];
