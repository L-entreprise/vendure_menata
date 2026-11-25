import { Administrator, DeepPartial, EntityId, ID, VendureEntity } from '@vendure/core';
import { Column, Entity, Index, ManyToOne } from 'typeorm';

export type CrmNotificationType = 'mention' | 'task-due';

export type NotificationData = Record<string, string | number | boolean | null>;

/** K4: an internal notification shown in the dashboard (external channels come in V2/V3). */
@Entity()
export class CrmNotification extends VendureEntity {
    constructor(input?: DeepPartial<CrmNotification>) {
        super(input);
    }

    @ManyToOne(() => Administrator, { onDelete: 'CASCADE' })
    recipient: Administrator;

    @EntityId()
    @Index()
    recipientId: ID;

    @Column('varchar')
    type: CrmNotificationType;

    @Column({ default: false })
    read: boolean;

    @Column('simple-json')
    data: NotificationData;

    /** Prevents duplicates, e.g. one "due today" notification per follow-up and day. */
    @Index({ unique: true })
    @Column('varchar', { nullable: true })
    dedupeKey: string | null;
}
