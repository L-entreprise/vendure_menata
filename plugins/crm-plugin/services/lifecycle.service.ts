import { Injectable } from '@nestjs/common';
import { CustomerGroup, ID, Order, RequestContext, TransactionalConnection } from '@vendure/core';
import { In } from 'typeorm';

import { COUNTED_ORDER_STATES, isCountedOrder } from '../common/counted-orders';
import { ancestorsOf, buildGraph, descendantsOf } from '../common/group-graph';
import { CustomerGroupEdge } from '../entities/customer-group-edge.entity';

import { CrmSettingsService } from './crm-settings.service';
import { JournalService } from './journal.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const LIFECYCLE_TYPES = ['company', 'companyGroup'];

export type Lifecycle = 'prospect' | 'client' | 'dormant';

interface LifecycleFields {
    lifecycle: Lifecycle | null;
    lifecycleVia: 'direct' | 'subsidiary' | null;
    lastCountedOrderAt: Date | null;
}

type GroupFields = Partial<LifecycleFields> & { groupType?: string | null };

/**
 * T1-T3: prospect / client / dormant, computed for companies and groups of companies from
 * the counted orders frozen on them or on their subsidiaries, and cached on the group so
 * lists can filter and sort on it. Portfolios and segments are never prospects nor clients.
 */
@Injectable()
export class LifecycleService {
    constructor(
        private connection: TransactionalConnection,
        private settings: CrmSettingsService,
        private journal: JournalService,
    ) {}

    /** Recomputes the group and every group above it. */
    async recomputeWithAncestors(ctx: RequestContext, groupId: ID): Promise<void> {
        const graph = await this.graph(ctx);
        for (const id of [String(groupId), ...ancestorsOf(graph, groupId)]) {
            await this.recompute(ctx, id);
        }
    }

    async recomputeForOrder(ctx: RequestContext, orderId: ID): Promise<void> {
        const order = await this.connection
            .getRepository(ctx, Order)
            .findOne({ where: { id: orderId }, relations: { customFields: { companyGroup: true } } as any });
        const company = (order?.customFields as { companyGroup?: CustomerGroup | null } | undefined)?.companyGroup;
        if (company) {
            await this.recomputeWithAncestors(ctx, company.id);
        }
    }

    /** T2 daily job: also the only way a client becomes dormant with time. */
    async recomputeAll(ctx: RequestContext): Promise<void> {
        const groups = await this.connection.getRepository(ctx, CustomerGroup).find();
        for (const group of groups.filter(isLifecycleGroup)) {
            await this.recompute(ctx, group.id);
        }
    }

    async recompute(ctx: RequestContext, groupId: ID): Promise<void> {
        const group = await this.connection.getRepository(ctx, CustomerGroup).findOne({ where: { id: groupId } });
        if (!group) {
            return;
        }
        const current = (group.customFields ?? {}) as GroupFields;
        const next = isLifecycleGroup(group) ? await this.compute(ctx, group) : { lifecycle: null, lifecycleVia: null, lastCountedOrderAt: null };
        const changed =
            (current.lifecycle ?? null) !== next.lifecycle ||
            (current.lifecycleVia ?? null) !== next.lifecycleVia ||
            (current.lastCountedOrderAt ? new Date(current.lastCountedOrderAt).getTime() : null) !==
                (next.lastCountedOrderAt?.getTime() ?? null);
        if (!changed) {
            return;
        }
        await this.connection
            .getRepository(ctx, CustomerGroup)
            .update({ id: group.id }, { customFields: { ...group.customFields, ...next } });
        if ((current.lifecycle ?? null) !== next.lifecycle) {
            await this.journal.record(ctx, group.id, 'lifecycle-changed', { from: current.lifecycle ?? null, to: next.lifecycle });
        }
    }

    private async compute(ctx: RequestContext, group: CustomerGroup): Promise<LifecycleFields> {
        const graph = await this.graph(ctx);
        const ids = [String(group.id), ...descendantsOf(graph, group.id)];
        const orders = await this.countedOrders(ctx, ids);
        if (orders.length === 0) {
            return { lifecycle: 'prospect', lifecycleVia: null, lastCountedOrderAt: null };
        }
        const last = new Date(Math.max(...orders.map(order => (order.orderPlacedAt ?? order.updatedAt).getTime())));
        const direct = orders.some(order => String(companyIdOf(order)) === String(group.id));
        const threshold = (await this.settings.get(ctx)).dormantThresholdDays;
        const dormant = threshold !== null && Date.now() - last.getTime() > threshold * DAY_MS;
        return { lifecycle: dormant ? 'dormant' : 'client', lifecycleVia: direct ? 'direct' : 'subsidiary', lastCountedOrderAt: last };
    }

    /** Counted orders frozen on any of the given companies. */
    async countedOrders(ctx: RequestContext, companyIds: string[]): Promise<Order[]> {
        if (companyIds.length === 0) {
            return [];
        }
        const orders = await this.connection.getRepository(ctx, Order).find({
            where: { state: In(COUNTED_ORDER_STATES), customFields: { companyGroup: { id: In(companyIds) } } } as any,
            relations: { payments: { refunds: true }, customFields: { companyGroup: true } } as any,
        });
        return orders.filter(isCountedOrder);
    }

    private async graph(ctx: RequestContext) {
        return buildGraph(await this.connection.getRepository(ctx, CustomerGroupEdge).find({ order: { id: 'ASC' } }));
    }
}

export function companyIdOf(order: Order): ID | undefined {
    return (order.customFields as { companyGroup?: CustomerGroup | null } | undefined)?.companyGroup?.id;
}

function isLifecycleGroup(group: CustomerGroup): boolean {
    return LIFECYCLE_TYPES.includes(((group.customFields ?? {}) as GroupFields).groupType ?? '');
}
