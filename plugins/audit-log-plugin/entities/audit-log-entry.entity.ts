import { DeepPartial } from '@vendure/common/lib/shared-types';
import { Channel, VendureEntity } from '@vendure/core';
import { Column, Entity, Index, JoinTable, ManyToMany } from 'typeorm';

@Entity()
export class AuditLogEntry extends VendureEntity {
    constructor(input?: DeepPartial<AuditLogEntry>) {
        super(input);
    }

    @Column()
    @Index()
    action: string;

    @Column({ default: '' })
    @Index()
    entityType: string;

    @Column({ nullable: true })
    entityId: string;

    @Column({ nullable: true })
    @Index()
    userId: string;

    @Column({ nullable: true })
    userName: string;

    @Column({ type: 'simple-json', nullable: true })
    detail: Record<string, unknown>;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}
