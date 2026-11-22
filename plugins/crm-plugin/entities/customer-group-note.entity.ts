import { Administrator, CustomerGroup, DeepPartial, EntityId, ID, VendureEntity } from '@vendure/core';
import { Column, Entity, Index, ManyToOne } from 'typeorm';

/** N4: a hand-written note on a customer group (company, group of companies...). */
@Entity()
export class CustomerGroupNote extends VendureEntity {
    constructor(input?: DeepPartial<CustomerGroupNote>) {
        super(input);
    }

    @ManyToOne(() => CustomerGroup, { onDelete: 'CASCADE' })
    group: CustomerGroup;

    @EntityId()
    @Index()
    groupId: ID;

    @ManyToOne(() => Administrator, { onDelete: 'SET NULL', nullable: true })
    administrator: Administrator | null;

    @EntityId({ nullable: true })
    administratorId: ID | null;

    @Column('text')
    note: string;

    @Column({ default: false })
    pinned: boolean;
}
