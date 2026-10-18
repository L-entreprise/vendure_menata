import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, RequestContext, Transaction } from '@vendure/core';

import { cmsPagePermission } from '../constants';
import { FormSubmissionService } from '../services/form-submission.service';
import { ListQueryArgs } from './types';

@Resolver()
export class FormSubmissionAdminResolver {
    constructor(private formSubmissionService: FormSubmissionService) {}

    @Query()
    @Allow(cmsPagePermission.Read)
    async formSubmissions(
        @Ctx() ctx: RequestContext,
        @Args() args: { pageId: string; options?: ListQueryArgs['options'] },
    ) {
        return this.formSubmissionService.findByPage(ctx, args.pageId, args.options);
    }

    @Transaction()
    @Mutation()
    @Allow(cmsPagePermission.Delete)
    async deleteFormSubmission(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: string },
    ) {
        return this.formSubmissionService.delete(ctx, args.id);
    }
}
