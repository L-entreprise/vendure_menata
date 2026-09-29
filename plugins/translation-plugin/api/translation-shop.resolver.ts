import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';

import { ShopTranslationService } from '../services/shop-translation.service';

@Resolver()
export class TranslationShopResolver {
    constructor(private shopTranslationService: ShopTranslationService) {}

    @Query()
    @Allow(Permission.Public)
    async cmsPageTranslations(
        @Ctx() ctx: RequestContext,
        @Args() args: { pageId: string; languageCode: string },
    ) {
        return this.shopTranslationService.pageTranslations(ctx, { id: args.pageId }, args.languageCode);
    }

    @Query()
    @Allow(Permission.Public)
    async cmsPageTranslationsByKey(
        @Ctx() ctx: RequestContext,
        @Args() args: { pageKey: string; languageCode: string },
    ) {
        return this.shopTranslationService.pageTranslations(ctx, { key: args.pageKey }, args.languageCode);
    }

    @Query()
    @Allow(Permission.Public)
    async collectionEntryTranslations(
        @Ctx() ctx: RequestContext,
        @Args() args: { pageId: string; entryId: string; languageCode: string },
    ) {
        return this.shopTranslationService.collectionEntryTranslations(
            ctx, args.pageId, args.entryId, args.languageCode,
        );
    }

    @Query()
    @Allow(Permission.Public)
    async collectionTranslationsByKey(
        @Ctx() ctx: RequestContext,
        @Args() args: { pageKey: string; languageCode: string },
    ) {
        return this.shopTranslationService.collectionTranslationsByKey(ctx, args.pageKey, args.languageCode);
    }
}
