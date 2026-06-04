/* eslint-disable no-console */
import { AssetServerPlugin } from '@vendure/asset-server-plugin';
import {
    DefaultJobQueuePlugin,
    DefaultLogger,
    DefaultSchedulerPlugin,
    DefaultSearchPlugin,
    dummyPaymentHandler,
    LogLevel,
    RedisCachePlugin,
    VendureConfig,
} from '@vendure/core';
import { DashboardPlugin } from '@vendure/dashboard/plugin';
import { defaultEmailHandlers, EmailPlugin, FileBasedTemplateLoader } from '@vendure/email-plugin';
import { GraphiqlPlugin } from '@vendure/graphiql-plugin';
import { BullMQJobQueuePlugin } from '@vendure/job-queue-plugin/package/bullmq';
import { SentryPlugin } from '@vendure/sentry-plugin';
import { RedisOptions } from 'ioredis';
import path from 'path';
import { DataSourceOptions } from 'typeorm';

import { AuditLogPlugin } from '../plugins/audit-log-plugin/audit-log.plugin';
import { CmsPlugin } from '../plugins/cms-plugin/cms.plugin';
import { MenataBrandingPlugin } from '../plugins/menata-branding/menata-branding.plugin';
import { TranslationPlugin } from '../plugins/translation-plugin/translation.plugin';

const serverPort = Number(process.env.PORT) || 3000;
const useRedis = Boolean(process.env.REDIS_HOST);
const enableSentry = process.env.ENABLE_SENTRY === 'true' && Boolean(process.env.SENTRY_DSN);
const enableGraphiql = process.env.ENABLE_GRAPHIQL === 'true';

const corsOrigins = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

/**
 * Resolves the @vendure/email-plugin npm package's bundled templates directory,
 * so we don't have to copy templates into this project.
 */
const emailTemplatesPath = path.join(
    path.dirname(require.resolve('@vendure/email-plugin/package.json')),
    'templates',
);

// The dashboard `vite build` imports this config purely to discover plugins +
// extension paths; it has no secrets. Allow placeholders in that context so the
// build never needs real credentials, while runtime boots still fail fast.
const isDashboardBuild = process.env.VENDURE_DASHBOARD_BUILD === 'true';

/**
 * Fail fast on a missing required secret rather than booting with an insecure default.
 */
function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        if (isDashboardBuild) {
            return `build-time-placeholder-${name}`;
        }
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

/**
 * Production VendureConfig. The exported symbol is annotated `: VendureConfig`,
 * which is how both the server bootstrap and the dashboard Vite build discover it.
 */
