import { DeepPartial, ID } from '@vendure/common/lib/shared-types';
import { Channel, EntityId, VendureEntity } from '@vendure/core';
import { Column, Entity, Index, JoinTable, ManyToMany, ManyToOne, OneToMany } from 'typeorm';

import { CmsPage } from './cms-page.entity';
import { FormSubmissionTranslation } from './form-submission-translation.entity';

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

    // Collection entries only: the translated texts per language. `data` holds the
    // default language and every value that is not translated (dates, numbers, ...).
    @OneToMany(() => FormSubmissionTranslation, translation => translation.base)
    translations: FormSubmissionTranslation[];

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}
