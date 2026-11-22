import { Args, Mutation, Resolver } from '@nestjs/graphql';
import {
    MutationAddCustomersToGroupArgs,
    MutationCreateCustomerGroupArgs,
    MutationUpdateCustomerGroupArgs,
    Permission,
} from '@vendure/common/lib/generated-types';
import { Allow, Ctx, CustomerGroupService, RequestContext, Transaction } from '@vendure/core';

import { JournalService } from '../services/journal.service';
import { LifecycleService } from '../services/lifecycle.service';
import { MembershipRulesService, nextStructure } from '../services/membership-rules.service';

type CustomFieldsInput = Record<string, unknown>;

/** Computed by LifecycleService (T1); never taken from API input. */
const COMPUTED_FIELDS = ['lifecycle', 'lifecycleVia', 'lastCountedOrderAt'];

function withoutComputed(customFields: CustomFieldsInput): CustomFieldsInput {
    return Object.fromEntries(Object.entries(customFields).filter(([key]) => !COMPUTED_FIELDS.includes(key)));
}

/**
 * Replaces the native `createCustomerGroup`, `updateCustomerGroup` and `addCustomersToGroup`
 * mutations (same names, same permissions, same service calls) to enforce R1-R5 and the
 * super-admin-only structure fields before writing. Vendure merges plugin resolvers after
 * its own, so these win; the e2e specs prove it.
 */
@Resolver()
export class CustomerGroupGuardResolver {
    constructor(
        private customerGroupService: CustomerGroupService,
        private membershipRules: MembershipRulesService,
        private lifecycle: LifecycleService,
        private journal: JournalService,
    ) {}

    @Transaction()
    @Mutation()
    @Allow(Permission.CreateCustomerGroup)
    async createCustomerGroup(@Ctx() ctx: RequestContext, @Args() args: MutationCreateCustomerGroupArgs) {
        const customFields = withoutComputed((args.input.customFields ?? {}) as CustomFieldsInput);
        const empty = { groupType: null, memberScope: null };
        const structure = nextStructure(empty, customFields);
        this.membershipRules.assertCanChangeStructure(ctx, empty, structure);
        const input = { ...args.input, customFields: { ...customFields, ...structure } };
        await this.membershipRules.assertCustomersCanJoin(
            ctx,
            { name: input.name, ...structure },
            input.customerIds ?? [],
        );
        const group = await this.customerGroupService.create(ctx, input);
        await this.lifecycle.recompute(ctx, group.id);
        return group;
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.UpdateCustomerGroup)
    async updateCustomerGroup(@Ctx() ctx: RequestContext, @Args() args: MutationUpdateCustomerGroupArgs) {
        const current = await this.membershipRules.loadProfile(ctx, args.input.id);
        const customFields = withoutComputed((args.input.customFields ?? {}) as CustomFieldsInput);
        const structure = nextStructure(current, customFields);
        this.membershipRules.assertCanChangeStructure(ctx, current, structure);
        await this.membershipRules.assertStructureChangeAllowed(ctx, current, structure);
        const group = await this.customerGroupService.update(ctx, {
            ...args.input,
            customFields: { ...customFields, ...structure },
        });
        const typeChanged = structure.groupType !== current.groupType;
        if (typeChanged) {
            await this.lifecycle.recomputeWithAncestors(ctx, group.id);
        }
        const fields = [...Object.keys(args.input).filter(key => key !== 'id' && key !== 'customFields'), ...Object.keys(customFields)];
        await this.journal.record(ctx, group.id, typeChanged ? 'type-changed' : 'updated', {
            fields: fields.join(', '),
            ...(typeChanged ? { from: current.groupType ?? null, to: structure.groupType ?? null } : {}),
        });
        return group;
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
