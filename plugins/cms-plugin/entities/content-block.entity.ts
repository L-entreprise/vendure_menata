import { DeepPartial, ID } from '@vendure/common/lib/shared-types';
import {
    Asset,
    Channel,
    HasCustomFields,
    LocaleString,
    Translatable,
    Translation,
    VendureEntity,
} from '@vendure/core';
import { Column, Entity, Index, JoinTable, ManyToMany, ManyToOne, OneToMany } from 'typeorm';

import { ContentBlockType } from '../constants';
import { CmsPage } from './cms-page.entity';
import { ContentBlockTranslation } from './content-block-translation.entity';

export class CustomContentBlockFields {}

@Entity()
export class ContentBlock extends VendureEntity implements Translatable, HasCustomFields {
    constructor(input?: DeepPartial<ContentBlock>) {
        super(input);
    }

    @Column()
    @Index({ unique: false })
    key: string;

    @Column('varchar')
    type: ContentBlockType;

    @Column({ default: true })
    enabled: boolean;

    @ManyToOne(() => Asset, { nullable: true, onDelete: 'SET NULL' })
    featuredAsset: Asset | null;

    @Column({ nullable: true })
    featuredAssetId: ID | null;

    @Column('simple-json', { nullable: true })
    metadata: Record<string, unknown> | null;

    @ManyToOne(() => CmsPage, page => page.contentBlocks, { nullable: true, onDelete: 'CASCADE' })
    page: CmsPage | null;

    @Column({ nullable: true })
    pageId: ID | null;

    @Column({ default: 0 })
    position: number;

    @Column({ nullable: true })
    dateValue: Date | null;

    @Column('float', { nullable: true })
    numberValue: number | null;

    // Translatable fields (resolved from translations)
    name: LocaleString;
    textContent: LocaleString;
    altText: LocaleString;

    @OneToMany(() => ContentBlockTranslation, translation => translation.base, { eager: true })
    translations: Array<Translation<ContentBlock>>;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];

    @Column(() => CustomContentBlockFields)
    customFields: CustomContentBlockFields;
}
