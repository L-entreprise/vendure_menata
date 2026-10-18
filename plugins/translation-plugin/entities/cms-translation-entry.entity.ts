import { DeepPartial, ID } from '@vendure/common/lib/shared-types';
import { Channel, EntityId, VendureEntity } from '@vendure/core';
import { Column, Entity, Index, JoinTable, ManyToMany } from 'typeorm';

@Entity()
@Index('IDX_translation_entry_page_lang', ['pageId', 'languageCode'])
@Index('IDX_translation_entry_block_lang_field', ['contentBlockId', 'languageCode', 'fieldName'])
@Index('IDX_translation_entry_entry_lang', ['entryId', 'languageCode'])
export class CmsTranslationEntry extends VendureEntity {
    constructor(input?: DeepPartial<CmsTranslationEntry>) {
        super(input);
    }

    @Column({ length: 10 })
    languageCode: string;

    @EntityId()
    pageId: ID;

    @EntityId({ nullable: true })
    contentBlockId: ID | null;

    /** For collection entries (FormSubmission ID) */
    @EntityId({ nullable: true })
    entryId: ID | null;

    @Column({ length: 100 })
    fieldName: string;

    @Column('text', { default: '' })
    value: string;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}
