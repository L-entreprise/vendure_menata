import { ColumnType, DataSourceOptions, getMetadataArgsStorage } from 'typeorm';

const TIMESTAMP_DIALECTS: ReadonlyArray<DataSourceOptions['type']> = ['postgres', 'cockroachdb', 'aurora-postgres'];

/**
 * Postgres has no `datetime` type; MySQL/MariaDB `timestamp` caps at 2038 (Y2038)
 * and converts timezones. `datetime` is also what SQLite has always used here, so
 * every non-Postgres dialect keeps it and existing schemas produce no migration diff.
 */
export function dateColumnTypeFor(dbType: DataSourceOptions['type'] | undefined): ColumnType {
    return dbType && TIMESTAMP_DIALECTS.includes(dbType) ? 'timestamp' : 'datetime';
}

/**
 * Rewrites the column type of a date column registered by a `@Column` decorator so it
 * matches the dialect actually configured in `VendureConfig.dbConnectionOptions`.
 *
 * Decorators run at import time, before the config is known, so the entity cannot pick
 * the type itself without reading an env var the host app may not set. This runs from
 * the plugin `configuration` hook, which Vendure executes before TypeORM builds entity
 * metadata (for both server bootstrap and migration generation).
 */
export function applyDateColumnType(
    target: Function,
    propertyName: string,
    dbType: DataSourceOptions['type'] | undefined,
): void {
    const column = getMetadataArgsStorage().columns.find(
        c => c.target === target && c.propertyName === propertyName,
    );
    if (!column) {
        throw new Error(`No @Column metadata found for ${target.name}.${propertyName}`);
    }
    column.options.type = dateColumnTypeFor(dbType);
}
