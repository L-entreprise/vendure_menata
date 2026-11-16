import { DeepPartial, ID } from '@vendure/common/lib/shared-types';
import { EntityId, LanguageCode, VendureEntity } from '@vendure/core';
import { Column, Entity, Index, ManyToOne } from 'typeorm';

import { FormSubmission } from './form-submission.entity';

/**
 * The translated texts of one collection entry in one language: the translatable keys
 * of the entry's `data` (texts, image alt/description, a per-language image id).
 * Missing or empty keys fall back to the entry's own `data` (default language).
 */
@Entity()
export class FormSubmissionTranslation extends VendureEntity {
    constructor(input?: DeepPartial<FormSubmissionTranslation>) {
        super(input);
    }

    @Column('varchar')
    languageCode: LanguageCode;

    @Column('simple-json')
    data: Record<string, unknown>;

    @Index()
    @ManyToOne(() => FormSubmission, submission => submission.translations, { onDelete: 'CASCADE' })
    base: FormSubmission;

    @EntityId()
    baseId: ID;
}
