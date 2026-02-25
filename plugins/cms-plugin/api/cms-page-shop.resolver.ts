import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';

import { CmsPageService } from '../services/cms-page.service';

@Resolver()
export class CmsPageShopResolver {
    constructor(private cmsPageService: CmsPageService) {}

    @Query()
    @Allow(Permission.Public)
    async cmsPage(@Ctx() ctx: RequestContext, @Args() args: { id: string }) {
        return this.cmsPageService.findOne(ctx, args.id);
    }

    @Query()
    @Allow(Permission.Public)
    async cmsPageByKey(@Ctx() ctx: RequestContext, @Args() args: { key: string }) {
        return this.cmsPageService.findByKey(ctx, args.key);
    }

    @Query()
    @Allow(Permission.Public)
    async cmsPages(@Ctx() ctx: RequestContext, @Args() args: { options: any }) {
        return this.cmsPageService.findAll(ctx, args.options);
    }
}
