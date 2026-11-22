import { Args, Mutation, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Permission } from '@vendure/common/lib/generated-types';
import { Allow, Ctx, Customer, ID, RequestContext, Transaction } from '@vendure/core';

import { crmCode } from '../common/crm-codes';
import { CustomerStatusService } from '../services/customer-status.service';

/** Customer.crmCode / Customer.crmStatus (I1, C3). */
@Resolver('Customer')
export class CustomerCrmFieldsResolver {
    constructor(private statusService: CustomerStatusService) {}

    @ResolveField()
    crmCode(@Parent() customer: Customer): string {
        return crmCode('CLI', customer.id);
    }

    @ResolveField()
    crmStatus(@Ctx() ctx: RequestContext, @Parent() customer: Customer): Promise<string> {
        return this.statusService.effectiveStatus(ctx, customer);
    }
}

/** C3: the status is read-only in the customer form and changes only through this mutation. */
@Resolver()
export class CustomerStatusResolver {
    constructor(private statusService: CustomerStatusService) {}

    @Transaction()
    @Mutation()
    @Allow(Permission.UpdateCustomer)
    setCustomerStatus(
        @Ctx() ctx: RequestContext,
        @Args() args: { customerId: ID; status: string },
    ): Promise<Customer> {
        return this.statusService.setStatus(ctx, args.customerId, args.status);
    }
}
