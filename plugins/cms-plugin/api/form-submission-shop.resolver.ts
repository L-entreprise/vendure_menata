import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext, Transaction } from '@vendure/core';

import { FormSubmissionService } from '../services/form-submission.service';
import { ListQueryArgs, SubmitFormInput } from './types';

@Resolver()
export class FormSubmissionShopResolver {
    constructor(private formSubmissionService: FormSubmissionService) {}

    @Query()
    @Allow(Permission.Public)
    async collectionEntries(
        @Ctx() ctx: RequestContext,
        @Args() args: { pageKey: string; options?: ListQueryArgs['options'] },
    ) {
        return this.formSubmissionService.findCollectionEntries(ctx, args.pageKey, args.options);
    }

    @Query()
    @Allow(Permission.Public)
    async collectionEntry(
        @Ctx() ctx: RequestContext,
        @Args() args: { pageKey: string; entryId: string },
    ) {
        return this.formSubmissionService.findCollectionEntry(ctx, args.pageKey, args.entryId);
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.Public)
    async submitForm(
        @Ctx() ctx: RequestContext,
        @Args() args: { input: SubmitFormInput },
    ) {
        return this.formSubmissionService.submit(ctx, args.input);
    }
}
