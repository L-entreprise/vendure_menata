import { TransactionalConnection } from '@vendure/core';
import type { CustomerHistoryEntry } from '@vendure/core/dist/entity/history-entry/customer-history-entry.entity';
import type { OrderHistoryEntry } from '@vendure/core/dist/entity/history-entry/order-history-entry.entity';

export type { CustomerHistoryEntry, OrderHistoryEntry };

type EntityClass<T> = new (...args: any[]) => T;

/**
 * Vendure exports CustomerHistoryEntry / OrderHistoryEntry from its package index only since
 * 3.7.4. The classes are resolved from the TypeORM metadata (registered by every 3.x) and the
 * types come from their own files, so the plugin also runs on older 3.x releases.
 */
function historyEntity<T>(connection: TransactionalConnection, name: string): EntityClass<T> {
    return connection.rawConnection.getMetadata(name).target as EntityClass<T>;
}

export function customerHistoryEntity(connection: TransactionalConnection): EntityClass<CustomerHistoryEntry> {
    return historyEntity<CustomerHistoryEntry>(connection, 'CustomerHistoryEntry');
}

export function orderHistoryEntity(connection: TransactionalConnection): EntityClass<OrderHistoryEntry> {
    return historyEntity<OrderHistoryEntry>(connection, 'OrderHistoryEntry');
}
