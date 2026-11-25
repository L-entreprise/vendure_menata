import { Injectable } from '@nestjs/common';
import { ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { In } from 'typeorm';

import { localDate } from '../common/local-date';
import { CrmNotification, CrmNotificationType, NotificationData } from '../entities/crm-notification.entity';
import { CrmTask } from '../entities/crm-task.entity';

import { NoteOwnershipService } from './note-ownership.service';

const NOTIFICATIONS_SHOWN = 50;

export interface NotificationList {
    items: CrmNotification[];
    unreadCount: number;
}

/** K4: internal notifications (mentions, follow-ups due today) for the current admin. */
@Injectable()
export class NotificationService {
    constructor(
        private connection: TransactionalConnection,
        private noteOwnership: NoteOwnershipService,
    ) {}

    async notify(
        ctx: RequestContext,
        recipientIds: ID[],
        type: CrmNotificationType,
        data: NotificationData,
        dedupeKey?: (recipientId: ID) => string,
    ): Promise<void> {
        const repository = this.connection.getRepository(ctx, CrmNotification);
        for (const recipientId of recipientIds) {
            const key = dedupeKey?.(recipientId) ?? null;
            if (key && (await repository.count({ where: { dedupeKey: key } })) > 0) {
                continue;
            }
            await repository.save(new CrmNotification({ recipientId, type, data, read: false, dedupeKey: key }));
        }
    }

    /** Daily job: one notification per open follow-up due today, created once. */
    async createDueTaskNotifications(ctx: RequestContext): Promise<number> {
        const today = localDate(0);
        const tasks = await this.connection
            .getRepository(ctx, CrmTask)
            .find({ where: { dueDate: today, done: false } });
        for (const task of tasks) {
            await this.notify(
                ctx,
                [task.assigneeId],
                'task-due',
                { taskId: String(task.id), title: task.title, dueDate: task.dueDate, customerId: task.customerId ? String(task.customerId) : null, groupId: task.groupId ? String(task.groupId) : null },
                () => `task-due:${String(task.id)}:${today}`,
            );
        }
        return tasks.length;
    }

    async listMine(ctx: RequestContext, unreadOnly = false): Promise<NotificationList> {
        const recipientId = await this.noteOwnership.currentAdministratorId(ctx);
        if (!recipientId) {
            return { items: [], unreadCount: 0 };
        }
        const repository = this.connection.getRepository(ctx, CrmNotification);
        const items = await repository.find({
            where: unreadOnly ? { recipientId, read: false } : { recipientId },
            order: { createdAt: 'DESC', id: 'DESC' },
            take: NOTIFICATIONS_SHOWN,
        });
        const unreadCount = await repository.count({ where: { recipientId, read: false } });
        return { items, unreadCount };
    }

    /** Marks the given notifications (all when `ids` is empty) of the current admin as read. */
    async markRead(ctx: RequestContext, ids?: ID[] | null): Promise<number> {
        const recipientId = await this.noteOwnership.currentAdministratorId(ctx);
        if (!recipientId) {
            return 0;
        }
        const where = ids?.length ? { recipientId, read: false, id: In(ids) } : { recipientId, read: false };
        const result = await this.connection.getRepository(ctx, CrmNotification).update(where, { read: true });
        return result.affected ?? 0;
    }
}
