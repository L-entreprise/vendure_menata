import { DeepPartial } from '@vendure/common/lib/shared-types';
import {
    Channel,
    HasCustomFields,
    LocaleString,
    Translatable,
    Translation,
    VendureEntity,
} from '@vendure/core';
import { Column, Entity, Index, JoinTable, ManyToMany, OneToMany } from 'typeorm';

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

    @Column({ type: 'int', default: 0 })
    sidebarOrder: number;

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
