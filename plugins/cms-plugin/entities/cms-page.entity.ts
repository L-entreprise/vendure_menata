import { DeepPartial, ID } from '@vendure/common/lib/shared-types';
import {
    Channel,
    EntityId,
    HasCustomFields,
    LocaleString,
    Translatable,
    Translation,
    VendureEntity,
} from '@vendure/core';
import { Column, Entity, Index, JoinTable, ManyToMany, ManyToOne, OneToMany } from 'typeorm';

import { CmsPageTranslation } from './cms-page-translation.entity';
import { ContentBlock } from './content-block.entity';

export class CustomCmsPageFields {}

@Entity()
export class CmsPage extends VendureEntity implements Translatable, HasCustomFields {
    constructor(input?: DeepPartial<CmsPage>) {
        super(input);
    }

    @Column({ length: 255 })
    @Index()
    key: string;

    @Column({ default: true })
    enabled: boolean;

    @Column({ default: false })
    acceptsSubmissions: boolean;

    @Column({ default: false })
    isCollection: boolean;

    @Column({ default: false })
    pinnedInSidebar: boolean;

    @Column({ default: false })
    allowCustomerCreation: boolean;

    // Order in the sidebar for pinned top-level pages, and among siblings for child pages.
    @Column({ type: 'int', default: 0 })
    sidebarOrder: number;

    // One level only: a child page groups under a top-level page in the dashboard
    // (shown as a tab). Nullable so existing pages and older plugin versions are unaffected.
    @ManyToOne(() => CmsPage, page => page.children, { nullable: true, onDelete: 'SET NULL' })
    parent: CmsPage | null;

    @EntityId({ nullable: true })
    parentId: ID | null;

    @OneToMany(() => CmsPage, page => page.parent)
    children: CmsPage[];

    // Absolute address of the page on the public site, for the dashboard "View on site" button.
    @Column({ type: 'varchar', length: 2048, nullable: true })
    previewUrl: string | null;

    name: LocaleString;
    slug: LocaleString;

    @OneToMany(() => CmsPageTranslation, translation => translation.base, { eager: true })
    translations: Array<Translation<CmsPage>>;

    @OneToMany(() => ContentBlock, block => block.page)
    contentBlocks: ContentBlock[];

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];

    @Column(() => CustomCmsPageFields)
    customFields: CustomCmsPageFields;
}
