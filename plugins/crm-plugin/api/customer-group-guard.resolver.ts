import { Args, Mutation, Resolver } from '@nestjs/graphql';
import {
    MutationAddCustomersToGroupArgs,
    MutationCreateCustomerGroupArgs,
    Permission,
} from '@vendure/common/lib/generated-types';
import { Allow, Ctx, CustomerGroupService, RequestContext, Transaction } from '@vendure/core';

import { MembershipRulesService, resolveMemberScope } from '../services/membership-rules.service';

/**
 * Replaces the native `createCustomerGroup` and `addCustomersToGroup` mutations (same
 * names, same permissions, same service calls) to enforce R1, R2 and R3 before writing.
 * Vendure merges plugin resolvers after its own, so these win; the e2e specs prove it.
 */
@Resolver()
export class CustomerGroupGuardResolver {
    constructor(
        private customerGroupService: CustomerGroupService,
        private membershipRules: MembershipRulesService,
    ) {}

    @Transaction()
    @Mutation()
    @Allow(Permission.CreateCustomerGroup)
    async createCustomerGroup(@Ctx() ctx: RequestContext, @Args() args: MutationCreateCustomerGroupArgs) {
        const customFields = (args.input.customFields ?? {}) as Record<string, string | null | undefined>;
        const memberScope = customFields.groupType ? resolveMemberScope(customFields) : customFields.memberScope;
        const input = {
            ...args.input,
            customFields: { ...customFields, ...(memberScope ? { memberScope } : {}) },
        };
        await this.membershipRules.assertCustomersCanJoin(
            ctx,
            { name: input.name, groupType: customFields.groupType, memberScope },
            input.customerIds ?? [],
        );
        return this.customerGroupService.create(ctx, input);
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.UpdateCustomerGroup)
    async addCustomersToGroup(@Ctx() ctx: RequestContext, @Args() args: MutationAddCustomersToGroupArgs) {
        const group = await this.membershipRules.loadProfile(ctx, args.customerGroupId);
        await this.membershipRules.assertCustomersCanJoin(ctx, group, args.customerIds);
        return this.customerGroupService.addCustomersToGroup(ctx, args);
    }
}
