import { bootstrap, JobQueueService, runMigrations } from '@vendure/core';

import { config } from './vendure-config';

/**
 * Boots the Vendure API server. Runs pending DB migrations first.
 * The job queue runs in the dedicated worker process (index-worker.ts); set
 * RUN_JOB_QUEUE=1 to also process jobs in this process for single-service setups.
 */
runMigrations(config)
    .then(() => bootstrap(config))
    .then(app => {
        if (process.env.RUN_JOB_QUEUE === '1') {
            return app.get(JobQueueService).start();
        }
    })
    .catch(err => {
        // eslint-disable-next-line no-console
        console.error(err);
        process.exit(1);
    });
