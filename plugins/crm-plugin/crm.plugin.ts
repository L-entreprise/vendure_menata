import { OnApplicationBootstrap } from '@nestjs/common';
import { I18nService, PluginCommonModule, VendurePlugin } from '@vendure/core';

import { adminApiExtensions } from './api/api-extensions';
import { CustomerGroupCrmFieldsResolver } from './api/customer-group-crm-fields.resolver';
import { CustomerGroupGuardResolver } from './api/customer-group-guard.resolver';
import { CustomerNoteGuardResolver } from './api/customer-note-guard.resolver';
import { crmErrorTranslations } from './common/crm-errors';
import { crmCustomFields } from './config/custom-fields';
import { crmAdminPermission } from './constants';
import { MembershipRulesService } from './services/membership-rules.service';
import { NoteOwnershipService } from './services/note-ownership.service';

/**
 * In-house CRM on top of Vendure customers and customer groups (spec: "CRM Vendure —
 * fonctionnalités validées avant cahier des charges", v3).
 *
 * POC scope: membership rules (R1-R3) and note ownership (N3) enforced on the native
 * mutations, CRM fields on customer groups, page blocks on the customer, customer group
 * and draft order pages.
 */
@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [MembershipRulesService, NoteOwnershipService],
    adminApiExtensions: {
        schema: adminApiExtensions,
        resolvers: [CustomerGroupGuardResolver, CustomerNoteGuardResolver, CustomerGroupCrmFieldsResolver],
    },
    configuration: config => ({
        ...config,
        authOptions: {
            ...config.authOptions,
            customPermissions: [...config.authOptions.customPermissions, crmAdminPermission],
        },
        customFields: {
            ...config.customFields,
            CustomerGroup: [...(config.customFields.CustomerGroup ?? []), ...(crmCustomFields.CustomerGroup ?? [])],
        },
    }),
    compatibility: '^3.0.0',
    dashboard: './dashboard/index.tsx',
})
export class CrmPlugin implements OnApplicationBootstrap {
    constructor(private i18nService: I18nService) {}

    onApplicationBootstrap() {
        for (const [language, resources] of Object.entries(crmErrorTranslations)) {
            this.i18nService.addTranslation(language, resources);
        }
    }
}
