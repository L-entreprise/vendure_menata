import { PluginCommonModule, VendurePlugin } from '@vendure/core';

import { adminApiExtensions, shopApiExtensions } from './api/api-extensions';
import { ContentBlockAdminResolver } from './api/content-block-admin.resolver';
import { ContentBlockShopResolver } from './api/content-block-shop.resolver';
import { contentBlockPermission } from './constants';
import { ContentBlockTranslation } from './entities/content-block-translation.entity';
import { ContentBlock } from './entities/content-block.entity';
import { ContentBlockService } from './services/content-block.service';

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [ContentBlock, ContentBlockTranslation],
    adminApiExtensions: {
        schema: adminApiExtensions,
        resolvers: [ContentBlockAdminResolver],
    },
    shopApiExtensions: {
        schema: shopApiExtensions,
        resolvers: [ContentBlockShopResolver],
    },
    providers: [ContentBlockService],
    configuration: config => {
        config.authOptions.customPermissions.push(contentBlockPermission);
        return config;
    },
    compatibility: '^3.0.0',
    dashboard: './dashboard/index.tsx',
})
export class CmsPlugin {}
