const { Worker } = require('bullmq');
const redis = require('../config/redis');
const db = require('../config/database');
const logger = require('../utils/logger');
const WebhookService = require('../services/webhook-service');

console.log('[WEBHOOK WORKER] Webhook worker module loaded');
console.log('[WEBHOOK WORKER] Initializing BullMQ worker...');

const webhookWorker = new Worker('whatsapp-webhooks', async (job) => {
    console.log('========================================');
    console.log('[WEBHOOK WORKER] Processing job:', job.id);
    const { vendorUid, payload, receivedAt } = job.data;
    console.log('[WEBHOOK WORKER] Job data:', { vendorUid, receivedAt });
    // console.log('[WEBHOOK WORKER] Job payload:', JSON.stringify(payload, null, 2));
    
    logger.info(`Processing webhook ${job.id} for vendor ${vendorUid}`);
    
    try {
        console.log('[WEBHOOK WORKER] Creating WebhookService instance...');
        const webhookService = new WebhookService(db, redis);
        
        console.log('[WEBHOOK WORKER] Calling webhookService.processWebhook...');
        const result = await webhookService.processWebhook(vendorUid, payload);
        
        const processingTime = Date.now() - receivedAt;
        console.log('[WEBHOOK WORKER] ✓ Job completed in', processingTime, 'ms');
        console.log('[WEBHOOK WORKER] Result:', JSON.stringify(result, null, 2));
        logger.info(`Webhook ${job.id} processed in ${processingTime}ms`);
        
        return result;
    } catch (error) {
        console.error('[WEBHOOK WORKER] ✗ Job failed:', error.message);
        console.error('[WEBHOOK WORKER] Stack trace:', error.stack);
        logger.error(`Webhook ${job.id} processing failed:`, error);
        throw error;  // Will trigger retry
    } finally {
        console.log('========================================');
    }
}, {
    connection: redis,
    concurrency: 50,  // Process 50 webhooks concurrently
    limiter: {
        max: 100,     // Max 100 webhooks per second
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

