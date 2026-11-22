import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { Permission } from '@vendure/common/lib/generated-types';
import { Allow, Ctx, Customer, CustomerGroup, ID, RequestContext, Transaction } from '@vendure/core';

import { crmAdminPermission } from '../constants';
import { CustomerMembershipService } from '../services/customer-membership.service';
import { HierarchyService, TreeEntry } from '../services/hierarchy.service';

type LinkArgs = { childId: ID; parentId: ID };

/** G1-G6 (super admin writes), R3 move and R4 eligible groups (sales reps). */
@Resolver()
export class HierarchyResolver {
    constructor(
        private hierarchy: HierarchyService,
        private membership: CustomerMembershipService,
    ) {}

    @Transaction()
    @Mutation()
    @Allow(crmAdminPermission.Permission)
    addCustomerGroupParent(@Ctx() ctx: RequestContext, @Args() args: LinkArgs): Promise<CustomerGroup> {
        return this.hierarchy.addParent(ctx, args.childId, args.parentId);
    }

    @Transaction()
    @Mutation()
    @Allow(crmAdminPermission.Permission)
    removeCustomerGroupParent(@Ctx() ctx: RequestContext, @Args() args: LinkArgs): Promise<CustomerGroup> {
        return this.hierarchy.removeParent(ctx, args.childId, args.parentId);
    }

    @Query()
    @Allow(Permission.ReadCustomerGroup)
    crmGroupTree(@Ctx() ctx: RequestContext): Promise<TreeEntry[]> {
        return this.hierarchy.tree(ctx);
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.UpdateCustomerGroup)
    moveCustomerToCompany(
        @Ctx() ctx: RequestContext,
        @Args() args: { customerId: ID; companyId: ID },
    ): Promise<Customer> {
        return this.membership.moveToCompany(ctx, args.customerId, args.companyId);
    }

    @Query()
    @Allow(Permission.ReadCustomerGroup)
    crmEligibleGroups(@Ctx() ctx: RequestContext, @Args() args: { customerId: ID }): Promise<CustomerGroup[]> {
        return this.membership.eligibleGroups(ctx, args.customerId);
    }
}

/** Navigation fields of a group (G4). */
@Resolver('CustomerGroup')
export class CustomerGroupHierarchyFieldsResolver {
    constructor(private hierarchy: HierarchyService) {}

    @ResolveField()
    crmParents(@Ctx() ctx: RequestContext, @Parent() group: CustomerGroup) {
        return this.hierarchy.parents(ctx, group.id);
    }

    @ResolveField()
    crmChildren(@Ctx() ctx: RequestContext, @Parent() group: CustomerGroup) {
        return this.hierarchy.children(ctx, group.id);
    }

    @ResolveField()
    crmAncestors(@Ctx() ctx: RequestContext, @Parent() group: CustomerGroup) {
        return this.hierarchy.ancestors(ctx, group.id);
    }

    @ResolveField()
    crmBreadcrumb(@Ctx() ctx: RequestContext, @Parent() group: CustomerGroup) {
        return this.hierarchy.breadcrumb(ctx, group.id);
    }
}
