import { DeepPartial } from '@vendure/common/lib/shared-types';
import { HasCustomFields, LanguageCode, Translation, VendureEntity } from '@vendure/core';
import { Column, Entity, Index, ManyToOne } from 'typeorm';

import { CmsPage } from './cms-page.entity';

export class CustomCmsPageTranslationFields {}

@Entity()
export class CmsPageTranslation
    extends VendureEntity
    implements Translation<CmsPage>, HasCustomFields
{
    constructor(input?: DeepPartial<CmsPageTranslation>) {
        super(input);
    }

    @Column('varchar')
    languageCode: LanguageCode;

    @Column({ length: 255 })
    name: string;

    @Column({ length: 255, default: '' })
    slug: string;

    @Index()
    @ManyToOne(() => CmsPage, base => base.translations, { onDelete: 'CASCADE' })
    base: CmsPage;

    @Column(() => CustomCmsPageTranslationFields)
    customFields: CustomCmsPageTranslationFields;
}
