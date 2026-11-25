import { Administrator, CustomerGroup, DeepPartial, EntityId, ID, VendureEntity } from '@vendure/core';
import { Column, Entity, Index, ManyToOne } from 'typeorm';

export type JournalEntryType =
    | 'created'
    | 'updated'
    | 'type-changed'
    | 'parent-added'
    | 'parent-removed'
    | 'member-added'
    | 'member-removed'
    | 'address-added'
    | 'address-updated'
    | 'address-removed'
    | 'lifecycle-changed'
    | 'note-added'
    | 'task-added'
    | 'order-assigned';

export type JournalData = Record<string, string | number | boolean | null>;

/** N5: one action concerning a company, kept on the company itself (no aggregation of subsidiaries). */
@Entity()
export class CrmJournalEntry extends VendureEntity {
    constructor(input?: DeepPartial<CrmJournalEntry>) {
        super(input);
    }

    @ManyToOne(() => CustomerGroup, { onDelete: 'CASCADE' })
    group: CustomerGroup;

    @EntityId()
    @Index()
    groupId: ID;

    @Column('varchar')
    type: JournalEntryType;

    @Column('simple-json')
    data: JournalData;

    @ManyToOne(() => Administrator, { onDelete: 'SET NULL', nullable: true })
    administrator: Administrator | null;

    @EntityId({ nullable: true })
    administratorId: ID | null;
}
