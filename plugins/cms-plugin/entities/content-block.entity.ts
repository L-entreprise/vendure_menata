import { DeepPartial, ID } from '@vendure/common/lib/shared-types';
import {
    Asset,
    Channel,
    EntityId,
    HasCustomFields,
    LocaleString,
    Translatable,
    Translation,
    VendureEntity,
} from '@vendure/core';
import { Column, ColumnType, Entity, Index, JoinTable, ManyToMany, ManyToOne, OneToMany } from 'typeorm';

import { ContentBlockType } from '../constants';
import { CmsPage } from './cms-page.entity';
import { ContentBlockTranslation } from './content-block-translation.entity';

export class CustomContentBlockFields {}

// Postgres has no `datetime` type; MySQL/MariaDB `timestamp` caps at 2038 (Y2038)
// and converts timezones. Pick each dialect's correct date type from the same
// `DB` env the VendureConfig reads, so this entity is portable across both.
const dateColumnType: ColumnType = (process.env.DB ?? 'mariadb') === 'postgres' ? 'timestamp' : 'datetime';

@Entity()
export class ContentBlock extends VendureEntity implements Translatable, HasCustomFields {
    constructor(input?: DeepPartial<ContentBlock>) {
        super(input);
    }

    @Column({ length: 255 })
    @Index('IDX_content_block_page_key', ['pageId', 'key'])
    key: string;

    @Column('varchar')
    type: ContentBlockType;

    @Column({ default: true })
    enabled: boolean;

    @ManyToOne(() => Asset, { nullable: true, onDelete: 'SET NULL' })
    featuredAsset: Asset | null;

    @EntityId({ nullable: true })
    featuredAssetId: ID | null;

    @Column('simple-json', { nullable: true })
    metadata: Record<string, unknown> | null;

    @ManyToOne(() => CmsPage, page => page.contentBlocks, { nullable: true, onDelete: 'CASCADE' })
    page: CmsPage | null;

    @EntityId({ nullable: true })
    pageId: ID | null;

    @Column({ default: 0 })
    position: number;

    @Column({ type: dateColumnType, nullable: true })
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
