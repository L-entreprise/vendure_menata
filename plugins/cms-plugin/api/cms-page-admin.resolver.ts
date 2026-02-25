import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
    Allow,
    Ctx,
    RequestContext,
    Transaction,
} from '@vendure/core';

import { cmsPagePermission } from '../constants';
import { CmsPageService } from '../services/cms-page.service';

@Resolver()
export class CmsPageAdminResolver {
    constructor(private cmsPageService: CmsPageService) {}

    @Query()
    @Allow(cmsPagePermission.Read)
    async cmsPage(@Ctx() ctx: RequestContext, @Args() args: { id: string }) {
        return this.cmsPageService.findOne(ctx, args.id);
    }

    @Query()
    @Allow(cmsPagePermission.Read)
    async cmsPages(@Ctx() ctx: RequestContext, @Args() args: { options: any }) {
        return this.cmsPageService.findAll(ctx, args.options);
    }

    @Transaction()
    @Mutation()
    @Allow(cmsPagePermission.Create)
    async createCmsPage(@Ctx() ctx: RequestContext, @Args() args: { input: any }) {
        return this.cmsPageService.create(ctx, args.input);
    }

    @Transaction()
    @Mutation()
    @Allow(cmsPagePermission.Update)
    async updateCmsPage(@Ctx() ctx: RequestContext, @Args() args: { input: any }) {
        return this.cmsPageService.update(ctx, args.input);
    }

    @Transaction()
    @Mutation()
    @Allow(cmsPagePermission.Delete)
    async deleteCmsPage(@Ctx() ctx: RequestContext, @Args() args: { id: string }) {
        return this.cmsPageService.delete(ctx, args.id);
    }
}
