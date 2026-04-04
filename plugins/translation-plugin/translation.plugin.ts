import { OnApplicationBootstrap } from '@nestjs/common';
import {
    ChannelService,
    PluginCommonModule,
    RequestContext,
    RequestContextService,
    Type,
    VendurePlugin,
} from '@vendure/core';

import { adminApiExtensions, shopApiExtensions } from './api/api-extensions';
import { TranslationAdminResolver } from './api/translation-admin.resolver';
import { TranslationShopResolver } from './api/translation-shop.resolver';
import { CmsTranslationEntry } from './entities/cms-translation-entry.entity';
import { TranslationLanguage } from './entities/translation-language.entity';
import { CmsTranslationService } from './services/cms-translation.service';
import { TranslationLanguageService, LanguageInput } from './services/translation-language.service';

interface TranslationPluginOptions {
    languages: LanguageInput[];
}

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [TranslationLanguage, CmsTranslationEntry],
    adminApiExtensions: {
        schema: adminApiExtensions,
        resolvers: [TranslationAdminResolver],
    },
    shopApiExtensions: {
        schema: shopApiExtensions,
        resolvers: [TranslationShopResolver],
    },
    providers: [TranslationLanguageService, CmsTranslationService],
    compatibility: '^3.0.0',
    dashboard: './dashboard/index.tsx',
})
export class TranslationPlugin implements OnApplicationBootstrap {
    private static options: TranslationPluginOptions = { languages: [] };

    constructor(
        private translationLanguageService: TranslationLanguageService,
        private channelService: ChannelService,
        private requestContextService: RequestContextService,
    ) {}

    static init(options: TranslationPluginOptions): Type<TranslationPlugin> {
        TranslationPlugin.options = options;
        return TranslationPlugin;
    }

    async onApplicationBootstrap(): Promise<void> {
        if (TranslationPlugin.options.languages.length === 0) return;

        const ctx = await this.requestContextService.create({
            apiType: 'admin',
        });
        await this.translationLanguageService.seedIfEmpty(ctx, TranslationPlugin.options.languages);
    }
}
