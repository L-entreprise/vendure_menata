import { OnApplicationBootstrap } from '@nestjs/common';
import { CustomFields, I18nService, PluginCommonModule, RuntimeVendureConfig, VendurePlugin } from '@vendure/core';

import { adminApiExtensions } from './api/api-extensions';
import { crmErrorTranslations } from './common/crm-errors';
import './common/history-types';
import { crmCustomFields } from './config/custom-fields';
import { CRM_ADMIN_RESOLVERS, CRM_ENTITIES, CRM_PROVIDERS } from './config/plugin-parts';
import { CRM_SCHEDULED_TASKS } from './config/scheduled-tasks';
import { crmAdminPermission } from './constants';

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
        schedulerOptions: {
            ...config.schedulerOptions,
            tasks: [...(config.schedulerOptions.tasks ?? []), ...CRM_SCHEDULED_TASKS],
        },
    };
}

/**
 * In-house CRM on top of Vendure customers and customer groups (spec: "CRM Vendure -
 * fonctionnalités validées avant cahier des charges", v3). See README.md.
 */
@VendurePlugin({
    imports: [PluginCommonModule],
    entities: CRM_ENTITIES,
    providers: CRM_PROVIDERS,
    adminApiExtensions: {
        schema: adminApiExtensions,
        resolvers: CRM_ADMIN_RESOLVERS,
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
