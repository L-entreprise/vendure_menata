/* eslint-disable no-console */
import { AssetServerPlugin } from '@vendure/asset-server-plugin';
import { ADMIN_API_PATH, API_PORT, SHOP_API_PATH } from '@vendure/common/lib/shared-constants';
import {
    DefaultJobQueuePlugin,
    DefaultLogger,
    DefaultSchedulerPlugin,
    DefaultSearchPlugin,
    dummyPaymentHandler,
    LogLevel,
    RedisCachePlugin,
    SettingsStoreScopes,
    VendureConfig,
} from '@vendure/core';
import { DashboardPlugin } from '@vendure/dashboard/plugin';
import { defaultEmailHandlers, EmailPlugin, FileBasedTemplateLoader } from '@vendure/email-plugin';
import { GraphiqlPlugin } from '@vendure/graphiql-plugin';
import { BullMQJobQueuePlugin } from '@vendure/job-queue-plugin/package/bullmq';
import { SentryPlugin } from '@vendure/sentry-plugin';
import { TelemetryPlugin } from '@vendure/telemetry-plugin';
import 'dotenv/config';
import { Redis, RedisOptions } from 'ioredis';
import path from 'path';
import { DataSourceOptions } from 'typeorm';
import { AuditLogPlugin } from '../../plugins/audit-log-plugin/audit-log.plugin';
import { CmsPlugin } from '../../plugins/cms-plugin/cms.plugin';
import { DiagnosticsPlugin } from '../../plugins/diagnostics-plugin/diagnostics.plugin';
import { MenataBrandingPlugin } from '../../plugins/menata-branding/menata-branding.plugin';
import { TranslationPlugin } from '../../plugins/translation-plugin/translation.plugin';

const IS_INSTRUMENTED = process.env.IS_INSTRUMENTED === 'true';

/**
 * Config settings used during development
 */
export const devConfig: VendureConfig = {
    apiOptions: {
        port: API_PORT,
        adminApiPath: ADMIN_API_PATH,
        adminApiPlayground: {
            settings: {
                'request.credentials': 'include',
            },
        },
        adminApiDebug: true,
        shopApiPath: SHOP_API_PATH,
        shopApiPlayground: {
            settings: {
                'request.credentials': 'include',
            },
        },
        shopApiDebug: true,
    },
    authOptions: {
        disableAuth: false,
        tokenMethod: ['bearer', 'cookie'] as const,
        requireVerification: true,
        customPermissions: [],
        cookieOptions: {
            secret: 'abc',
        },
    },
    dbConnectionOptions: {
        synchronize: true,
        logging: false,
        migrations: [path.join(__dirname, 'migrations/*.ts')],
        ...getDbConfig(),
    },
    paymentOptions: {
        paymentMethodHandlers: [dummyPaymentHandler],
    },
    settingsStoreFields: {
        MyPlugin: [
            {
                name: 'globalVal',
            },
            {
                name: 'userVal',
                scope: SettingsStoreScopes.user,
            },
        ],
    },
    customFields: {},
    logger: new DefaultLogger({ level: LogLevel.Verbose }),
    importExportOptions: {
        importAssetsDir: path.join(__dirname, 'import-assets'),
    },
    plugins: getPlugins(false),
};

/**
 * Builds the plugin list. When `useRedis` is true, the Redis-backed BullMQ job queue and
 * Redis cache are used in place of the DB-polling job queue and in-memory cache.
 */
