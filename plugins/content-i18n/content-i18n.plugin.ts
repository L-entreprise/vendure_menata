import { PluginCommonModule, VendurePlugin } from '@vendure/core';

import { adminApiExtensions } from './api/api-extensions';
import { ProductProgressEntityResolver, ProductProgressResolver } from './api/product-progress.resolver';
import { ProductTranslationService } from './services/product-translation.service';

/**
 * Translations on Vendure's native system: product translation progress (Admin API),
 * and dashboard extensions — content language switcher next to the alerts bell,
 * progress column and panel on products, original text under translated fields,
 * "original changed" dialog, incomplete-translation alerts.
 */
@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [ProductTranslationService],
    adminApiExtensions: {
        schema: adminApiExtensions,
        resolvers: [ProductProgressEntityResolver, ProductProgressResolver],
    },
    compatibility: '^3.0.0',
    dashboard: './dashboard/index.tsx',
})
export class ContentI18nPlugin {}
