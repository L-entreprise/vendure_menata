import { DeepPartial, ID } from '@vendure/common/lib/shared-types';
import { Asset, EntityId, HasCustomFields, LanguageCode, Translation, VendureEntity } from '@vendure/core';
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

    @Column({ length: 255 })
    name: string;

    @Column('text', { default: '' })
    textContent: string;

    @Column('varchar', { length: 255, default: '' })
    altText: string;

    // Per-language image: null keeps the block's own image (ContentBlock.featuredAsset).
    @ManyToOne(() => Asset, { nullable: true, onDelete: 'SET NULL' })
    featuredAsset: Asset | null;

    @EntityId({ nullable: true })
    featuredAssetId: ID | null;

    // Per-language image texts: `description` and `imageMeta[assetId].alt|description`,
    // merged over the block's metadata (see services/localize.ts).
    @Column('simple-json', { nullable: true })
    translatedMetadata: Record<string, unknown> | null;

    @Index()
    @ManyToOne(() => ContentBlock, base => base.translations, { onDelete: 'CASCADE' })
    base: ContentBlock;

    @Column(() => CustomContentBlockTranslationFields)
    customFields: CustomContentBlockTranslationFields;
}
