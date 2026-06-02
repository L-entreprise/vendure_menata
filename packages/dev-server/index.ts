import { bootstrap, JobQueueService, runMigrations } from '@vendure/core';

import { getDevConfig } from './dev-config';

/**
 * This bootstraps the dev server, used for testing Vendure during development.
 */
getDevConfig()
    .then(config => runMigrations(config).then(() => bootstrap(config)))
    .then(app => {
        if (process.env.RUN_JOB_QUEUE === '1') {
            return app.get(JobQueueService).start();
        }
    })
    .catch(err => {
        // eslint-disable-next-line
        console.log(err);
        process.exit(1);
    });
