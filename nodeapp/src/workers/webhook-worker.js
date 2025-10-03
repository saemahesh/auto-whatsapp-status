const { Worker } = require('bullmq');
const redis = require('../config/redis');
const db = require('../config/database');
const logger = require('../utils/logger');
const WebhookService = require('../services/webhook-service');

const webhookWorker = new Worker('whatsapp-webhooks', async (job) => {
    const { vendorUid, payload, receivedAt } = job.data;
    
    logger.info(`Processing webhook ${job.id} for vendor ${vendorUid}`);
    
    try {
        const webhookService = new WebhookService(db, redis);
        const result = await webhookService.processWebhook(vendorUid, payload);
        
        const processingTime = Date.now() - receivedAt;
        logger.info(`Webhook ${job.id} processed in ${processingTime}ms`);
        
        return result;
    } catch (error) {
        logger.error(`Webhook ${job.id} processing failed:`, error);
        throw error;  // Will trigger retry
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
    logger.debug(`Job ${job.id} completed`);
});

webhookWorker.on('failed', (job, err) => {
    logger.error(`Job ${job.id} failed:`, err.message);
});

module.exports = webhookWorker;
