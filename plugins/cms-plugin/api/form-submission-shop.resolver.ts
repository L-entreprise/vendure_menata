import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext, Transaction } from '@vendure/core';

import { FormSubmissionService } from '../services/form-submission.service';
import { SubmitFormInput } from './types';

@Resolver()
export class FormSubmissionShopResolver {
    constructor(private formSubmissionService: FormSubmissionService) {}

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
