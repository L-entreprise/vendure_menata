import { Injectable, OnModuleInit } from '@nestjs/common';
import {
    Administrator,
    Customer,
    CustomerGroup,
    EventBus,
    ID,
    Logger,
    Order,
    OrderStateTransitionEvent,
    RefundStateTransitionEvent,
    RequestContext,
    TransactionalConnection,
} from '@vendure/core';

import { CrmRuleError } from '../common/crm-errors';
import { loggerCtx } from '../constants';

import { JournalService } from './journal.service';
import { companyIdOf, LifecycleService } from './lifecycle.service';
import { isCompany, MembershipRulesService } from './membership-rules.service';
import { NoteOwnershipService } from './note-ownership.service';

type OrderCrmFields = { companyGroup?: CustomerGroup | null; salesRep?: Administrator | null };
type AccountManagerFields = { accountManager?: Administrator | null };

const ORDER_RELATIONS = { customer: true, customFields: { companyGroup: true, salesRep: true } } as any;

/**
 * O1: the customer's single company is frozen on the order while it is being placed and
 * never follows later moves. O6: the sales rep is the admin who created the order, else the
 * account manager of the company, else of the customer. Every order event then refreshes
 * the prospect / client state (T1).
 */
@Injectable()
export class OrderCompanyService implements OnModuleInit {
    constructor(
        private connection: TransactionalConnection,
        private eventBus: EventBus,
        private membershipRules: MembershipRulesService,
        private noteOwnership: NoteOwnershipService,
        private lifecycle: LifecycleService,
        private journal: JournalService,
    ) {}

    onModuleInit() {
        this.eventBus.ofType(OrderStateTransitionEvent).subscribe(event => this.safely(event.ctx, event.order.id));
        this.eventBus.ofType(RefundStateTransitionEvent).subscribe(event => {
            if (event.toState === 'Settled') {
                this.safely(event.ctx, event.order.id);
            }
        });
    }

    /** Draft orders are created in the dashboard: the creator is the sales rep (O6). */
    async setCreatorAsSalesRep(ctx: RequestContext, orderId: ID): Promise<void> {
        const administratorId = await this.noteOwnership.currentAdministratorId(ctx);
        if (administratorId) {
            await this.writeFields(ctx, orderId, { salesRep: { id: administratorId } });
        }
    }

    async assignIfMissing(ctx: RequestContext, orderId: ID): Promise<void> {
        const order = await this.load(ctx, orderId);
        const fields = (order.customFields ?? {}) as OrderCrmFields;
        if (!order.customer) {
            return;
        }
        const company = fields.companyGroup ?? (await this.membershipRules.companyOf(ctx, order.customer.id));
        if (!fields.companyGroup && company) {
            await this.writeFields(ctx, order.id, { companyGroup: { id: company.id } });
            await this.journal.record(ctx, company.id, 'order-assigned', { orderCode: order.code });
        }
        if (!fields.salesRep && order.orderPlacedAt) {
            const manager = (company ? await this.groupManager(ctx, company.id) : null) ?? (await this.customerManager(ctx, order));
            if (manager) {
                await this.writeFields(ctx, order.id, { salesRep: { id: manager.id } });
            }
        }
    }

    /** O1: the super admin may fix the company of an order; both companies are refreshed. */
    async setOrderCompany(ctx: RequestContext, orderId: ID, companyId: ID | null): Promise<Order> {
        const order = await this.load(ctx, orderId);
        const previousId = companyIdOf(order);
        if (companyId) {
            const company = await this.connection.getEntityOrThrow(ctx, CustomerGroup, companyId);
            if (!isCompany(company)) {
                throw new CrmRuleError('crm-not-a-company', { groupName: company.name });
            }
        }
        await this.writeFields(ctx, order.id, { companyGroup: companyId ? { id: companyId } : null });
        if (companyId) {
            await this.journal.record(ctx, companyId, 'order-assigned', { orderCode: order.code });
            await this.lifecycle.recomputeWithAncestors(ctx, companyId);
        }
        if (previousId) {
            await this.lifecycle.recomputeWithAncestors(ctx, previousId);
        }
        return this.load(ctx, order.id);
    }

    private async groupManager(ctx: RequestContext, groupId: ID): Promise<Administrator | null> {
        const group = await this.connection
            .getRepository(ctx, CustomerGroup)
            .findOne({ where: { id: groupId }, relations: { customFields: { accountManager: true } } as any });
        return (group?.customFields as AccountManagerFields | undefined)?.accountManager ?? null;
    }

    private async customerManager(ctx: RequestContext, order: Order): Promise<Administrator | null> {
        const customer = await this.connection
            .getRepository(ctx, Customer)
            .findOne({ where: { id: order.customer!.id }, relations: { customFields: { accountManager: true } } as any });
        return (customer?.customFields as AccountManagerFields | undefined)?.accountManager ?? null;
    }

    private async writeFields(ctx: RequestContext, orderId: ID, fields: Record<string, unknown>) {
        await this.connection.getRepository(ctx, Order).update({ id: orderId }, { customFields: fields } as any);
    }

    private load(ctx: RequestContext, orderId: ID): Promise<Order> {
        return this.connection.getEntityOrThrow(ctx, Order, orderId, { relations: ORDER_RELATIONS });
    }

    private safely(ctx: RequestContext, orderId: ID) {
        this.assignIfMissing(ctx, orderId)
            .then(() => this.lifecycle.recomputeForOrder(ctx, orderId))
            .catch(error => Logger.error(`Could not update the CRM data of order ${String(orderId)}: ${String(error?.message ?? error)}`, loggerCtx));
    }
}
