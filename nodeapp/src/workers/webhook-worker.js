const { Worker } = require('bullmq');
const redis = require('../config/redis');
const db = require('../config/database');
const logger = require('../utils/logger');
const WebhookService = require('../services/webhook-service');

console.log('[WEBHOOK WORKER] Webhook worker module loaded');
console.log('[WEBHOOK WORKER] Initializing BullMQ worker...');

const webhookWorker = new Worker('whatsapp-webhooks', async (job) => {
    const startTime = Date.now();
    const timings = {};
    
    try {
        // Create service
        const t1 = Date.now();
        const webhookService = new WebhookService(db, redis);
        timings.serviceInit = Date.now() - t1;
        
        // Process webhook
        const t2 = Date.now();
        const result = await webhookService.processWebhook(
            job.data.vendorUid,
            job.data.payload,
            job.data.headers
        );
        timings.processing = Date.now() - t2;
        timings.total = Date.now() - startTime;
        
        // Log summary based on webhook type
        const webhookType = result.messageType || result.status || 'unknown';
        if (timings.total > 1000) {
            // Log slow webhooks (> 1s)
            logger.warn(`SLOW webhook ${job.id} [${webhookType}] ${timings.total}ms`, { timings, result });
        } else if (timings.total > 500) {
            // Log medium webhooks (> 500ms)
            logger.info(`Webhook ${job.id} [${webhookType}] ${timings.total}ms`, { timings });
        }
        // Fast webhooks (< 500ms) logged minimally
        
        return result;
    } catch (error) {
        timings.total = Date.now() - startTime;
        logger.error(`Webhook ${job.id} FAILED after ${timings.total}ms:`, error.message);
        throw error;
    }
}, {
    connection: redis,
    concurrency: 50,  // Process up to 50 webhooks concurrently
    limiter: {
        max: 100,      // Max 100 webhooks per second
        duration: 1000
    }
});

webhookWorker.on('completed', (job) => {
    console.log('[WEBHOOK WORKER] Event: Job', job.id, 'completed successfully');
    logger.debug(`Job ${job.id} completed`);
});

webhookWorker.on('failed', (job, err) => {
    console.error('[WEBHOOK WORKER] Event: Job', job.id, 'failed with error:', err.message);
    logger.error(`Job ${job.id} failed:`, err.message);
});

console.log('[WEBHOOK WORKER] ✓ Webhook worker initialized and ready');
console.log('[WEBHOOK WORKER] Configuration: concurrency=50, limiter=100/sec');

module.exports = webhookWorker;

