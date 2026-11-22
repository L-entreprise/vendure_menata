import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { DeletionResult, Permission } from '@vendure/common/lib/generated-types';
import { Allow, Ctx, ID, RequestContext, Transaction } from '@vendure/core';

import { GroupAddressInput, GroupAddressService } from '../services/group-address.service';

/** A1 address books (sales reps edit them), A2 draft by company, A3 suggestions. */
@Resolver()
export class GroupAddressResolver {
    constructor(private addresses: GroupAddressService) {}

    @Query()
    @Allow(Permission.ReadCustomerGroup)
    customerGroupAddresses(@Ctx() ctx: RequestContext, @Args() args: { groupId: ID }) {
        return this.addresses.list(ctx, args.groupId);
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.UpdateCustomerGroup)
    createCustomerGroupAddress(@Ctx() ctx: RequestContext, @Args() args: { groupId: ID; input: GroupAddressInput }) {
        return this.addresses.create(ctx, args.groupId, args.input);
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.UpdateCustomerGroup)
    updateCustomerGroupAddress(@Ctx() ctx: RequestContext, @Args() args: { id: ID; input: GroupAddressInput }) {
        return this.addresses.update(ctx, args.id, args.input);
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.UpdateCustomerGroup)
    async deleteCustomerGroupAddress(@Ctx() ctx: RequestContext, @Args() args: { id: ID }) {
        await this.addresses.remove(ctx, args.id);
        return { result: DeletionResult.DELETED };
    }

    @Query()
    @Allow(Permission.ReadCustomer)
    crmAddressSuggestions(@Ctx() ctx: RequestContext, @Args() args: { customerId: ID }) {
        return this.addresses.suggestions(ctx, args.customerId);
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.UpdateOrder)
    setDraftOrderCompany(@Ctx() ctx: RequestContext, @Args() args: { orderId: ID; companyId: ID }) {
        return this.addresses.setDraftOrderCompany(ctx, args.orderId, args.companyId);
    }
}
