import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { DeletionResult, Permission } from '@vendure/common/lib/generated-types';
import { Administrator, Allow, Ctx, ID, idsAreEqual, RequestContext, Transaction } from '@vendure/core';

import { CrmTask } from '../entities/crm-task.entity';
import { MentionService } from '../services/mention.service';
import { NoteOwnershipService } from '../services/note-ownership.service';
import { NotificationService } from '../services/notification.service';
import { CreateTaskInput, TaskBucket, TaskService } from '../services/task.service';

/** K1-K4: follow-ups, mention autocomplete, notifications. */
@Resolver()
export class TaskResolver {
    constructor(
        private tasks: TaskService,
        private mentions: MentionService,
        private notifications: NotificationService,
    ) {}

    @Transaction()
    @Mutation()
    @Allow(Permission.UpdateCustomer, Permission.UpdateCustomerGroup)
    createCrmTask(@Ctx() ctx: RequestContext, @Args() args: { input: CreateTaskInput }) {
        return this.tasks.create(ctx, args.input);
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.UpdateCustomer, Permission.UpdateCustomerGroup)
    setCrmTaskDone(@Ctx() ctx: RequestContext, @Args() args: { id: ID; done: boolean }) {
        return this.tasks.setDone(ctx, args.id, args.done);
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.UpdateCustomer, Permission.UpdateCustomerGroup)
    async deleteCrmTask(@Ctx() ctx: RequestContext, @Args() args: { id: ID }) {
        await this.tasks.remove(ctx, args.id);
        return { result: DeletionResult.DELETED };
    }

    @Query()
    @Allow(Permission.ReadCustomer, Permission.ReadCustomerGroup)
    myCrmTasks(@Ctx() ctx: RequestContext, @Args() args: { bucket: TaskBucket }) {
        return this.tasks.mine(ctx, args.bucket);
    }

    @Query()
    @Allow(Permission.ReadCustomer, Permission.ReadCustomerGroup)
    crmTasksFor(@Ctx() ctx: RequestContext, @Args() args: { customerId?: ID; groupId?: ID }) {
        return this.tasks.tasksFor(ctx, args);
    }

    @Query()
    @Allow(Permission.ReadCustomer, Permission.ReadCustomerGroup)
    crmMentionableAdministrators(@Ctx() ctx: RequestContext) {
        return this.mentions.mentionable(ctx);
    }

    @Query()
    @Allow(Permission.Authenticated)
    myCrmNotifications(@Ctx() ctx: RequestContext, @Args() args: { unreadOnly?: boolean }) {
        return this.notifications.listMine(ctx, !!args.unreadOnly);
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.Authenticated)
    markCrmNotificationsRead(@Ctx() ctx: RequestContext, @Args() args: { ids?: ID[] | null }) {
        return this.notifications.markRead(ctx, args.ids);
    }
}

const fullName = (admin?: Administrator | null) => (admin ? `${admin.firstName} ${admin.lastName}`.trim() : null);

@Resolver('CrmTask')
export class CrmTaskFieldsResolver {
    constructor(private noteOwnership: NoteOwnershipService) {}

    @ResolveField()
    assigneeName(@Parent() task: CrmTask): string | null {
        return fullName(task.assignee);
    }

    @ResolveField()
    async isMine(@Ctx() ctx: RequestContext, @Parent() task: CrmTask): Promise<boolean> {
        const currentId = await this.noteOwnership.currentAdministratorId(ctx);
        return !!currentId && idsAreEqual(currentId, task.assigneeId);
    }
}
