/* eslint-disable no-console */
import { bootstrapWorker, TransactionalConnection } from '@vendure/core';
import 'dotenv/config';

import { migrateLegacyTranslations } from '../plugins/content-i18n/migration/migrate-legacy-translations';
import { config } from './vendure-config';

type MigrationDataSource = Parameters<typeof migrateLegacyTranslations>[0];

/**
 * One-off: moves the removed translation-plugin's data onto Vendure's native rows.
 *   npm run migrate:translations            # copy (idempotent, safe to re-run)
 *   npm run migrate:translations -- --drop  # copy, then drop the legacy tables (refused if
 *                                           # entries were skipped; add --force to drop anyway)
 *
 * Back up the database first. Boots a worker (no job processing) so the schema is in
 * sync (new CMS columns) before copying.
 */
const dropLegacyTables = process.argv.includes('--drop');
const force = process.argv.includes('--force');

bootstrapWorker(config)
    .then(async worker => {
        // In a dev checkout ../plugins may resolve a second typeorm copy (monorepo root), so the
        // DataSource types differ while the runtime object is the same.
        const dataSource = worker.app.get(TransactionalConnection).rawConnection as unknown as MigrationDataSource;
        const report = await migrateLegacyTranslations(dataSource, { dropLegacyTables, force });
        console.log(JSON.stringify(report, null, 2));
        await worker.app.close();
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
