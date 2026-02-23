import { DeepPartial } from '@vendure/common/lib/shared-types';
import { HasCustomFields, LanguageCode, Translation, VendureEntity } from '@vendure/core';
import { Column, Entity, Index, ManyToOne } from 'typeorm';

import { ContentBlock } from './content-block.entity';

export class CustomContentBlockTranslationFields {}

@Entity()
export class ContentBlockTranslation
    extends VendureEntity
    implements Translation<ContentBlock>, HasCustomFields
{
    constructor(input?: DeepPartial<ContentBlockTranslation>) {
        super(input);
    }

    @Column('varchar')
    languageCode: LanguageCode;

    @Column()
    name: string;

    @Column('text', { nullable: true })
    textContent: string | null;

    @Column('varchar', { nullable: true })
    altText: string | null;

    @Index()
    @ManyToOne(() => ContentBlock, base => base.translations, { onDelete: 'CASCADE' })
    base: ContentBlock;

    @Column(() => CustomContentBlockTranslationFields)
    customFields: CustomContentBlockTranslationFields;
}
