import { DeepPartial, ID } from '@vendure/common/lib/shared-types';
import { Channel, EntityId, VendureEntity } from '@vendure/core';
import { Column, Entity, Index, JoinTable, ManyToMany, ManyToOne } from 'typeorm';

import { CmsPage } from './cms-page.entity';

@Entity()
export class FormSubmission extends VendureEntity {
    constructor(input?: DeepPartial<FormSubmission>) {
        super(input);
    }

    @ManyToOne(() => CmsPage, { onDelete: 'CASCADE' })
    page: CmsPage;

    @EntityId()
    @Index()
    pageId: ID;

    @Column('simple-json')
    data: Record<string, unknown>;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}
