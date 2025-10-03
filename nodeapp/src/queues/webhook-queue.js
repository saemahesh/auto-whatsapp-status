const { Queue } = require('bullmq');
const redis = require('../config/redis');
const logger = require('../utils/logger');

const webhookQueue = new Queue('whatsapp-webhooks', {
    connection: redis,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000
        },
        removeOnComplete: {
            count: 100,  // Keep last 100 completed jobs
            age: 3600    // Remove after 1 hour
        },
        removeOnFail: {
            age: 86400   // Keep failed jobs for 24 hours
        }
    }
});

webhookQueue.on('error', (err) => {
    logger.error('Webhook queue error:', err);
});

module.exports = webhookQueue;
