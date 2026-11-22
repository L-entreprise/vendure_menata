import { Injectable } from '@nestjs/common';
import {
    AdministratorService,
    CustomerHistoryEntry,
    ID,
    idsAreEqual,
    RequestContext,
    TransactionalConnection,
} from '@vendure/core';

import { CrmForbiddenError } from '../common/crm-errors';
import { crmAdminPermission } from '../constants';

/**
 * N3: nobody edits or deletes another person's note. The super admin (CrmAdmin) may
 * delete any note but edit only their own.
 */
@Injectable()
export class NoteOwnershipService {
    constructor(
        private connection: TransactionalConnection,
        private administratorService: AdministratorService,
    ) {}

    async assertCanEdit(ctx: RequestContext, noteId: ID): Promise<void> {
        if (!(await this.isAuthor(ctx, noteId))) {
            throw new CrmForbiddenError('crm-note-only-author');
        }
    }

    async assertCanDelete(ctx: RequestContext, noteId: ID): Promise<void> {
        if (ctx.userHasPermissions([crmAdminPermission.Permission])) {
            return;
        }
        if (!(await this.isAuthor(ctx, noteId))) {
            throw new CrmForbiddenError('crm-note-only-author');
        }
    }

    private async isAuthor(ctx: RequestContext, noteId: ID): Promise<boolean> {
        const note = await this.connection.getEntityOrThrow(ctx, CustomerHistoryEntry, noteId, {
            relations: { administrator: true },
        });
        if (!note.administrator || !ctx.activeUserId) {
            return false;
        }
        const currentAdmin = await this.administratorService.findOneByUserId(ctx, ctx.activeUserId);
        return !!currentAdmin && idsAreEqual(currentAdmin.id, note.administrator.id);
    }
}
