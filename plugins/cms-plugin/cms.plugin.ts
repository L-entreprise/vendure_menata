import { PluginCommonModule, VendurePlugin } from '@vendure/core';

import { adminApiExtensions, shopApiExtensions } from './api/api-extensions';
import { CmsPageAdminResolver } from './api/cms-page-admin.resolver';
import { CmsPageShopResolver } from './api/cms-page-shop.resolver';
import { ContentBlockAdminResolver } from './api/content-block-admin.resolver';
import { ContentBlockShopResolver } from './api/content-block-shop.resolver';
import { cmsPagePermission, contentBlockPermission } from './constants';
import { CmsPageTranslation } from './entities/cms-page-translation.entity';
import { CmsPage } from './entities/cms-page.entity';
import { ContentBlockTranslation } from './entities/content-block-translation.entity';
import { ContentBlock } from './entities/content-block.entity';
import { CmsPageService } from './services/cms-page.service';
import { ContentBlockService } from './services/content-block.service';

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [ContentBlock, ContentBlockTranslation, CmsPage, CmsPageTranslation],
    adminApiExtensions: {
        schema: adminApiExtensions,
        resolvers: [ContentBlockAdminResolver, CmsPageAdminResolver],
    },
    shopApiExtensions: {
        schema: shopApiExtensions,
        resolvers: [ContentBlockShopResolver, CmsPageShopResolver],
    },
    providers: [ContentBlockService, CmsPageService],
    configuration: config => {
        config.authOptions.customPermissions.push(contentBlockPermission, cmsPagePermission);
        return config;
    },
    compatibility: '^3.0.0',
    dashboard: './dashboard/index.tsx',
})
export class CmsPlugin {}
