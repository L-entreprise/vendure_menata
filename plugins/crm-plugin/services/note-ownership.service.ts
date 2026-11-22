import { Injectable } from '@nestjs/common';
import { AdministratorService, ID, idsAreEqual, RequestContext, TransactionalConnection } from '@vendure/core';

import { CrmForbiddenError } from '../common/crm-errors';
import { customerHistoryEntity, orderHistoryEntity } from '../common/history-entities';
import { crmAdminPermission } from '../constants';

export type HistoryNoteKind = 'customer' | 'order';

/**
 * N3: nobody edits or deletes another person's note (customer, order or group notes).
 * The super admin (CrmAdmin) may delete any note but edit only their own.
 */
@Injectable()
export class NoteOwnershipService {
    constructor(
        private connection: TransactionalConnection,
        private administratorService: AdministratorService,
    ) {}

    async currentAdministratorId(ctx: RequestContext): Promise<ID | undefined> {
        if (!ctx.activeUserId) {
            return undefined;
        }
        return (await this.administratorService.findOneByUserId(ctx, ctx.activeUserId))?.id;
    }

    async assertCanEdit(ctx: RequestContext, noteId: ID, kind: HistoryNoteKind = 'customer'): Promise<void> {
        await this.assertAuthor(ctx, await this.historyAuthorId(ctx, noteId, kind), false);
    }

    async assertCanDelete(ctx: RequestContext, noteId: ID, kind: HistoryNoteKind = 'customer'): Promise<void> {
        await this.assertAuthor(ctx, await this.historyAuthorId(ctx, noteId, kind), true);
    }

    /** Throws unless the current admin wrote the note (or may delete any note, when `adminMayOverride`). */
    async assertAuthor(ctx: RequestContext, authorId: ID | undefined, adminMayOverride: boolean): Promise<void> {
        if (adminMayOverride && ctx.userHasPermissions([crmAdminPermission.Permission])) {
            return;
        }
        const currentId = await this.currentAdministratorId(ctx);
        if (!authorId || !currentId || !idsAreEqual(authorId, currentId)) {
            throw new CrmForbiddenError('crm-note-only-author');
        }
    }

    private async historyAuthorId(ctx: RequestContext, noteId: ID, kind: HistoryNoteKind): Promise<ID | undefined> {
        // Both entry kinds share the `administrator` relation read here.
        const entity = (kind === 'customer' ? customerHistoryEntity(this.connection) : orderHistoryEntity(this.connection)) as ReturnType<
            typeof customerHistoryEntity
        >;
        const note = await this.connection.getEntityOrThrow(ctx, entity, noteId, {
            relations: { administrator: true },
        });
        return note.administrator?.id;
    }
}
