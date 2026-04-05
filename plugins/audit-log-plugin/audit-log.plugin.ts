import { OnApplicationBootstrap } from '@nestjs/common';
import {
    AccountRegistrationEvent,
    AccountVerifiedEvent,
    AdministratorEvent,
    AssetChannelEvent,
    AssetEvent,
    AttemptedLoginEvent,
    ChannelEvent,
    CollectionEvent,
    CollectionModificationEvent,
    CountryEvent,
    CouponCodeEvent,
    CustomerAddressEvent,
    CustomerEvent,
    CustomerGroupChangeEvent,
    CustomerGroupEvent,
    EventBus,
    FacetEvent,
    FacetValueEvent,
    FulfillmentEvent,
    FulfillmentStateTransitionEvent,
    GlobalSettingsEvent,
    IdentifierChangeEvent,
    IdentifierChangeRequestEvent,
    LoginEvent,
    LogoutEvent,
    OrderEvent,
    OrderLineEvent,
    OrderPlacedEvent,
    OrderStateTransitionEvent,
    PasswordResetEvent,
    PasswordResetVerifiedEvent,
    PaymentMethodEvent,
    PaymentStateTransitionEvent,
    PluginCommonModule,
    ProductChannelEvent,
    ProductEvent,
    ProductOptionEvent,
    ProductOptionGroupChangeEvent,
    ProductOptionGroupEvent,
    ProductVariantChannelEvent,
    ProductVariantEvent,
    ProductVariantPriceEvent,
    PromotionEvent,
    RefundEvent,
    RefundStateTransitionEvent,
    RoleChangeEvent,
    RoleEvent,
    SellerEvent,
    ShippingMethodEvent,
    StockLocationEvent,
    StockMovementEvent,
    TaxCategoryEvent,
    TaxRateEvent,
    TaxRateModificationEvent,
    Type,
    VendureEvent,
    VendurePlugin,
    ZoneEvent,
    ZoneMembersEvent,
} from '@vendure/core';
import { Subscription } from 'rxjs';

import { adminApiExtensions } from './api/api-extensions';
import { AuditLogAdminResolver } from './api/audit-log-admin.resolver';
import { AuditLogEntry } from './entities/audit-log-entry.entity';
import { AuditLogInput, AuditLogService } from './services/audit-log.service';

interface AuditLogPluginOptions {
    retentionDays?: number;
}

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [AuditLogEntry],
    adminApiExtensions: {
        schema: adminApiExtensions,
        resolvers: [AuditLogAdminResolver],
    },
    providers: [AuditLogService],
    exports: [AuditLogService],
    compatibility: '^3.0.0',
    dashboard: './dashboard/index.tsx',
})
export class AuditLogPlugin implements OnApplicationBootstrap {
    private static options: AuditLogPluginOptions = {};
    private subscriptions: Subscription[] = [];
    private logging = false;

    constructor(
        private eventBus: EventBus,
        private auditLogService: AuditLogService,
    ) {}

    static init(options: AuditLogPluginOptions): Type<AuditLogPlugin> {
        AuditLogPlugin.options = options;
        return AuditLogPlugin;
    }

    onApplicationBootstrap() {
        this.subscribeToEvents();
    }

    private sub<T extends VendureEvent>(
        eventType: Type<T>,
        extractor: (event: T) => { ctx?: any } & AuditLogInput,
    ) {
        const subscription = this.eventBus.ofType(eventType).subscribe(event => {
            if (this.logging) return;
            try {
                const { ctx, ...input } = extractor(event);
                const reqCtx = ctx ?? (event as any).ctx;
                this.logging = true;
                this.auditLogService.log(reqCtx, input)
                    .catch(() => {})
                    .finally(() => { this.logging = false; });
            } catch {
                this.logging = false;
            }
        });
        this.subscriptions.push(subscription);
    }

    private entityId(entity: any): string | undefined {
        return entity?.id?.toString();
    }

    private entityName(entity: any): string | undefined {
        return entity?.name ?? entity?.code ?? entity?.title ?? undefined;
    }

    /**
     * Extract changes from mutation input for 'updated' entity events.
     * Returns { field: newValue } for each field in the input (excluding 'id').
     * Since Vendure events fire after save, we can't get old values from core events.
     */
    private extractChanges(input: any): Record<string, unknown> | undefined {
        if (!input) return undefined;
        const changes: Record<string, unknown> = {};
        const sanitized = this.sanitizeInput(input);
        if (!sanitized) return undefined;
        for (const [key, value] of Object.entries(sanitized)) {
            if (key === 'id') continue;
            changes[key] = value;
        }
        return Object.keys(changes).length > 0 ? changes : undefined;
    }

