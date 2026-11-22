import { Injectable } from '@nestjs/common';
import { CustomerGroup, ID, RequestContext, TransactionalConnection } from '@vendure/core';

import { CustomerGroupNote } from '../entities/customer-group-note.entity';

import { JournalService } from './journal.service';
import { MentionService } from './mention.service';
import { NoteOwnershipService } from './note-ownership.service';

/** N4: notes on a group, with the same author rules as customer notes (N3). */
@Injectable()
export class GroupNoteService {
    constructor(
        private connection: TransactionalConnection,
        private noteOwnership: NoteOwnershipService,
        private journal: JournalService,
        private mentions: MentionService,
    ) {}

    list(ctx: RequestContext, groupId: ID): Promise<CustomerGroupNote[]> {
        return this.connection.getRepository(ctx, CustomerGroupNote).find({
            where: { groupId },
            relations: { administrator: true },
            order: { pinned: 'DESC', createdAt: 'ASC', id: 'ASC' },
        });
    }

    async add(ctx: RequestContext, groupId: ID, note: string): Promise<CustomerGroupNote> {
        await this.connection.getEntityOrThrow(ctx, CustomerGroup, groupId);
        const administratorId = (await this.noteOwnership.currentAdministratorId(ctx)) ?? null;
        const saved = await this.connection
            .getRepository(ctx, CustomerGroupNote)
            .save(new CustomerGroupNote({ groupId, note: note.trim(), administratorId, pinned: false }));
        await this.journal.record(ctx, groupId, 'note-added', { noteId: String(saved.id) });
        await this.mentions.notifyMentions(ctx, saved.note, { groupId });
        return this.findOne(ctx, saved.id);
    }

    async update(ctx: RequestContext, noteId: ID, note: string): Promise<CustomerGroupNote> {
        const existing = await this.findOne(ctx, noteId);
        await this.noteOwnership.assertAuthor(ctx, existing.administratorId ?? undefined, false);
        await this.connection.getRepository(ctx, CustomerGroupNote).update({ id: existing.id }, { note: note.trim() });
        return this.findOne(ctx, noteId);
    }

    async remove(ctx: RequestContext, noteId: ID): Promise<void> {
        const existing = await this.findOne(ctx, noteId);
        await this.noteOwnership.assertAuthor(ctx, existing.administratorId ?? undefined, true);
        await this.connection.getRepository(ctx, CustomerGroupNote).delete({ id: existing.id });
    }

    async setPinned(ctx: RequestContext, noteId: ID, pinned: boolean): Promise<CustomerGroupNote> {
        const existing = await this.findOne(ctx, noteId);
        await this.connection.getRepository(ctx, CustomerGroupNote).update({ id: existing.id }, { pinned });
        return this.findOne(ctx, noteId);
    }

    findOne(ctx: RequestContext, noteId: ID): Promise<CustomerGroupNote> {
        return this.connection.getEntityOrThrow(ctx, CustomerGroupNote, noteId, { relations: { administrator: true } });
    }
}
