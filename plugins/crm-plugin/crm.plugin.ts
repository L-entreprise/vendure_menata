import { OnApplicationBootstrap } from '@nestjs/common';
import { CustomFields, I18nService, PluginCommonModule, RuntimeVendureConfig, VendurePlugin } from '@vendure/core';

import { adminApiExtensions } from './api/api-extensions';
import { CrmSettingsResolver } from './api/crm-settings.resolver';
import { CustomerCrmFieldsResolver, CustomerStatusResolver } from './api/customer-crm.resolver';
import { CustomerGroupCrmFieldsResolver } from './api/customer-group-crm-fields.resolver';
import { CustomerGroupGuardResolver } from './api/customer-group-guard.resolver';
import { CustomerNoteGuardResolver } from './api/customer-note-guard.resolver';
import { crmErrorTranslations } from './common/crm-errors';
import './common/history-types';
import { crmCustomFields } from './config/custom-fields';
import { crmAdminPermission } from './constants';
import { CrmSettings } from './entities/crm-settings.entity';
import { CrmSettingsService } from './services/crm-settings.service';
import { CustomerStatusService } from './services/customer-status.service';
import { MembershipRulesService } from './services/membership-rules.service';
import { NoteOwnershipService } from './services/note-ownership.service';

function mergeCustomFields<T extends CustomFields>(existing: T, added: CustomFields): T {
    const entityNames = Object.keys(added) as Array<keyof CustomFields>;
    return entityNames.reduce(
        (merged, entityName) => ({
            ...merged,
            [entityName]: [...(existing[entityName] ?? []), ...(added[entityName] ?? [])],
        }),
        existing,
    );
}

function configure(config: RuntimeVendureConfig): RuntimeVendureConfig {
    return {
        ...config,
        authOptions: {
            ...config.authOptions,
            customPermissions: [...config.authOptions.customPermissions, crmAdminPermission],
        },
        customFields: mergeCustomFields(config.customFields, crmCustomFields),
    };
}

/**
 * In-house CRM on top of Vendure customers and customer groups (spec: "CRM Vendure -
 * fonctionnalités validées avant cahier des charges", v3). See README.md.
 */
@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [CrmSettings],
    providers: [CrmSettingsService, CustomerStatusService, MembershipRulesService, NoteOwnershipService],
    adminApiExtensions: {
        schema: adminApiExtensions,
        resolvers: [
            CrmSettingsResolver,
            CustomerCrmFieldsResolver,
            CustomerStatusResolver,
            CustomerGroupCrmFieldsResolver,
            CustomerGroupGuardResolver,
            CustomerNoteGuardResolver,
        ],
    },
    configuration: configure,
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
