import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Ctx, RequestContext } from '@vendure/core';

import { CmsPage } from '../entities/cms-page.entity';
import { CmsPageService } from '../services/cms-page.service';

/**
 * Admin-only `CmsPage` fields that need a lookup: the parent and the child pages
 * shown as tabs in the dashboard.
 */
@Resolver('CmsPage')
export class CmsPageEntityAdminResolver {
    constructor(private cmsPageService: CmsPageService) {}

    @ResolveField()
    async parent(@Ctx() ctx: RequestContext, @Parent() page: CmsPage) {
        return this.cmsPageService.findParent(ctx, page);
    }

    @ResolveField()
    async children(@Ctx() ctx: RequestContext, @Parent() page: CmsPage) {
        return this.cmsPageService.findChildren(ctx, page);
    }
}
