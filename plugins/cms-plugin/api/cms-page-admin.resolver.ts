import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
    Allow,
    Ctx,
    RequestContext,
    Transaction,
} from '@vendure/core';

import { cmsPagePermission } from '../constants';
import { CmsPageService } from '../services/cms-page.service';
import { FormSubmissionService } from '../services/form-submission.service';
import {
    CreateCmsPageInput,
    CreateCollectionEntryInput,
    ListQueryArgs,
    UpdateCmsPageInput,
    UpdateCollectionEntryInput,
} from './types';

@Resolver()
export class CmsPageAdminResolver {
    constructor(
        private cmsPageService: CmsPageService,
        private formSubmissionService: FormSubmissionService,
    ) {}

    @Query()
    @Allow(cmsPagePermission.Read)
    async cmsPage(@Ctx() ctx: RequestContext, @Args() args: { id: string }) {
        return this.cmsPageService.findOne(ctx, args.id);
    }

    @Query()
    @Allow(cmsPagePermission.Read)
    async cmsPages(@Ctx() ctx: RequestContext, @Args() args: ListQueryArgs) {
        return this.cmsPageService.findAll(ctx, args.options);
    }

    @Query()
    @Allow(cmsPagePermission.Read)
    async pinnedCmsPages(@Ctx() ctx: RequestContext) {
        return this.cmsPageService.findPinned(ctx);
    }

    @Transaction()
    @Mutation()
    @Allow(cmsPagePermission.Create)
    async createCmsPage(@Ctx() ctx: RequestContext, @Args() args: { input: CreateCmsPageInput }) {
        return this.cmsPageService.create(ctx, args.input);
    }

    @Transaction()
    @Mutation()
    @Allow(cmsPagePermission.Update)
    async updateCmsPage(@Ctx() ctx: RequestContext, @Args() args: { input: UpdateCmsPageInput }) {
        return this.cmsPageService.update(ctx, args.input);
    }

    @Transaction()
    @Mutation()
    @Allow(cmsPagePermission.Delete)
    async deleteCmsPage(@Ctx() ctx: RequestContext, @Args() args: { id: string }) {
        return this.cmsPageService.delete(ctx, args.id);
    }

    @Transaction()
    @Mutation()
    @Allow(cmsPagePermission.Create)
    async createCollectionEntry(
        @Ctx() ctx: RequestContext,
        @Args() args: { input: CreateCollectionEntryInput },
    ) {
        return this.formSubmissionService.createEntry(ctx, args.input);
    }

    @Transaction()
    @Mutation()
    @Allow(cmsPagePermission.Update)
    async updateCollectionEntry(
        @Ctx() ctx: RequestContext,
        @Args() args: { input: UpdateCollectionEntryInput },
    ) {
        return this.formSubmissionService.updateEntry(ctx, args.input);
    }

    @Transaction()
    @Mutation()
    @Allow(cmsPagePermission.Update)
    async createCustomerFromSubmission(
        @Ctx() ctx: RequestContext,
        @Args() args: { submissionId: string },
    ) {
        return this.formSubmissionService.createCustomerFromSubmission(ctx, args.submissionId);
    }
}