    /**
     * Build detail for a VendureEntityEvent.
     * - 'created': shows the new entity state
     * - 'updated': shows the changes (from input) clearly separated
     * - 'deleted': shows what was deleted
     */
    private entityDetail(
        type: 'created' | 'updated' | 'deleted',
        entity: any,
        input: any,
        extraFields?: Record<string, unknown>,
    ): Record<string, unknown> {
        const base: Record<string, unknown> = { ...extraFields };

        if (type === 'updated') {
            const changes = this.extractChanges(input);
            if (changes) {
                base.changes = changes;
            }
        } else if (type === 'created') {
            base.changes = this.extractChanges(input);
        }

        return base;
    }

    private subscribeToEvents() {
        // ─── AUTHENTICATION ──────────────────────────────────────────
        this.sub(LoginEvent, e => ({
            action: 'Login',
            category: 'auth',
            entityType: 'User',
            entityId: this.entityId(e.user),
            detail: { identifier: e.user?.identifier },
        }));

        this.sub(LogoutEvent, e => ({
            action: 'Logout',
            category: 'auth',
            entityType: 'User',
            ctx: e.ctx,
        }));

        this.sub(AttemptedLoginEvent, e => ({
            action: 'AttemptedLogin',
            category: 'auth',
            entityType: 'User',
            severity: 'warning' as const,
            detail: { strategy: e.strategy, identifier: e.identifier },
        }));

        this.sub(AccountRegistrationEvent, e => ({
            action: 'AccountRegistration',
            category: 'auth',
            entityType: 'Customer',
            ctx: e.ctx,
            detail: { strategy: (e as any).strategy },
        }));

        this.sub(AccountVerifiedEvent, e => ({
            action: 'AccountVerified',
            category: 'auth',
            entityType: 'Customer',
            ctx: e.ctx,
            detail: { strategy: (e as any).strategy },
        }));

        this.sub(PasswordResetEvent, e => ({
            action: 'PasswordResetRequested',
            category: 'auth',
            entityType: 'User',
            severity: 'warning' as const,
            ctx: e.ctx,
        }));

        this.sub(PasswordResetVerifiedEvent, e => ({
            action: 'PasswordResetVerified',
            category: 'auth',
            entityType: 'User',
            ctx: e.ctx,
        }));

        this.sub(IdentifierChangeRequestEvent, e => ({
            action: 'IdentifierChangeRequested',
            category: 'auth',
            entityType: 'User',
            severity: 'warning' as const,
            ctx: e.ctx,
        }));

        this.sub(IdentifierChangeEvent, e => ({
            action: 'IdentifierChanged',
            category: 'auth',
            entityType: 'User',
            ctx: e.ctx,
        }));

        // ─── CATALOG ─────────────────────────────────────────────────
        this.sub(ProductEvent, e => ({
            action: `Product${this.capitalize(e.type)}`,
            category: 'catalog',
            entityType: 'Product',
            entityId: this.entityId(e.entity),
            detail: this.entityDetail(e.type, e.entity, e.input, {
                name: this.entityName(e.entity),
            }),
        }));

        this.sub(ProductVariantEvent, e => {
            const variants = Array.isArray(e.entity) ? e.entity : [e.entity];
            return {
                action: `ProductVariant${this.capitalize(e.type)}`,
                category: 'catalog',
                entityType: 'ProductVariant',
                entityId: this.entityId(variants[0]),
                detail: {
                    ...this.entityDetail(e.type, variants[0], e.input),
                    variantCount: variants.length,
                    skus: variants.map((v: any) => v?.sku).filter(Boolean),
                },
            };
        });

        this.sub(ProductVariantPriceEvent, e => ({
            action: `ProductVariantPrice${this.capitalize(e.type)}`,
            category: 'catalog',
            entityType: 'ProductVariantPrice',
            entityId: this.entityId(Array.isArray(e.entity) ? e.entity[0] : e.entity),
            detail: this.entityDetail(e.type, e.entity, e.input),
        }));

        this.sub(ProductChannelEvent, e => ({
            action: `ProductChannel${this.capitalize((e as any).type)}`,
            category: 'catalog',
            entityType: 'Product',
            entityId: this.entityId((e as any).product),
            detail: { channelId: (e as any).channelId?.toString() },
        }));

        this.sub(ProductVariantChannelEvent, e => ({
            action: `ProductVariantChannel${this.capitalize((e as any).type)}`,
            category: 'catalog',
            entityType: 'ProductVariant',
            entityId: this.entityId((e as any).productVariant),
            detail: { channelId: (e as any).channelId?.toString() },
        }));

        this.sub(ProductOptionEvent, e => ({
            action: `ProductOption${this.capitalize(e.type)}`,
            category: 'catalog',
            entityType: 'ProductOption',
            entityId: this.entityId(e.entity),
            detail: this.entityDetail(e.type, e.entity, e.input, {
                name: this.entityName(e.entity),
            }),
        }));

        this.sub(ProductOptionGroupEvent, e => ({
            action: `ProductOptionGroup${this.capitalize(e.type)}`,
            category: 'catalog',
            entityType: 'ProductOptionGroup',
            entityId: this.entityId(e.entity),
            detail: this.entityDetail(e.type, e.entity, e.input, {
                name: this.entityName(e.entity),
            }),
        }));

        this.sub(ProductOptionGroupChangeEvent, e => ({
            action: 'ProductOptionGroupChange',
            category: 'catalog',
            entityType: 'Product',
            entityId: (e as any).productId?.toString(),
            detail: {
                type: (e as any).type,
                optionGroupId: (e as any).optionGroupId?.toString(),
            },
        }));

        this.sub(CollectionEvent, e => ({
            action: `Collection${this.capitalize(e.type)}`,
            category: 'catalog',
            entityType: 'Collection',
            entityId: this.entityId(e.entity),
            detail: this.entityDetail(e.type, e.entity, e.input, {
                name: this.entityName(e.entity),
            }),
        }));

        this.sub(CollectionModificationEvent, e => ({
            action: 'CollectionModified',
            category: 'catalog',
            entityType: 'Collection',
            entityId: this.entityId(e.collection),
            detail: {
                name: this.entityName(e.collection),
                affectedVariantIds: e.productVariantIds.slice(0, 20).map(id => id.toString()),
                affectedVariantCount: e.productVariantIds.length,
            },
        }));

        this.sub(FacetEvent, e => ({
            action: `Facet${this.capitalize(e.type)}`,
            category: 'catalog',
            entityType: 'Facet',
            entityId: this.entityId(e.entity),
            detail: this.entityDetail(e.type, e.entity, e.input, {
                name: this.entityName(e.entity),
            }),
        }));

        this.sub(FacetValueEvent, e => ({
            action: `FacetValue${this.capitalize(e.type)}`,
            category: 'catalog',
            entityType: 'FacetValue',
            entityId: this.entityId(e.entity),
            detail: this.entityDetail(e.type, e.entity, e.input, {
                name: this.entityName(e.entity),
            }),
        }));

        this.sub(AssetEvent, e => ({
            action: `Asset${this.capitalize(e.type)}`,
            category: 'catalog',
            entityType: 'Asset',
            entityId: this.entityId(e.entity),
            detail: this.entityDetail(e.type, e.entity, e.input, {
                name: (e.entity as any)?.name,
                source: (e.entity as any)?.source,
            }),
        }));

        this.sub(AssetChannelEvent, e => ({
            action: `AssetChannel${this.capitalize((e as any).type)}`,
            category: 'catalog',
            entityType: 'Asset',
            entityId: this.entityId((e as any).asset),
            detail: { channelId: (e as any).channelId?.toString() },
        }));

        // ─── ORDERS ──────────────────────────────────────────────────
        this.sub(OrderEvent, e => ({
            action: `Order${this.capitalize(e.type)}`,
            category: 'order',
            entityType: 'Order',
            entityId: this.entityId(e.entity),
            detail: this.entityDetail(e.type, e.entity, e.input, {
                code: (e.entity as any)?.code,
                total: (e.entity as any)?.totalWithTax,
                state: (e.entity as any)?.state,
            }),
        }));

        this.sub(OrderStateTransitionEvent, e => ({
            action: 'OrderStateTransition',
            category: 'order',
            entityType: 'Order',
            entityId: this.entityId(e.order),
            severity: e.toState === 'Cancelled' ? 'warning' as const : 'info' as const,
            detail: {
                changes: { state: { from: e.fromState, to: e.toState } },
                code: e.order?.code,
                total: (e.order as any)?.totalWithTax,
            },
        }));

        this.sub(OrderPlacedEvent, e => ({
            action: 'OrderPlaced',
            category: 'order',
            entityType: 'Order',
            entityId: this.entityId(e.order),
            detail: {
                code: e.order?.code,
                total: (e.order as any)?.totalWithTax,
                currencyCode: (e.order as any)?.currencyCode,
                customerEmail: (e.order as any)?.customer?.emailAddress,
                itemCount: (e.order as any)?.lines?.length,
            },
        }));

        this.sub(OrderLineEvent, e => ({
            action: `OrderLine${this.capitalize(e.type)}`,
            category: 'order',
            entityType: 'OrderLine',
            entityId: this.entityId(e.orderLine),
            detail: {
                orderId: this.entityId(e.order),
                orderCode: (e.order as any)?.code,
                sku: (e.orderLine as any)?.productVariant?.sku,
                quantity: (e.orderLine as any)?.quantity,
                linePrice: (e.orderLine as any)?.linePriceWithTax,
            },
        }));

        this.sub(CouponCodeEvent, e => ({
            action: `CouponCode${this.capitalize(e.type)}`,
            category: 'order',
            entityType: 'Order',
            entityId: e.orderId.toString(),
            detail: { couponCode: e.couponCode, type: e.type },
        }));

        // ─── PAYMENTS & REFUNDS ──────────────────────────────────────
        this.sub(PaymentStateTransitionEvent, e => ({
            action: 'PaymentStateTransition',
            category: 'payment',
            entityType: 'Payment',
            entityId: this.entityId(e.payment),
            severity: e.toState === 'Error' || e.toState === 'Declined'
                ? 'warning' as const : 'info' as const,
            detail: {
                changes: { state: { from: e.fromState, to: e.toState } },
                method: (e.payment as any)?.method,
                amount: (e.payment as any)?.amount,
                orderId: this.entityId(e.order),
                orderCode: (e.order as any)?.code,
            },
        }));

        this.sub(PaymentMethodEvent, e => ({
            action: `PaymentMethod${this.capitalize(e.type)}`,
            category: 'payment',
            entityType: 'PaymentMethod',
            entityId: this.entityId(e.entity),
            detail: this.entityDetail(e.type, e.entity, e.input, {
                name: this.entityName(e.entity),
            }),
        }));

        this.sub(RefundEvent, e => ({
            action: 'RefundCreated',
            category: 'payment',
            entityType: 'Refund',
            entityId: this.entityId((e as any).refund),
            severity: 'warning' as const,
            detail: {
                reason: (e as any).refund?.reason,
                total: (e as any).refund?.total,
            },
        }));

        this.sub(RefundStateTransitionEvent, e => ({
            action: 'RefundStateTransition',
            category: 'payment',
            entityType: 'Refund',
            entityId: this.entityId(e.refund),
            severity: 'warning' as const,
            detail: {
                changes: { state: { from: e.fromState, to: e.toState } },
                total: (e.refund as any)?.total,
                orderId: this.entityId(e.order),
                orderCode: (e.order as any)?.code,
            },
        }));

        // ─── FULFILLMENT ─────────────────────────────────────────────
        this.sub(FulfillmentEvent, e => ({
            action: `Fulfillment${this.capitalize(e.type)}`,
            category: 'fulfillment',
            entityType: 'Fulfillment',
            entityId: this.entityId(e.entity),
            detail: this.entityDetail(e.type, e.entity, e.input, {
                method: (e.entity as any)?.method,
                trackingCode: (e.entity as any)?.trackingCode,
                state: (e.entity as any)?.state,
            }),
        }));

        this.sub(FulfillmentStateTransitionEvent, e => ({
            action: 'FulfillmentStateTransition',
            category: 'fulfillment',
            entityType: 'Fulfillment',
            entityId: this.entityId(e.fulfillment),
            detail: {
                changes: { state: { from: e.fromState, to: e.toState } },
                method: (e.fulfillment as any)?.method,
                trackingCode: (e.fulfillment as any)?.trackingCode,
            },
        }));

        // ─── CUSTOMERS ───────────────────────────────────────────────
        this.sub(CustomerEvent, e => ({
            action: `Customer${this.capitalize(e.type)}`,
            category: 'customer',
            entityType: 'Customer',
            entityId: this.entityId(e.entity),
            detail: this.entityDetail(e.type, e.entity, e.input, {
                email: (e.entity as any)?.emailAddress,
                firstName: (e.entity as any)?.firstName,
                lastName: (e.entity as any)?.lastName,
            }),
        }));

        this.sub(CustomerAddressEvent, e => ({
            action: `CustomerAddress${this.capitalize(e.type)}`,
            category: 'customer',
            entityType: 'Address',
            entityId: this.entityId(e.entity),
            detail: this.entityDetail(e.type, e.entity, e.input, {
                city: (e.entity as any)?.city,
                country: (e.entity as any)?.country?.name,
            }),
        }));

        this.sub(CustomerGroupEvent, e => ({
            action: `CustomerGroup${this.capitalize(e.type)}`,
            category: 'customer',
            entityType: 'CustomerGroup',
            entityId: this.entityId(e.entity),
            detail: this.entityDetail(e.type, e.entity, e.input, {
                name: this.entityName(e.entity),
            }),
        }));

        this.sub(CustomerGroupChangeEvent, e => ({
            action: `CustomerGroupMembership${this.capitalize(e.type)}`,
            category: 'customer',
            entityType: 'CustomerGroup',
            entityId: this.entityId(e.customGroup),
            detail: {
                groupName: this.entityName(e.customGroup),
                customerCount: e.customers.length,
                customerIds: e.customers.slice(0, 20).map(c => c.id.toString()),
            },
        }));

        // ─── PROMOTIONS ──────────────────────────────────────────────
        this.sub(PromotionEvent, e => ({
            action: `Promotion${this.capitalize(e.type)}`,
            category: 'promotion',
            entityType: 'Promotion',
            entityId: this.entityId(e.entity),
            detail: this.entityDetail(e.type, e.entity, e.input, {
                name: this.entityName(e.entity),
                couponCode: (e.entity as any)?.couponCode,
                enabled: (e.entity as any)?.enabled,
            }),
        }));

        // ─── STOCK ───────────────────────────────────────────────────
        this.sub(StockMovementEvent, e => ({
            action: 'StockMovement',
            category: 'stock',
            entityType: 'StockMovement',
            detail: {
                movementType: e.type,
                movementCount: e.stockMovements.length,
                movements: e.stockMovements.slice(0, 10).map((m: any) => ({
                    id: m.id?.toString(),
                    quantity: m.quantity,
                    type: m.type,
                    productVariantId: m.productVariant?.id?.toString(),
                })),
            },
        }));

        this.sub(StockLocationEvent, e => ({
            action: `StockLocation${this.capitalize(e.type)}`,
            category: 'stock',
            entityType: 'StockLocation',
            entityId: this.entityId(e.entity),
            detail: this.entityDetail(e.type, e.entity, e.input, {
                name: this.entityName(e.entity),
            }),
        }));

        // ─── SYSTEM & SETTINGS ───────────────────────────────────────
        this.sub(ChannelEvent, e => ({
            action: `Channel${this.capitalize(e.type)}`,
            category: 'system',
            entityType: 'Channel',
            entityId: this.entityId(e.entity),
            severity: 'warning' as const,
            detail: this.entityDetail(e.type, e.entity, e.input, {
                code: (e.entity as any)?.code,
                token: (e.entity as any)?.token,
            }),
        }));

        this.sub(RoleEvent, e => ({
            action: `Role${this.capitalize(e.type)}`,
            category: 'system',
            entityType: 'Role',
            entityId: this.entityId(e.entity),
            severity: 'critical' as const,
            detail: this.entityDetail(e.type, e.entity, e.input, {
                code: (e.entity as any)?.code,
                description: (e.entity as any)?.description,
                permissionCount: (e.entity as any)?.permissions?.length,
            }),
        }));

        this.sub(RoleChangeEvent, e => ({
            action: 'RoleChange',
            category: 'system',
            entityType: 'Role',
            entityId: this.entityId((e as any).entity),
            severity: 'critical' as const,
            detail: { type: (e as any).type },
        }));

        this.sub(AdministratorEvent, e => ({
            action: `Administrator${this.capitalize(e.type)}`,
            category: 'system',
            entityType: 'Administrator',
            entityId: this.entityId(e.entity),
            severity: 'critical' as const,
            detail: this.entityDetail(e.type, e.entity, e.input, {
                firstName: (e.entity as any)?.firstName,
                lastName: (e.entity as any)?.lastName,
                email: (e.entity as any)?.emailAddress,
            }),
        }));

        this.sub(GlobalSettingsEvent, e => ({
            action: `GlobalSettings${this.capitalize(e.type)}`,
            category: 'settings',
            entityType: 'GlobalSettings',
            entityId: this.entityId(e.entity),
            severity: 'warning' as const,
            detail: this.entityDetail(e.type, e.entity, e.input),
        }));

        this.sub(ZoneEvent, e => ({
            action: `Zone${this.capitalize(e.type)}`,
            category: 'settings',
            entityType: 'Zone',
            entityId: this.entityId(e.entity),
            detail: this.entityDetail(e.type, e.entity, e.input, {
                name: this.entityName(e.entity),
            }),
        }));

        this.sub(ZoneMembersEvent, e => ({
            action: `ZoneMembers${this.capitalize((e as any).type)}`,
            category: 'settings',
            entityType: 'Zone',
            entityId: this.entityId((e as any).zone),
            detail: {
                type: (e as any).type,
                memberIds: (e as any).memberIds?.map((id: any) => id.toString()),
            },
        }));

        this.sub(CountryEvent, e => ({
            action: `Country${this.capitalize(e.type)}`,
            category: 'settings',
            entityType: 'Country',
            entityId: this.entityId(e.entity),
            detail: this.entityDetail(e.type, e.entity, e.input, {
                name: this.entityName(e.entity),
                code: (e.entity as any)?.code,
            }),
        }));

        this.sub(TaxCategoryEvent, e => ({
            action: `TaxCategory${this.capitalize(e.type)}`,
            category: 'settings',
            entityType: 'TaxCategory',
            entityId: this.entityId(e.entity),
            detail: this.entityDetail(e.type, e.entity, e.input, {
                name: this.entityName(e.entity),
            }),
        }));

        this.sub(TaxRateEvent, e => ({
            action: `TaxRate${this.capitalize(e.type)}`,
            category: 'settings',
            entityType: 'TaxRate',
            entityId: this.entityId(e.entity),
            detail: this.entityDetail(e.type, e.entity, e.input, {
                name: this.entityName(e.entity),
                value: (e.entity as any)?.value,
            }),
        }));

        this.sub(TaxRateModificationEvent, e => ({
            action: 'TaxRateModified',
            category: 'settings',
            entityType: 'TaxRate',
            entityId: this.entityId((e as any).taxRate),
            detail: {},
        }));

        this.sub(ShippingMethodEvent, e => ({
            action: `ShippingMethod${this.capitalize(e.type)}`,
            category: 'settings',
            entityType: 'ShippingMethod',
            entityId: this.entityId(e.entity),
            detail: this.entityDetail(e.type, e.entity, e.input, {
                name: this.entityName(e.entity),
            }),
        }));

        this.sub(SellerEvent, e => ({
            action: `Seller${this.capitalize(e.type)}`,
            category: 'settings',
            entityType: 'Seller',
            entityId: this.entityId(e.entity),
            detail: this.entityDetail(e.type, e.entity, e.input, {
                name: this.entityName(e.entity),
            }),
        }));

        // NOTE: HistoryEntryEvent excluded — infinite loop (logging triggers history).
        // NOTE: ChangeChannelEvent excluded — infinite loop (assignToCurrentChannel on AuditLogEntry).
        // NOTE: SearchEvent excluded — fires hundreds of times during reindexing.
    }

    private capitalize(str: string): string {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    private sanitizeInput(input: any): Record<string, unknown> | undefined {
        if (!input) return undefined;
        try {
            const seen = new WeakSet();
            const safeStringify = (obj: any, depth = 0): any => {
                if (depth > 3) return '[nested]';
                if (obj === null || obj === undefined) return obj;
                if (typeof obj === 'string') {
                    return obj.length > 200 ? obj.substring(0, 200) + '...' : obj;
                }
                if (typeof obj !== 'object') return obj;
                if (seen.has(obj)) return '[circular]';
                seen.add(obj);
                if (Array.isArray(obj)) {
                    const sliced = obj.slice(0, 20);
                    const result = sliced.map(item => safeStringify(item, depth + 1));
                    if (obj.length > 20) result.push(`...(${obj.length - 20} more)`);
                    return result;
                }
                const result: Record<string, any> = {};
                const keys = Object.keys(obj);
                for (const key of keys.slice(0, 30)) {
                    if (['password', 'currentPassword', 'newPassword', 'token'].includes(key)) continue;
                    result[key] = safeStringify(obj[key], depth + 1);
                }
                return result;
            };
            return safeStringify(input) as Record<string, unknown>;
        } catch {
            return undefined;
        }
    }
}