export const config: VendureConfig = {
    apiOptions: {
        port: serverPort,
        adminApiPath: 'admin-api',
        shopApiPath: 'shop-api',
        // Playgrounds/introspection off by default in production; toggle via env.
        adminApiPlayground: enableGraphiql,
        shopApiPlayground: enableGraphiql,
        adminApiDebug: false,
        shopApiDebug: false,
        cors: {
            origin: corsOrigins.length > 0 ? corsOrigins : true,
            credentials: true,
        },
    },
    authOptions: {
        tokenMethod: ['bearer', 'cookie'] as const,
        requireVerification: process.env.REQUIRE_EMAIL_VERIFICATION !== 'false',
        cookieOptions: {
            secret: requireEnv('COOKIE_SECRET'),
        },
        superadminCredentials: {
            identifier: process.env.SUPERADMIN_USERNAME || 'superadmin',
            password: requireEnv('SUPERADMIN_PASSWORD'),
        },
    },
    dbConnectionOptions: {
        // Testing ground: schema auto-syncs by default. Set DB_SYNCHRONIZE=false to
        // disable once you switch to generated migrations.
        synchronize: process.env.DB_SYNCHRONIZE !== 'false',
        logging: false,
        migrations: [path.join(__dirname, 'migrations/*.ts')],
        ...getDbConfig(),
    },
    paymentOptions: {
        paymentMethodHandlers: [dummyPaymentHandler],
    },
    customFields: {},
    logger: new DefaultLogger({ level: LogLevel.Info }),
    plugins: [
        MenataBrandingPlugin,
        CmsPlugin,
        AuditLogPlugin.init({ retentionDays: Number(process.env.AUDIT_LOG_RETENTION_DAYS) || 90 }),
        TranslationPlugin.init({
            languages: [
                { code: 'en', name: 'English' },
                { code: 'fr', name: 'French' },
            ],
        }),
        AssetServerPlugin.init({
            route: 'assets',
            assetUploadDir: process.env.ASSET_UPLOAD_DIR || path.join(__dirname, 'assets'),
            // Set ASSET_URL_PREFIX to your public asset URL (e.g. https://shop.menata.fr/assets/).
            ...(process.env.ASSET_URL_PREFIX ? { assetUrlPrefix: process.env.ASSET_URL_PREFIX } : {}),
        }),
        DefaultSearchPlugin.init({ bufferUpdates: false, indexStockStatus: false }),
        DefaultSchedulerPlugin.init({}),
        // Redis-backed job queue + cache when REDIS_HOST is set, else DB queue + in-memory cache.
        ...(useRedis
            ? [
                  // BullMQ requires `maxRetriesPerRequest: null` on its (blocking) connection;
                  // ioredis defaults to 20, which makes BullMQ throw on init.
                  BullMQJobQueuePlugin.init({
                      connection: { ...getRedisConnectionOptions(), maxRetriesPerRequest: null },
                  }),
                  RedisCachePlugin.init({ redisOptions: getRedisConnectionOptions() }),
              ]
            : [DefaultJobQueuePlugin.init({})]),
        EmailPlugin.init({
            // Real SMTP transport when SMTP_HOST is configured, else dev mailbox UI at /mailbox.
            ...(process.env.SMTP_HOST
                ? {
                      transport: {
                          type: 'smtp' as const,
                          host: requireEnv('SMTP_HOST'),
                          port: Number(process.env.SMTP_PORT) || 587,
                          secure: process.env.SMTP_SECURE === 'true',
                          auth: {
                              user: requireEnv('SMTP_USER'),
                              pass: requireEnv('SMTP_PASSWORD'),
                          },
                      },
                  }
                : { devMode: true, route: 'mailbox', outputPath: path.join(__dirname, 'test-emails') }),
            handlers: defaultEmailHandlers,
            templateLoader: new FileBasedTemplateLoader(emailTemplatesPath),
            globalTemplateVars: {
                fromAddress: process.env.EMAIL_FROM || '"Menata" <noreply@menata.fr>',
                verifyEmailAddressUrl: `${process.env.STOREFRONT_URL || ''}/verify`,
                passwordResetUrl: `${process.env.STOREFRONT_URL || ''}/reset-password`,
                changeEmailAddressUrl: `${process.env.STOREFRONT_URL || ''}/change-email-address`,
            },
        }),
        ...(enableGraphiql ? [GraphiqlPlugin.init()] : []),
        ...(enableSentry ? [SentryPlugin.init({})] : []),
        DashboardPlugin.init({
            route: 'dashboard',
            // The compiled dashboard SPA produced by `vite build` (see vite.config.mts).
            appDir: path.join(__dirname, 'dist'),
        }),
    ],
};

function getRedisConnectionOptions(): RedisOptions {
    return {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: Number(process.env.REDIS_DB) || 0,
    };
}

function getDbConfig(): DataSourceOptions {
    const dbType = process.env.DB || 'mariadb';
    const shared = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT) || 3306,
        username: process.env.DB_USERNAME || 'vendure',
        password: process.env.DB_PASSWORD || 'password',
        database: process.env.DB_NAME || 'vendure',
    };
    switch (dbType) {
        case 'postgres':
            return {
                type: 'postgres',
                ...shared,
                port: Number(process.env.DB_PORT) || 5432,
                schema: process.env.DB_SCHEMA || 'public',
            } as DataSourceOptions;
        case 'mysql':
        case 'mariadb':
        default:
            return {
                type: 'mariadb',
                ...shared,
            } as DataSourceOptions;
    }
}
