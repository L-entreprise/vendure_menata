import { Injectable } from '@nestjs/common';
import { Customer, CustomerGroup, ID, Order, RequestContext, TransactionalConnection } from '@vendure/core';
import { Between, In, IsNull, LessThanOrEqual, MoreThanOrEqual, Not } from 'typeorm';

import { descendantsOf } from '../common/group-graph';

import { HierarchyService } from './hierarchy.service';
import { LifecycleService } from './lifecycle.service';

const MAX_PAGE = 100;

export interface GroupOrdersOptions {
    from?: Date | null;
    to?: Date | null;
    states?: string[] | null;
    subsidiaryId?: ID | null;
    customerId?: ID | null;
    skip?: number | null;
    take?: number | null;
}

export interface GroupOrderRow {
    order: Order;
    company: CustomerGroup | null;
    customer: Customer | null;
}

export interface SalesSummary {
    orderCount: number;
    total: number;
    totalWithTax: number;
    averageWithTax: number;
    lastOrderAt: Date | null;
    currencyCode: string | null;
}

/**
 * O2-O5: the orders frozen on a group or on any group below it (5 levels max), each once
 * even when a subsidiary has several parents, with the subsidiary and contact (O3) and
 * totals over the counted orders (O4).
 */
@Injectable()
export class GroupSalesService {
    constructor(
        private connection: TransactionalConnection,
        private hierarchy: HierarchyService,
        private lifecycle: LifecycleService,
    ) {}

    async companyIds(ctx: RequestContext, groupId: ID, subsidiaryId?: ID | null): Promise<string[]> {
        const graph = await this.hierarchy.graph(ctx);
        const scope = [String(groupId), ...descendantsOf(graph, groupId)];
        if (!subsidiaryId) {
            return scope;
        }
        const branch = new Set([String(subsidiaryId), ...descendantsOf(graph, subsidiaryId)]);
        return scope.filter(id => branch.has(id));
    }

    async groupOrders(ctx: RequestContext, groupId: ID, options: GroupOrdersOptions = {}) {
        const ids = await this.companyIds(ctx, groupId, options.subsidiaryId);
        if (ids.length === 0) {
            return { items: [], totalItems: 0 };
        }
        const [orders, totalItems] = await this.connection.getRepository(ctx, Order).findAndCount({
            where: {
                orderPlacedAt: placedBetween(options.from, options.to),
                customFields: { companyGroup: { id: In(ids) } },
                ...(options.states?.length ? { state: In(options.states) } : {}),
                ...(options.customerId ? { customer: { id: options.customerId } } : {}),
            } as any,
            relations: { customer: true, customFields: { companyGroup: true } } as any,
            order: { orderPlacedAt: 'DESC' },
            skip: options.skip ?? 0,
            take: Math.min(options.take ?? 25, MAX_PAGE),
        });
        const items: GroupOrderRow[] = orders.map(order => ({
            order,
            company: (order.customFields as { companyGroup?: CustomerGroup | null }).companyGroup ?? null,
            customer: order.customer ?? null,
        }));
        return { items, totalItems };
    }

    async summary(ctx: RequestContext, groupId: ID, from?: Date | null, to?: Date | null): Promise<SalesSummary> {
        const ids = await this.companyIds(ctx, groupId);
        const inPeriod = (await this.lifecycle.countedOrders(ctx, ids)).filter(order => {
            const placed = order.orderPlacedAt?.getTime() ?? 0;
            return (!from || placed >= from.getTime()) && (!to || placed <= to.getTime());
        });
        const totalWithTax = inPeriod.reduce((sum, order) => sum + order.totalWithTax, 0);
        const last = inPeriod.reduce<Date | null>((latest, order) => {
            const placed = order.orderPlacedAt ?? null;
            return placed && (!latest || placed > latest) ? placed : latest;
        }, null);
        return {
            orderCount: inPeriod.length,
            total: inPeriod.reduce((sum, order) => sum + order.total, 0),
            totalWithTax,
            averageWithTax: inPeriod.length ? Math.round(totalWithTax / inPeriod.length) : 0,
            lastOrderAt: last,
            currencyCode: inPeriod[0]?.currencyCode ?? null,
        };
    }
}

function placedBetween(from?: Date | null, to?: Date | null) {
    if (from && to) {
        return Between(from, to);
    }
    if (from) {
        return MoreThanOrEqual(from);
    }
    return to ? LessThanOrEqual(to) : Not(IsNull());
}

