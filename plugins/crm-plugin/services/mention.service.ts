import { Injectable, OnModuleInit } from '@nestjs/common';
import {
    Administrator,
    Customer,
    CustomerGroup,
    EventBus,
    HistoryEntryEvent,
    ID,
    idsAreEqual,
    Logger,
    RequestContext,
    TransactionalConnection,
} from '@vendure/core';
import { IsNull } from 'typeorm';

import { loggerCtx } from '../constants';
import { NotificationData } from '../entities/crm-notification.entity';

import { NoteOwnershipService } from './note-ownership.service';
import { NotificationService } from './notification.service';

const EXCERPT_LENGTH = 140;

export interface MentionTarget {
    customerId?: ID;
    groupId?: ID;
}

const fold = (value: string) => value.normalize('NFC').toLocaleLowerCase('fr');
const fullName = (admin: Administrator) => `${admin.firstName} ${admin.lastName}`.trim();

/** True when `text` contains `@First Last`, not followed by another letter. */
export function mentions(text: string, name: string): boolean {
    const haystack = fold(text);
    const needle = `@${fold(name)}`;
    let index = haystack.indexOf(needle);
    while (index !== -1) {
        const next = haystack.charAt(index + needle.length);
        if (!next || !/\p{L}/u.test(next)) {
            return true;
        }
        index = haystack.indexOf(needle, index + 1);
    }
    return false;
}

/** K3: `@Prénom Nom` in a note notifies that colleague (never the author). */
@Injectable()
export class MentionService implements OnModuleInit {
    constructor(
        private connection: TransactionalConnection,
        private eventBus: EventBus,
        private noteOwnership: NoteOwnershipService,
        private notifications: NotificationService,
    ) {}

    onModuleInit() {
        this.eventBus.ofType(HistoryEntryEvent).subscribe(event => {
            const entry = event.entity as { type?: string; data?: { note?: string } };
            if (event.type !== 'created' || event.historyType !== 'customer' || entry.type !== 'CUSTOMER_NOTE') {
                return;
            }
            const customerId = (event.input as { customerId?: ID } | undefined)?.customerId;
            this.notifyMentions(event.ctx, entry.data?.note ?? '', { customerId }).catch(error =>
                Logger.error(`Could not notify mentions: ${String(error?.message ?? error)}`, loggerCtx),
            );
        });
    }

    /** K3 autocomplete: active accounts, names only (no e-mail, no role). */
    mentionable(ctx: RequestContext): Promise<Administrator[]> {
        return this.connection.getRepository(ctx, Administrator).find({
            where: { deletedAt: IsNull() },
            select: { id: true, firstName: true, lastName: true },
            order: { firstName: 'ASC', lastName: 'ASC' },
        });
    }

    async notifyMentions(ctx: RequestContext, text: string, target: MentionTarget): Promise<void> {
        if (!text.includes('@')) {
            return;
        }
        const authorId = await this.noteOwnership.currentAdministratorId(ctx);
        const admins = await this.mentionable(ctx);
        const mentioned = admins.filter(admin => mentions(text, fullName(admin)) && !(authorId && idsAreEqual(admin.id, authorId)));
        if (mentioned.length === 0) {
            return;
        }
        const author = admins.find(admin => authorId && idsAreEqual(admin.id, authorId));
        await this.notifications.notify(ctx, mentioned.map(admin => admin.id), 'mention', {
            authorName: author ? fullName(author) : null,
            excerpt: text.length > EXCERPT_LENGTH ? `${text.slice(0, EXCERPT_LENGTH)}…` : text,
            ...(await this.describeTarget(ctx, target)),
        });
    }

    private async describeTarget(ctx: RequestContext, target: MentionTarget): Promise<NotificationData> {
        if (target.customerId) {
            const customer = await this.connection.getRepository(ctx, Customer).findOne({ where: { id: target.customerId } });
            return { customerId: String(target.customerId), targetName: customer ? `${customer.firstName} ${customer.lastName}`.trim() : null };
        }
        if (target.groupId) {
            const group = await this.connection.getRepository(ctx, CustomerGroup).findOne({ where: { id: target.groupId } });
            return { groupId: String(target.groupId), targetName: group?.name ?? null };
        }
        return {};
    }
}
