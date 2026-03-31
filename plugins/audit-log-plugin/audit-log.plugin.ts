import { OnApplicationBootstrap } from '@nestjs/common';
import {
    ChannelEvent,
    CollectionEvent,
    CustomerEvent,
    EventBus,
    LoginEvent,
    LogoutEvent,
    OrderPlacedEvent,
    OrderStateTransitionEvent,
    PluginCommonModule,
    ProductEvent,
    ProductVariantEvent,
    RoleChangeEvent,
    Type,
    VendureEvent,
    VendurePlugin,
} from '@vendure/core';
import { Subscription } from 'rxjs';

import { adminApiExtensions } from './api/api-extensions';
import { AuditLogAdminResolver } from './api/audit-log-admin.resolver';
import { AuditLogEntry } from './entities/audit-log-entry.entity';
import { AuditLogService } from './services/audit-log.service';

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
    compatibility: '^3.0.0',
    dashboard: './dashboard/index.tsx',
})
export class AuditLogPlugin implements OnApplicationBootstrap {
    private static options: AuditLogPluginOptions = {};
    private subscriptions: Subscription[] = [];

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

    private subscribeToEvents() {
        const subscribe = <T extends VendureEvent>(
            eventType: Type<T>,
            action: string,
            extractor: (event: T) => { entityType?: string; entityId?: string; detail?: Record<string, unknown> },
        ) => {
            const sub = this.eventBus.ofType(eventType).subscribe(event => {
                const { entityType, entityId, detail } = extractor(event);
                this.auditLogService.log((event as any).ctx, {
                    action,
                    entityType,
                    entityId,
                    detail,
                }).catch(() => { /* non-blocking */ });
            });
            this.subscriptions.push(sub);
        };

        // Authentication
        subscribe(LoginEvent, 'Login', e => ({
            entityType: 'User',
            entityId: (e as any).user?.id?.toString(),
        }));
        subscribe(LogoutEvent, 'Logout', () => ({ entityType: 'User' }));

        // Products
        subscribe(ProductEvent, 'ProductChange', e => ({
            entityType: 'Product',
            entityId: (e as any).entity?.id?.toString(),
            detail: { type: (e as any).type },
        }));
        subscribe(ProductVariantEvent, 'ProductVariantChange', e => ({
            entityType: 'ProductVariant',
            entityId: (e as any).entity?.[0]?.id?.toString(),
            detail: { type: (e as any).type },
        }));

        // Orders
        subscribe(OrderStateTransitionEvent, 'OrderStateTransition', e => ({
            entityType: 'Order',
            entityId: (e as any).order?.id?.toString(),
            detail: { from: (e as any).fromState, to: (e as any).toState },
        }));
        subscribe(OrderPlacedEvent, 'OrderPlaced', e => ({
            entityType: 'Order',
            entityId: (e as any).order?.id?.toString(),
        }));

        // Customers
        subscribe(CustomerEvent, 'CustomerChange', e => ({
            entityType: 'Customer',
            entityId: (e as any).entity?.id?.toString(),
            detail: { type: (e as any).type },
        }));

        // Collections
        subscribe(CollectionEvent, 'CollectionChange', e => ({
            entityType: 'Collection',
            entityId: (e as any).entity?.id?.toString(),
            detail: { type: (e as any).type },
        }));

        // System
        subscribe(ChannelEvent, 'ChannelChange', e => ({
            entityType: 'Channel',
            entityId: (e as any).entity?.id?.toString(),
            detail: { type: (e as any).type },
        }));
        subscribe(RoleChangeEvent, 'RoleChange', e => ({
            entityType: 'Role',
            entityId: (e as any).entity?.id?.toString(),
            detail: { type: (e as any).type },
        }));
    }
}
