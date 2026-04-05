import { DeepPartial } from '@vendure/common/lib/shared-types';
import { Channel, VendureEntity } from '@vendure/core';
import { Column, Entity, Index, JoinTable, ManyToMany } from 'typeorm';

@Entity()
export class AuditLogEntry extends VendureEntity {
    constructor(input?: DeepPartial<AuditLogEntry>) {
        super(input);
    }

    /** High-level action: Login, ProductCreated, OrderStateTransition, etc. */
    @Column()
    @Index()
    action: string;

    /** Category grouping: auth, catalog, order, customer, system, settings, fulfillment, payment, promotion, stock */
    @Column({ default: 'other' })
    @Index()
    category: string;

    /** Entity type: Product, Order, Customer, etc. */
    @Column({ default: '' })
    @Index()
    entityType: string;

    /** ID of the affected entity */
    @Column({ nullable: true })
    entityId: string;

    /** User ID who performed the action */
    @Column({ nullable: true })
    @Index()
    userId: string;

    /** Human-readable user identifier (email or name) */
    @Column({ nullable: true })
    userName: string;

    /** admin or shop */
    @Column({ nullable: true })
    @Index()
    apiType: string;

    /** IP address from the request (if available) */
    @Column({ nullable: true })
    ipAddress: string;

    /** Severity: info, warning, critical */
    @Column({ default: 'info' })
    @Index()
    severity: string;

    /** Whether the action was successful */
    @Column({ default: true })
    success: boolean;

    /** Structured detail payload (action-specific data) */
    @Column({ type: 'simple-json', nullable: true })
    detail: Record<string, unknown>;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}
