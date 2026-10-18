import { bootstrapWorker } from '@vendure/core';

import { config } from './vendure-config';

/**
 * Boots the Vendure worker, which processes the job queue.
 * Run as a separate Coolify service with command: npm run start:worker
 */
bootstrapWorker(config)
    .then(worker => worker.startJobQueue())
    .catch(err => {
        // eslint-disable-next-line no-console
        console.error(err);
        process.exit(1);
    });
