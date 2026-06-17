import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';

import { adminApiExtensions } from './api/api-extensions';
import { DiagnosticsAdminResolver } from './api/diagnostics-admin.resolver';
import { DIAGNOSTICS_PLUGIN_OPTIONS } from './constants';
import { DiagnosticsService } from './services/diagnostics.service';
import { DiagnosticsPluginOptions } from './types';

/**
 * Surfaces a client's frozen Menata web-diagnostic inside their Vendure admin.
 *
 * Architecture: "central authority + thin plugin". The diagnostic HTML and its
 * business validity window live on the Menata Nuxt site (single source of truth).
 * This plugin holds no diagnostic data — on each admin page open its resolver
 * calls Menata server-to-server (per-client Bearer key) and renders the returned
 * HTML in a sandboxed iframe. Nothing leakable ever reaches the browser.
 *
 * All config is per-instance via env (see {@link DiagnosticsPluginOptions}); each
 * client has its own Vendure deployment, hence its own clientId + apiKey.
 */
@VendurePlugin({
    imports: [PluginCommonModule],
    adminApiExtensions: {
        schema: adminApiExtensions,
        resolvers: [DiagnosticsAdminResolver],
    },
    providers: [
        DiagnosticsService,
        {
            provide: DIAGNOSTICS_PLUGIN_OPTIONS,
            useFactory: () => DiagnosticsPlugin.options,
        },
    ],
    compatibility: '^3.0.0',
    dashboard: './dashboard/index.tsx',
})
export class DiagnosticsPlugin {
    static options: DiagnosticsPluginOptions;

    static init(options: DiagnosticsPluginOptions): Type<DiagnosticsPlugin> {
        DiagnosticsPlugin.options = options;
        return DiagnosticsPlugin;
    }
}
