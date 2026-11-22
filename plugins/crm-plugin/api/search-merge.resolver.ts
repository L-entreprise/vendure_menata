import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Permission } from '@vendure/common/lib/generated-types';
import { Allow, Ctx, ID, RequestContext, Transaction } from '@vendure/core';

import { canRead } from '../common/permissions';
import { crmAdminPermission } from '../constants';
import { CustomerInsightService } from '../services/customer-insight.service';
import { MergeService } from '../services/merge.service';
import { SearchService } from '../services/search.service';

/** S1 / I3 search and codes, C2 suggestions, D2 duplicate check, D3 audits and merge. */
@Resolver()
export class SearchMergeResolver {
    constructor(
        private search: SearchService,
        private insight: CustomerInsightService,
        private merger: MergeService,
    ) {}

    @Query()
    @Allow(Permission.ReadCustomer, Permission.ReadCustomerGroup)
    crmSearch(@Ctx() ctx: RequestContext, @Args() args: { term: string }) {
        return this.search.search(ctx, args.term, canRead(ctx));
    }

    @Query()
    @Allow(Permission.ReadCustomer, Permission.ReadCustomerGroup)
    crmResolveCode(@Ctx() ctx: RequestContext, @Args() args: { code: string }) {
        return this.search.resolveCode(ctx, args.code, canRead(ctx));
    }

    @Query()
    @Allow(Permission.ReadCustomer)
    crmCompanySuggestions(@Ctx() ctx: RequestContext, @Args() args: { customerId: ID }) {
        return this.insight.companySuggestions(ctx, args.customerId);
    }

    @Query()
    @Allow(Permission.ReadCustomer)
    crmCustomerByEmail(@Ctx() ctx: RequestContext, @Args() args: { email: string }) {
        return this.insight.customerByEmail(ctx, args.email);
    }

    @Query()
    @Allow(crmAdminPermission.Permission)
    crmDuplicateEmails(@Ctx() ctx: RequestContext) {
        return this.insight.duplicateEmails(ctx);
    }

    @Query()
    @Allow(crmAdminPermission.Permission)
    crmCompanyConflicts(@Ctx() ctx: RequestContext) {
        return this.insight.companyConflicts(ctx);
    }

    @Transaction()
    @Mutation()
    @Allow(crmAdminPermission.Permission)
    mergeCustomers(@Ctx() ctx: RequestContext, @Args() args: { sourceId: ID; targetId: ID }) {
        return this.merger.merge(ctx, args.sourceId, args.targetId);
    }
}
