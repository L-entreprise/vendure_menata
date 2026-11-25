import { Injectable, OnModuleInit } from '@nestjs/common';
import {
    Administrator,
    Customer,
    CustomerGroup,
    EventBus,
    ID,
    idsAreEqual,
    Logger,
    Order,
    OrderPlacedEvent,
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
        // The company is frozen once, inside the transaction that places the order: a move or a
        // super admin edit right after placement can never race the stamp. Later transitions and
        // refunds only refresh the lifecycle (after commit): they never fill an empty company
        // again, so a company cleared by the super admin stays cleared.
        this.eventBus.registerBlockingEventHandler({
            event: OrderPlacedEvent,
            id: 'crm-freeze-order-company',
            handler: event => this.freezeSafely(event.ctx, event.order),
        });
        this.eventBus.ofType(OrderPlacedEvent).subscribe(event => this.refreshLifecycle(event.ctx, event.order.id));
        this.eventBus.ofType(OrderStateTransitionEvent).subscribe(event => this.refreshLifecycle(event.ctx, event.order.id));
        this.eventBus.ofType(RefundStateTransitionEvent).subscribe(event => {
            if (event.toState === 'Settled') {
                this.refreshLifecycle(event.ctx, event.order.id);
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

    /**
     * Runs inside the placing transaction (OrderPlacedEvent blocking handler): freezes the
     * company and the sales rep. `placing` is the order Vendure saves after the handlers, so
     * the fields are set on it too, otherwise that save could write the stale values back.
     */
    async assignIfMissing(ctx: RequestContext, placing: Order): Promise<void> {
        const order = await this.load(ctx, placing.id);
        const fields = (order.customFields ?? {}) as OrderCrmFields;
        if (!order.customer) {
            return;
        }
        // The customer's own company wins over a company picked for the draft (the customer may
        // have been changed afterwards); a draft company is kept only for a customer without one.
        const company = (await this.membershipRules.companyOf(ctx, order.customer.id)) ?? fields.companyGroup ?? null;
        if (company && !idsAreEqual(fields.companyGroup?.id, company.id)) {
            await this.writeFields(ctx, order.id, { companyGroup: { id: company.id } });
            this.setOnPlacingOrder(placing, { companyGroup: company });
            await this.journal.record(ctx, company.id, 'order-assigned', { orderCode: order.code });
        }
        if (!fields.salesRep) {
            const manager = (company ? await this.groupManager(ctx, company.id) : null) ?? (await this.customerManager(ctx, order));
            if (manager) {
                await this.writeFields(ctx, order.id, { salesRep: { id: manager.id } });
                this.setOnPlacingOrder(placing, { salesRep: manager });
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

    /** Vendure saves this entity after the blocking handlers: keep it in step with the DB write. */
    private setOnPlacingOrder(placing: Order, fields: OrderCrmFields) {
        placing.customFields = { ...(placing.customFields ?? {}), ...fields } as Order['customFields'];
    }

    /**
     * A CRM rule error must not block a sale: log it and let the order be placed. (A failed SQL
     * statement still aborts the whole transaction on Postgres; the queries here are plain reads
     * and updates by primary key.)
     */
    private async freezeSafely(ctx: RequestContext, order: Order): Promise<void> {
        try {
            await this.assignIfMissing(ctx, order);
        } catch (error: any) {
            Logger.error(`Could not freeze the company of order ${String(order.id)}: ${String(error?.message ?? error)}`, loggerCtx);
        }
    }

    private refreshLifecycle(ctx: RequestContext, orderId: ID) {
        this.lifecycle
            .recomputeForOrder(ctx, orderId)
            .catch(error => Logger.error(`Could not update the CRM data of order ${String(orderId)}: ${String(error?.message ?? error)}`, loggerCtx));
    }
}
