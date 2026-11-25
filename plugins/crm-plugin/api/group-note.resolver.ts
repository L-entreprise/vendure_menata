import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { DeletionResult, Permission } from '@vendure/common/lib/generated-types';
import { Administrator, Allow, Ctx, ID, idsAreEqual, RequestContext, Transaction } from '@vendure/core';

import { CrmJournalEntry } from '../entities/crm-journal-entry.entity';
import { CustomerGroupNote } from '../entities/customer-group-note.entity';
import { GroupNoteService } from '../services/group-note.service';
import { JournalService } from '../services/journal.service';
import { NoteOwnershipService } from '../services/note-ownership.service';

type NoteArgs = { noteId: ID };

function fullName(administrator?: Administrator | null): string | null {
    return administrator ? `${administrator.firstName} ${administrator.lastName}`.trim() : null;
}

/** N4 group notes and N5 company journal. */
@Resolver()
export class GroupNoteResolver {
    constructor(
        private notes: GroupNoteService,
        private journal: JournalService,
    ) {}

    @Query()
    @Allow(Permission.ReadCustomerGroup)
    customerGroupNotes(@Ctx() ctx: RequestContext, @Args() args: { groupId: ID }) {
        return this.notes.list(ctx, args.groupId);
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.UpdateCustomerGroup)
    addCustomerGroupNote(@Ctx() ctx: RequestContext, @Args() args: { groupId: ID; note: string }) {
        return this.notes.add(ctx, args.groupId, args.note);
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.UpdateCustomerGroup)
    updateCustomerGroupNote(@Ctx() ctx: RequestContext, @Args() args: NoteArgs & { note: string }) {
        return this.notes.update(ctx, args.noteId, args.note);
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.UpdateCustomerGroup)
    async deleteCustomerGroupNote(@Ctx() ctx: RequestContext, @Args() args: NoteArgs) {
        await this.notes.remove(ctx, args.noteId);
        return { result: DeletionResult.DELETED };
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.UpdateCustomerGroup)
    setCustomerGroupNotePinned(@Ctx() ctx: RequestContext, @Args() args: NoteArgs & { pinned: boolean }) {
        return this.notes.setPinned(ctx, args.noteId, args.pinned);
    }

    @Query()
    @Allow(Permission.ReadCustomerGroup)
    crmJournal(@Ctx() ctx: RequestContext, @Args() args: { groupId: ID; skip?: number; take?: number }) {
        return this.journal.list(ctx, args.groupId, args.skip ?? 0, args.take ?? undefined);
    }
}

@Resolver('CrmGroupNote')
export class CrmGroupNoteFieldsResolver {
    constructor(private noteOwnership: NoteOwnershipService) {}

    @ResolveField()
    authorName(@Parent() note: CustomerGroupNote): string | null {
        return fullName(note.administrator);
    }

    @ResolveField()
    async isMine(@Ctx() ctx: RequestContext, @Parent() note: CustomerGroupNote): Promise<boolean> {
        const currentId = await this.noteOwnership.currentAdministratorId(ctx);
        return !!currentId && !!note.administratorId && idsAreEqual(currentId, note.administratorId);
    }
}

@Resolver('CrmJournalEntry')
export class CrmJournalEntryFieldsResolver {
    @ResolveField()
    authorName(@Parent() entry: CrmJournalEntry): string | null {
        return fullName(entry.administrator);
    }
}
