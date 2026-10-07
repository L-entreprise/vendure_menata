import path from 'node:path';

import {
    DefaultLogger,
    InitialData,
    LanguageCode,
    LogLevel,
    mergeConfig,
    VendureConfig,
} from '@vendure/core';
import { createTestEnvironment, registerInitializer, SqljsInitializer, testConfig } from '@vendure/testing';

/**
 * Shared harness for the plugin e2e specs (plugins/<name>/e2e/*.e2e-spec.ts).
 * Each spec boots a real Vendure server on an in-memory SQLite database (sql.js),
 * cached per spec file in e2e/__data__ so later runs skip the schema setup.
 */
registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

export const TEST_SETUP_TIMEOUT_MS = 120_000;

export const initialData: InitialData = {
    defaultLanguage: LanguageCode.en,
    defaultZone: 'Europe',
    taxRates: [{ name: 'Standard Tax', percentage: 20 }],
    shippingMethods: [{ name: 'Standard Shipping', price: 500 }],
    paymentMethods: [],
    countries: [{ name: 'France', code: 'FR', zone: 'Europe' }],
    collections: [],
};

export function createPluginTestEnvironment(config: Partial<VendureConfig>) {
    // E2E_LOG=1 prints server errors, which the test config silences by default.
    const logging = process.env.E2E_LOG ? { logger: new DefaultLogger({ level: LogLevel.Error }) } : {};
    return createTestEnvironment(mergeConfig(testConfig, { ...logging, ...config }));
}

/**
 * Vendure delivers events to subscribers after the transaction commits, so side
 * effects (such as an audit entry) land a few ms after the mutation returns.
 */
export async function waitFor<T>(
    probe: () => Promise<T>,
    isDone: (value: T) => boolean,
    timeoutMs = 5_000,
): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    let value = await probe();
    while (!isDone(value)) {
        if (Date.now() > deadline) {
            throw new Error(`waitFor timed out after ${timeoutMs}ms, last value: ${JSON.stringify(value)}`);
        }
        await new Promise(resolve => setTimeout(resolve, 50));
        value = await probe();
    }
    return value;
}
