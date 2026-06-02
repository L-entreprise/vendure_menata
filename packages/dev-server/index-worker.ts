import { bootstrapWorker } from '@vendure/core';

import { getDevConfig } from './dev-config';

getDevConfig()
    .then(config => bootstrapWorker(config))
    .then(worker => worker.startJobQueue())
    // .then(worker => worker.startHealthCheckServer({ port: 3001 }))
    .catch(err => {
        // eslint-disable-next-line
        console.log(err);
        process.exit(1);
    });
