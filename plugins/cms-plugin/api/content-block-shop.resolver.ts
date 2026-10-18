import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';

import { ContentBlockService } from '../services/content-block.service';

@Resolver()
export class ContentBlockShopResolver {
    constructor(private contentBlockService: ContentBlockService) {}

    @Query()
    @Allow(Permission.Public)
    async contentBlock(@Ctx() ctx: RequestContext, @Args() args: { id: string }) {
        return this.contentBlockService.findOne(ctx, args.id, true);
    }

    @Query()
    @Allow(Permission.Public)
    async contentBlockByKey(@Ctx() ctx: RequestContext, @Args() args: { key: string }) {
        return this.contentBlockService.findByKey(ctx, args.key, true);
    }

    @Query()
    @Allow(Permission.Public)
    async contentBlocks(@Ctx() ctx: RequestContext, @Args() args: { options: any }) {
        return this.contentBlockService.findAll(ctx, args.options, true);
    }
}
