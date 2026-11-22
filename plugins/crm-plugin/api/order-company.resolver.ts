import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { Permission } from '@vendure/common/lib/generated-types';
import { Administrator, Allow, Ctx, ID, Order, OrderService, RequestContext, Transaction, TransactionalConnection } from '@vendure/core';

import { crmAdminPermission } from '../constants';
import { GroupOrdersOptions, GroupSalesService } from '../services/group-sales.service';
import { OrderCompanyService } from '../services/order-company.service';

/** O1 / O6 on orders, O2-O5 group sales. */
@Resolver()
export class OrderCompanyResolver {
    constructor(
        private orderService: OrderService,
        private orderCompany: OrderCompanyService,
        private sales: GroupSalesService,
    ) {}

    /** Replaces the native mutation (same permission and service call) to record the creator as sales rep (O6). */
    @Transaction()
    @Mutation()
    @Allow(Permission.CreateOrder)
    async createDraftOrder(@Ctx() ctx: RequestContext): Promise<Order> {
        const order = await this.orderService.createDraft(ctx);
        await this.orderCompany.setCreatorAsSalesRep(ctx, order.id);
        return order;
    }

    @Transaction()
    @Mutation()
    @Allow(crmAdminPermission.Permission)
    setOrderCompany(@Ctx() ctx: RequestContext, @Args() args: { orderId: ID; companyId?: ID | null }) {
        return this.orderCompany.setOrderCompany(ctx, args.orderId, args.companyId ?? null);
    }

    @Query()
    @Allow(Permission.ReadOrder)
    crmGroupOrders(@Ctx() ctx: RequestContext, @Args() args: { groupId: ID; options?: GroupOrdersOptions }) {
        return this.sales.groupOrders(ctx, args.groupId, args.options ?? {});
    }

    @Query()
    @Allow(Permission.ReadOrder)
    crmGroupSalesSummary(@Ctx() ctx: RequestContext, @Args() args: { groupId: ID; from?: Date; to?: Date }) {
        return this.sales.summary(ctx, args.groupId, args.from, args.to);
    }
}

/** Order.crmSalesRepName: the name only, so sales reps never need ReadAdministrator. */
@Resolver('Order')
export class OrderCrmFieldsResolver {
    constructor(private connection: TransactionalConnection) {}

    @ResolveField()
    async crmSalesRepName(@Ctx() ctx: RequestContext, @Parent() order: Order): Promise<string | null> {
        const loaded = await this.connection
            .getRepository(ctx, Order)
            .findOne({ where: { id: order.id }, relations: { customFields: { salesRep: true } } as any });
        const salesRep = (loaded?.customFields as { salesRep?: Administrator | null } | undefined)?.salesRep;
        return salesRep ? `${salesRep.firstName} ${salesRep.lastName}`.trim() : null;
    }
}
