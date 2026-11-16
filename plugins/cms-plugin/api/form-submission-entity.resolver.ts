import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Ctx, RequestContext } from '@vendure/core';

import { FormSubmission } from '../entities/form-submission.entity';
import { FormSubmissionService } from '../services/form-submission.service';

/** Admin-only: the translated texts of a collection entry, per language. */
@Resolver('FormSubmission')
export class FormSubmissionEntityAdminResolver {
    constructor(private formSubmissionService: FormSubmissionService) {}

    @ResolveField()
    async translations(@Ctx() ctx: RequestContext, @Parent() submission: FormSubmission) {
        return this.formSubmissionService.findTranslations(ctx, submission);
    }
}