function getPlugins(useRedis: boolean): VendureConfig['plugins'] {
    return [
        // MultivendorPlugin.init({
        //     platformFeePercent: 10,
        //     platformFeeSKU: 'FEE',
        // }),
        MenataBrandingPlugin,
        CmsPlugin,
        AuditLogPlugin.init({ retentionDays: 90 }),
        TranslationPlugin.init({
            languages: [
                { code: 'en', name: 'English' },
                { code: 'fr', name: 'French' },
            ],
        }),
        GraphiqlPlugin.init(),
        // Diagnostics: enabled when a Menata per-client key is present in the env.
        ...(process.env.MENATA_DIAGNOSTIC_API_KEY
            ? [
                  DiagnosticsPlugin.init({
                      apiBaseUrl: process.env.MENATA_API_BASE_URL ?? 'https://menata.fr',
                      apiKey: process.env.MENATA_DIAGNOSTIC_API_KEY,
                      clientId: process.env.MENATA_CLIENT_ID ?? '',
                      ctaUrl: process.env.DIAGNOSTICS_CTA_URL,
                      cacheTtlMs: process.env.DIAGNOSTICS_CACHE_TTL_MS
                          ? Number(process.env.DIAGNOSTICS_CACHE_TTL_MS)
                          : undefined,
                  }),
              ]
            : []),
        AssetServerPlugin.init({
            route: 'assets',
            assetUploadDir: path.join(__dirname, 'assets'),
        }),
        DefaultSearchPlugin.init({ bufferUpdates: false, indexStockStatus: false }),
        // Use Redis (BullMQ job queue + Redis cache) when reachable, else fall back to DB/in-memory.
        ...(useRedis
            ? [
                  BullMQJobQueuePlugin.init({ connection: getRedisConnectionOptions() }),
                  RedisCachePlugin.init({ redisOptions: getRedisConnectionOptions() }),
              ]
            : [DefaultJobQueuePlugin.init({})]),
        // JobQueueTestPlugin.init({ queueCount: 10 }),
        // ElasticsearchPlugin.init({
        //     host: 'http://localhost',
        //     port: 9200,
        //     bufferUpdates: true,
        // }),
        DefaultSchedulerPlugin.init({}),
        EmailPlugin.init({
            devMode: true,
            route: 'mailbox',
            handlers: defaultEmailHandlers,
            templateLoader: new FileBasedTemplateLoader(path.join(__dirname, '../email-plugin/templates')),
            outputPath: path.join(__dirname, 'test-emails'),
            globalTemplateVars: {
                verifyEmailAddressUrl: 'http://localhost:4201/verify',
                passwordResetUrl: 'http://localhost:4201/reset-password',
                changeEmailAddressUrl: 'http://localhost:4201/change-email-address',
            },
        }),
        ...(IS_INSTRUMENTED ? [TelemetryPlugin.init({})] : []),
        ...(process.env.ENABLE_SENTRY === 'true' && process.env.SENTRY_DSN
            ? [
                  SentryPlugin.init({
                      includeErrorTestMutation: true,
                  }),
              ]
            : []),
        DashboardPlugin.init({
            route: 'dashboard',
            appDir: path.join(__dirname, './dist'),
        }),
    ];
}

/**
 * Reads Redis connection options from the environment, defaulting to a local Redis instance.
 */
function getRedisConnectionOptions(): RedisOptions {
    return {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: Number(process.env.REDIS_DB) || 0,
    };
}

/**
 * Probes Redis with a short timeout so the server can auto-detect it on startup.
 * Returns false (rather than throwing) when Redis is unreachable.
 */
async function isRedisAvailable(options: RedisOptions = getRedisConnectionOptions()): Promise<boolean> {
    const client = new Redis({
        ...options,
        lazyConnect: true,
        connectTimeout: 1000,
        maxRetriesPerRequest: 0,
        retryStrategy: () => null,
        reconnectOnError: () => false,
    });
    // Swallow connection errors so an unreachable Redis does not spam "Unhandled error event".
    client.on('error', () => undefined);
    try {
        await client.connect();
        await client.ping();
        return true;
    } catch {
        return false;
    } finally {
        client.disconnect();
    }
}

/**
 * Resolves the dev config, switching to Redis-backed job queue + cache when Redis is reachable.
 * Use this from the server/worker entrypoints; the static {@link devConfig} keeps the DB defaults
 * for tooling (migrations, populate) that does not require Redis.
 */
export async function getDevConfig(): Promise<VendureConfig> {
    const useRedis = await isRedisAvailable();
    console.log(
        useRedis
            ? 'Redis detected: using BullMQ job queue + Redis cache'
            : 'Redis not available: using DB job queue + in-memory cache',
    );
    return { ...devConfig, plugins: getPlugins(useRedis) };
}

function getDbConfig(): DataSourceOptions {
    const dbType = process.env.DB || 'mysql';
    switch (dbType) {
        case 'postgres':
            console.log('Using postgres connection');
            return {
                synchronize: true,
                type: 'postgres',
                host: process.env.DB_HOST || 'localhost',
                port: Number(process.env.DB_PORT) || 5432,
                username: process.env.DB_USERNAME || 'vendure',
                password: process.env.DB_PASSWORD || 'password',
                database: process.env.DB_NAME || 'vendure-dev',
                schema: process.env.DB_SCHEMA || 'public',
            };
        case 'sqlite':
            console.log('Using sqlite connection');
            return {
                synchronize: true,
                type: 'better-sqlite3',
                database: path.join(__dirname, 'vendure.sqlite'),
            };
        case 'sqljs':
            console.log('Using sql.js connection');
            return {
                type: 'sqljs',
                autoSave: true,
                database: new Uint8Array([]),
                location: path.join(__dirname, 'vendure.sqlite'),
            };
        case 'mysql':
        case 'mariadb':
        default:
            console.log('Using mysql connection');
            return {
                synchronize: true,
                type: 'mariadb',
                host: process.env.DB_HOST || '127.0.0.1',
                port: Number(process.env.DB_PORT) || 3306,
                username: process.env.DB_USERNAME || 'vendure',
                password: process.env.DB_PASSWORD || 'password',
                database: process.env.DB_NAME || 'vendure-dev',
            };
    }
}
