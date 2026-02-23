import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
    Allow,
    Ctx,
    RequestContext,
    Transaction,
} from '@vendure/core';

import { contentBlockPermission } from '../constants';
import { ContentBlockService } from '../services/content-block.service';

@Resolver()
export class ContentBlockAdminResolver {
    constructor(private contentBlockService: ContentBlockService) {}

    @Query()
    @Allow(contentBlockPermission.Read)
    async contentBlock(@Ctx() ctx: RequestContext, @Args() args: { id: string }) {
        return this.contentBlockService.findOne(ctx, args.id);
    }

    @Query()
    @Allow(contentBlockPermission.Read)
    async contentBlocks(@Ctx() ctx: RequestContext, @Args() args: { options: any }) {
        return this.contentBlockService.findAll(ctx, args.options);
    }

    @Transaction()
    @Mutation()
    @Allow(contentBlockPermission.Create)
    async createContentBlock(@Ctx() ctx: RequestContext, @Args() args: { input: any }) {
        return this.contentBlockService.create(ctx, args.input);
    }

    @Transaction()
    @Mutation()
    @Allow(contentBlockPermission.Update)
    async updateContentBlock(@Ctx() ctx: RequestContext, @Args() args: { input: any }) {
        return this.contentBlockService.update(ctx, args.input);
    }

    @Transaction()
    @Mutation()
    @Allow(contentBlockPermission.Delete)
    async deleteContentBlock(@Ctx() ctx: RequestContext, @Args() args: { id: string }) {
        return this.contentBlockService.delete(ctx, args.id);
    }
}
