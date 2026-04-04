import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';

import { CmsTranslationService } from '../services/cms-translation.service';

@Resolver()
export class TranslationShopResolver {
    constructor(private cmsTranslationService: CmsTranslationService) {}

    @Query()
    @Allow(Permission.Public)
    async cmsPageTranslations(
        @Ctx() ctx: RequestContext,
        @Args() args: { pageId: string; languageCode: string },
    ) {
        const results = await this.cmsTranslationService.findByPage(ctx, args.pageId, args.languageCode);
        return results[0] ?? null;
    }

    @Query()
    @Allow(Permission.Public)
    async cmsPageTranslationsByKey(
        @Ctx() ctx: RequestContext,
        @Args() args: { pageKey: string; languageCode: string },
    ) {
        return this.cmsTranslationService.findByPageKey(ctx, args.pageKey, args.languageCode);
    }

    @Query()
    @Allow(Permission.Public)
    async collectionEntryTranslations(
        @Ctx() ctx: RequestContext,
        @Args() args: { pageId: string; entryId: string; languageCode: string },
    ) {
        const results = await this.cmsTranslationService.findByEntry(
            ctx, args.pageId, args.entryId, args.languageCode,
        );
        return results[0] ?? null;
    }
}
