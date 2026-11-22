import { CustomerGroup, DeepPartial, EntityId, ID, VendureEntity } from '@vendure/core';
import { Column, Entity, Index, ManyToOne } from 'typeorm';

export type GroupAddressKind = 'headquarters' | 'shipping' | 'billing';

/**
 * A1: an address of a company (head office, delivery, billing). Orders always receive a
 * copy of it, so editing it never changes past orders (A4). Never exposed on the shop (A5).
 */
@Entity()
export class CustomerGroupAddress extends VendureEntity {
    constructor(input?: DeepPartial<CustomerGroupAddress>) {
        super(input);
    }

    @ManyToOne(() => CustomerGroup, { onDelete: 'CASCADE' })
    group: CustomerGroup;

    @EntityId()
    @Index()
    groupId: ID;

    @Column('varchar')
    kind: GroupAddressKind;

    @Column('varchar', { default: '' })
    label: string;

    @Column('varchar', { default: '' })
    fullName: string;

    @Column('varchar', { default: '' })
    company: string;

    @Column('varchar')
    streetLine1: string;

    @Column('varchar', { default: '' })
    streetLine2: string;

    @Column('varchar', { default: '' })
    city: string;

    @Column('varchar', { default: '' })
    province: string;

    @Column('varchar', { default: '' })
    postalCode: string;

    @Column('varchar', { length: 2 })
    countryCode: string;

    @Column('varchar', { default: '' })
    phoneNumber: string;

    @Column({ default: false })
    defaultShipping: boolean;

    @Column({ default: false })
    defaultBilling: boolean;
}
