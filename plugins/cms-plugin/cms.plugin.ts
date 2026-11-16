import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { AuditLogPlugin } from '../audit-log-plugin/audit-log.plugin';

import { adminApiExtensions, shopApiExtensions } from './api/api-extensions';
import { CmsPageAdminResolver } from './api/cms-page-admin.resolver';
import { CmsPageEntityAdminResolver } from './api/cms-page-entity.resolver';
import { CmsPageShopResolver } from './api/cms-page-shop.resolver';
import { ContentBlockAdminResolver } from './api/content-block-admin.resolver';
import { ContentBlockShopResolver } from './api/content-block-shop.resolver';
import { FormSubmissionAdminResolver } from './api/form-submission-admin.resolver';
import { FormSubmissionEntityAdminResolver } from './api/form-submission-entity.resolver';
import { FormSubmissionShopResolver } from './api/form-submission-shop.resolver';
import { cmsPagePermission, contentBlockPermission } from './constants';
import { CmsPageTranslation } from './entities/cms-page-translation.entity';
import { CmsPage } from './entities/cms-page.entity';
import { ContentBlockTranslation } from './entities/content-block-translation.entity';
import { ContentBlock } from './entities/content-block.entity';
import { applyDateColumnType } from './entities/date-column-type';
import { FormSubmissionTranslation } from './entities/form-submission-translation.entity';
import { FormSubmission } from './entities/form-submission.entity';
import { CmsPageService } from './services/cms-page.service';
import { CmsTranslationProgressService } from './services/cms-translation-progress.service';
import { ContentBlockService } from './services/content-block.service';
import { FormSubmissionService } from './services/form-submission.service';

@VendurePlugin({
    imports: [PluginCommonModule, AuditLogPlugin],
    entities: [ContentBlock, ContentBlockTranslation, CmsPage, CmsPageTranslation, FormSubmission, FormSubmissionTranslation],
    adminApiExtensions: {
        schema: adminApiExtensions,
        resolvers: [
            ContentBlockAdminResolver,
            CmsPageAdminResolver,
            CmsPageEntityAdminResolver,
            FormSubmissionAdminResolver,
            FormSubmissionEntityAdminResolver,
        ],
    },
    shopApiExtensions: {
        schema: shopApiExtensions,
        resolvers: [ContentBlockShopResolver, CmsPageShopResolver, FormSubmissionShopResolver],
    },
    providers: [ContentBlockService, CmsPageService, FormSubmissionService, CmsTranslationProgressService],
    configuration: config => {
        config.authOptions.customPermissions.push(contentBlockPermission, cmsPagePermission);
        applyDateColumnType(ContentBlock, 'dateValue', config.dbConnectionOptions.type);
        return config;
    },
    compatibility: '^3.0.0',
    dashboard: './dashboard/index.tsx',
})
export class CmsPlugin {}
