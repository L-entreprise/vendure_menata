import { Injectable, OnModuleInit } from '@nestjs/common';
import {
    Customer,
    CustomerGroup,
    CustomerGroupChangeEvent,
    CustomerGroupEvent,
    EventBus,
    ID,
    Logger,
    PaginatedList,
    RequestContext,
    TransactionalConnection,
} from '@vendure/core';

import { loggerCtx } from '../constants';
import { CrmJournalEntry, JournalData, JournalEntryType } from '../entities/crm-journal-entry.entity';

import { isCompany } from './membership-rules.service';
import { NoteOwnershipService } from './note-ownership.service';

const JOURNAL_PAGE_SIZE = 50;

function customerName(customer: Customer): string {
    return `${customer.firstName} ${customer.lastName}`.trim() || customer.emailAddress;
}

/**
 * N5: the journal of a company — every action that concerns it (not its subsidiaries).
 * Other group types are not journaled. Event contexts arrive after commit without their
 * transaction, so `getRepository(ctx)` writes through the main connection.
 */
@Injectable()
export class JournalService implements OnModuleInit {
    constructor(
        private connection: TransactionalConnection,
        private eventBus: EventBus,
        private noteOwnership: NoteOwnershipService,
    ) {}

    onModuleInit() {
        this.eventBus.ofType(CustomerGroupEvent).subscribe(event => {
            if (event.type === 'deleted') {
                return;
            }
            const group = event.entity as CustomerGroup;
            const input = (event.input ?? {}) as Record<string, unknown>;
            const typeChanged = !!(input.customFields as Record<string, unknown> | undefined)?.groupType;
            const type: JournalEntryType = event.type === 'created' ? 'created' : typeChanged ? 'type-changed' : 'updated';
            this.safeRecord(event.ctx, group.id, type, { fields: Object.keys(input).filter(key => key !== 'id').join(', ') });
        });
        this.eventBus.ofType(CustomerGroupChangeEvent).subscribe(event => {
            const type: JournalEntryType = event.type === 'assigned' ? 'member-added' : 'member-removed';
            for (const customer of event.customers) {
                this.safeRecord(event.ctx, event.customGroup.id, type, { customerId: customer.id, customerName: customerName(customer) });
            }
        });
    }

    async record(ctx: RequestContext, groupId: ID, type: JournalEntryType, data: JournalData = {}): Promise<void> {
        const group = await this.connection.getRepository(ctx, CustomerGroup).findOne({ where: { id: groupId } });
        if (!group || !isCompany(group)) {
            return;
        }
        const administratorId = (await this.noteOwnership.currentAdministratorId(ctx)) ?? null;
        await this.connection
            .getRepository(ctx, CrmJournalEntry)
            .save(new CrmJournalEntry({ groupId, type, data, administratorId }));
    }

    async list(ctx: RequestContext, groupId: ID, skip = 0, take = JOURNAL_PAGE_SIZE): Promise<PaginatedList<CrmJournalEntry>> {
        const [items, totalItems] = await this.connection.getRepository(ctx, CrmJournalEntry).findAndCount({
            where: { groupId },
            relations: { administrator: true },
            order: { createdAt: 'DESC', id: 'DESC' },
            skip,
            take: Math.min(take, JOURNAL_PAGE_SIZE),
        });
        return { items, totalItems };
    }

    private safeRecord(ctx: RequestContext, groupId: ID, type: JournalEntryType, data: JournalData) {
        this.record(ctx, groupId, type, data).catch(error =>
            Logger.error(`Could not journal ${type} for group ${String(groupId)}: ${String(error?.message ?? error)}`, loggerCtx),
        );
    }
}
