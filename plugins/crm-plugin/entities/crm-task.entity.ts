import { Administrator, Customer, CustomerGroup, DeepPartial, EntityId, ID, VendureEntity } from '@vendure/core';
import { Column, Entity, Index, ManyToOne } from 'typeorm';

export type TaskSourceKind = 'customer' | 'group';

/** K1: a follow-up ("Rappeler MENATA le 12/01"), always assigned to the person who created it. */
@Entity()
export class CrmTask extends VendureEntity {
    constructor(input?: DeepPartial<CrmTask>) {
        super(input);
    }

    @Column('varchar', { length: 500 })
    title: string;

    /** Calendar day `YYYY-MM-DD` (see common/local-date.ts). */
    @Index()
    @Column('varchar', { length: 10 })
    dueDate: string;

    @Column({ default: false })
    done: boolean;

    @Column({ type: Date, nullable: true })
    doneAt: Date | null;

    @ManyToOne(() => Administrator, { onDelete: 'CASCADE' })
    assignee: Administrator;

    @EntityId()
    @Index()
    assigneeId: ID;

    @ManyToOne(() => Customer, { onDelete: 'CASCADE', nullable: true })
    customer: Customer | null;

    @EntityId({ nullable: true })
    customerId: ID | null;

    @ManyToOne(() => CustomerGroup, { onDelete: 'CASCADE', nullable: true })
    group: CustomerGroup | null;

    @EntityId({ nullable: true })
    groupId: ID | null;

    /** The note the follow-up was created from, if any. */
    @EntityId({ nullable: true })
    sourceNoteId: ID | null;

    @Column('varchar', { nullable: true })
    sourceNoteKind: TaskSourceKind | null;
}
