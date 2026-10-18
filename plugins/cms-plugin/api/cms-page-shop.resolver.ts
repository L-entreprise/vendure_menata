import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow, AssetService, Ctx, ID, Permission, RequestContext } from '@vendure/core';

import { CmsPageService } from '../services/cms-page.service';

@Resolver()
export class CmsPageShopResolver {
    constructor(
        private cmsPageService: CmsPageService,
        private assetService: AssetService,
    ) {}

    @Query()
    @Allow(Permission.Public)
    async cmsPage(@Ctx() ctx: RequestContext, @Args() args: { id: string }) {
        return this.cmsPageService.findOne(ctx, args.id, true);
    }

    @Query()
    @Allow(Permission.Public)
    async cmsPageByKey(@Ctx() ctx: RequestContext, @Args() args: { key: string }) {
        return this.cmsPageService.findByKey(ctx, args.key, true);
    }

    @Query()
    @Allow(Permission.Public)
    async cmsPages(@Ctx() ctx: RequestContext, @Args() args: { options: any }) {
        return this.cmsPageService.findAll(ctx, args.options, true);
    }

    /**
     * Resolves image asset IDs (stored in collection-entry `data` or as IMAGE
     * translation values) into full Asset objects. The core Asset GraphQL type
     * applies the configured assetUrlPrefix, so `preview`/`source` come back as
     * ready-to-use public URLs.
     */
    @Query()
    @Allow(Permission.Public)
    async cmsAssets(@Ctx() ctx: RequestContext, @Args() args: { ids: ID[] }) {
        const assets = await Promise.all(
            (args.ids ?? []).map(id => this.assetService.findOne(ctx, id)),
        );
        return assets.filter(Boolean);
    }
}
