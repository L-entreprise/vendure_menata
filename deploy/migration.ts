/* eslint-disable no-console */
import { generateMigration, revertLastMigration, runMigration } from '@vendure/core';
import 'dotenv/config';

import { config } from './vendure-config';

/**
 * Migration CLI for the deploy project. Run via the npm scripts:
 *   npm run migration:generate <Name>   # diff entities vs DB, write a new migration
 *   npm run migration:run               # apply pending migrations
 *   npm run migration:revert            # roll back the last applied migration
 *
 * Generated files land in ./migrations (matching `migrations:` in vendure-config.ts).
 * `runMigrations(config)` in index.ts also applies them automatically on server boot,
 * so production just needs the files committed — no manual run step on deploy.
 */
const command = process.argv[2];
const name = process.argv[3];

if (command === 'generate') {
    if (!name) {
        console.error('Usage: npm run migration:generate <MigrationName>');
        process.exit(1);
    }
    generateMigration(config, { name, outputDir: './migrations' })
        .then(() => process.exit(0))
        .catch(err => {
            console.error(err);
            process.exit(1);
        });
} else if (command === 'run') {
    runMigration(config)
        .then(() => process.exit(0))
        .catch(err => {
            console.error(err);
            process.exit(1);
        });
} else if (command === 'revert') {
    revertLastMigration(config)
        .then(() => process.exit(0))
        .catch(err => {
            console.error(err);
            process.exit(1);
        });
} else {
    console.error('Unknown command. Use: generate <Name> | run | revert');
    process.exit(1);
}
