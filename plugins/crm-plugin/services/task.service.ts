import { Injectable } from '@nestjs/common';
import { Customer, CustomerGroup, ID, idsAreEqual, RequestContext, TransactionalConnection } from '@vendure/core';
import { FindOptionsWhere, LessThan, MoreThan } from 'typeorm';

import { CrmForbiddenError, CrmRuleError } from '../common/crm-errors';
import { isLocalDate, localDate } from '../common/local-date';
import { CrmTask, TaskSourceKind } from '../entities/crm-task.entity';

import { JournalService } from './journal.service';
import { MembershipRulesService } from './membership-rules.service';
import { NoteOwnershipService } from './note-ownership.service';

const MAX_TITLE_LENGTH = 500;
const DONE_SHOWN = 50;

export type TaskBucket = 'OVERDUE' | 'TODAY' | 'UPCOMING' | 'DONE';

export interface CreateTaskInput {
    title: string;
    dueDate: string;
    customerId?: ID | null;
    groupId?: ID | null;
    sourceNoteId?: ID | null;
    sourceNoteKind?: TaskSourceKind | null;
}

/** K1 / K2: follow-ups, always assigned to their author (no delegation in V1). */
@Injectable()
export class TaskService {
    constructor(
        private connection: TransactionalConnection,
        private noteOwnership: NoteOwnershipService,
        private journal: JournalService,
        private membershipRules: MembershipRulesService,
    ) {}

    async create(ctx: RequestContext, input: CreateTaskInput): Promise<CrmTask> {
        const title = input.title.trim();
        if (!title || title.length > MAX_TITLE_LENGTH) {
            throw new CrmRuleError('crm-task-title-invalid', { max: MAX_TITLE_LENGTH });
        }
        if (!isLocalDate(input.dueDate)) {
            throw new CrmRuleError('crm-task-invalid-date');
        }
        if (!!input.customerId === !!input.groupId) {
            throw new CrmRuleError('crm-task-needs-target');
        }
        if (input.customerId) {
            await this.connection.getEntityOrThrow(ctx, Customer, input.customerId);
        } else {
            await this.connection.getEntityOrThrow(ctx, CustomerGroup, input.groupId!);
        }
        const assigneeId = await this.noteOwnership.currentAdministratorId(ctx);
        if (!assigneeId) {
            throw new CrmForbiddenError('crm-task-needs-administrator');
        }
        const saved = await this.connection.getRepository(ctx, CrmTask).save(
            new CrmTask({
                title,
                dueDate: input.dueDate,
                done: false,
                doneAt: null,
                assigneeId,
                customerId: input.customerId ?? null,
                groupId: input.groupId ?? null,
                sourceNoteId: input.sourceNoteId ?? null,
                sourceNoteKind: input.sourceNoteKind ?? null,
            }),
        );
        await this.journalTask(ctx, saved);
        return this.findOne(ctx, saved.id);
    }

    async setDone(ctx: RequestContext, id: ID, done: boolean): Promise<CrmTask> {
        const task = await this.assertAssignee(ctx, id);
        await this.connection
            .getRepository(ctx, CrmTask)
            .update({ id: task.id }, { done, doneAt: done ? new Date() : null });
        return this.findOne(ctx, id);
    }

    async remove(ctx: RequestContext, id: ID): Promise<void> {
        const task = await this.assertAssignee(ctx, id);
        await this.connection.getRepository(ctx, CrmTask).delete({ id: task.id });
    }

    async mine(ctx: RequestContext, bucket: TaskBucket): Promise<CrmTask[]> {
        const assigneeId = await this.noteOwnership.currentAdministratorId(ctx);
        if (!assigneeId) {
            return [];
        }
        const today = localDate(0);
        const open: FindOptionsWhere<CrmTask> = { assigneeId, done: false };
        const where: Record<TaskBucket, FindOptionsWhere<CrmTask>> = {
            OVERDUE: { ...open, dueDate: LessThan(today) },
            TODAY: { ...open, dueDate: today },
            UPCOMING: { ...open, dueDate: MoreThan(today) },
            DONE: { assigneeId, done: true },
        };
        return this.connection.getRepository(ctx, CrmTask).find({
            where: where[bucket],
            relations: { customer: true, group: true, assignee: true },
            order: bucket === 'DONE' ? { doneAt: 'DESC' } : { dueDate: 'ASC', id: 'ASC' },
            take: bucket === 'DONE' ? DONE_SHOWN : undefined,
        });
    }

    tasksFor(ctx: RequestContext, target: { customerId?: ID | null; groupId?: ID | null }): Promise<CrmTask[]> {
        const where = target.customerId ? { customerId: target.customerId } : { groupId: target.groupId ?? -1 };
        return this.connection.getRepository(ctx, CrmTask).find({
            where,
            relations: { assignee: true },
            order: { done: 'ASC', dueDate: 'ASC', id: 'ASC' },
        });
    }

    findOne(ctx: RequestContext, id: ID): Promise<CrmTask> {
        return this.connection.getEntityOrThrow(ctx, CrmTask, id, { relations: { customer: true, group: true, assignee: true } });
    }

    private async assertAssignee(ctx: RequestContext, id: ID): Promise<CrmTask> {
        const task = await this.findOne(ctx, id);
        const currentId = await this.noteOwnership.currentAdministratorId(ctx);
        if (!currentId || !idsAreEqual(currentId, task.assigneeId)) {
            throw new CrmForbiddenError('crm-only-own-task');
        }
        return task;
    }

    /** N5: a follow-up concerns the company itself, or the company of the customer. */
    private async journalTask(ctx: RequestContext, task: CrmTask) {
        const companyId = task.groupId ?? (task.customerId ? (await this.membershipRules.companyOf(ctx, task.customerId))?.id : undefined);
        if (companyId) {
            await this.journal.record(ctx, companyId, 'task-added', { taskId: String(task.id), title: task.title, dueDate: task.dueDate });
        }
    }
}
