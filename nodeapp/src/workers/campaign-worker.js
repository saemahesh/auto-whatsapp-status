const { Worker } = require('bullmq');
const redis = require('../config/redis');
const db = require('../config/database');
const logger = require('../utils/logger');
const whatsappApi = require('../config/whatsapp');

console.log('[CAMPAIGN WORKER] Campaign worker module loaded');
console.log('[CAMPAIGN WORKER] Initializing BullMQ worker...');

const campaignWorker = new Worker('campaign-messages', async (job) => {
    console.log('========================================');
    console.log('[CAMPAIGN WORKER] Processing job:', job.id);
    const { 
        queueUid, 
        vendorId, 
        phoneNumber, 
        templateName, 
        language, 
        components,
        retries = 0
    } = job.data;
    
    console.log('[CAMPAIGN WORKER] Job data:', { queueUid, vendorId, phoneNumber, templateName, retries });

    try {
        console.log('[CAMPAIGN WORKER] Sending template message via WhatsApp API...');
        // Send message using vendorId (no need for phoneNumberId/accessToken)
        const result = await whatsappApi.sendTemplateMessage(
            vendorId,
            phoneNumber,
            templateName,
            language,
            components
        );

        if (result.success) {
            console.log('[CAMPAIGN WORKER] ✓ Message sent successfully, wamid:', result.wamid);
            // Get vendor settings for logging
            const settings = await whatsappApi.getVendorSettings(vendorId);
            
            // Update database to success status (4 = sent, matches PHP)
            await db.execute(
                'UPDATE whatsapp_message_queue SET status = 4, updated_at = NOW() WHERE _uid = ?',
                [queueUid]
            );
            console.log('[CAMPAIGN WORKER] Queue status updated to sent (4)');

            // Create message log (matches PHP structure)
            await db.execute(
                'INSERT INTO whatsapp_message_logs (wamid, vendors__id, phone_number_id, message_status, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
                [result.wamid, vendorId, settings.phoneNumberId, 'sent']
            );
            console.log('[CAMPAIGN WORKER] Message log created');

            logger.info(`Message sent: ${queueUid} -> ${result.wamid}`);
            console.log('========================================');
            return { success: true, wamid: result.wamid };
        } else {
            // API returned error
            console.error('[CAMPAIGN WORKER] ✗ API returned error:', result.error);
            throw new Error(JSON.stringify(result.error));
        }
    } catch (error) {
        console.error('[CAMPAIGN WORKER] ✗ Message send failed:', error.message);
        console.error('[CAMPAIGN WORKER] Stack trace:', error.stack);
        logger.error(`Message send failed for ${queueUid}:`, error.message);
        
        // Check if connection error or API error (matches PHP retry logic)
        const isConnectionError = error.code === 'ECONNREFUSED' || 
                                 error.code === 'ETIMEDOUT' ||
                                 error.code === 'ECONNRESET';
        
        const currentRetries = retries + 1;
        console.log('[CAMPAIGN WORKER] Retry count:', currentRetries, ', Is connection error:', isConnectionError);
        
        // Retry logic matching PHP (max 5 retries)
        if (currentRetries <= 5 && isConnectionError) {
            // Requeue for connection errors (status 1)
            await db.execute(
                `UPDATE whatsapp_message_queue 
                 SET status = 1, retries = ?, scheduled_at = DATE_ADD(NOW(), INTERVAL 1 MINUTE), updated_at = NOW() 
                 WHERE _uid = ?`,
                [currentRetries, queueUid]
            );
            console.log('[CAMPAIGN WORKER] Message requeued (retry', currentRetries, '/5) - connection error');
            logger.info(`Message ${queueUid} requeued (retry ${currentRetries}/5) - connection error`);
        } else if (currentRetries > 5) {
            // Max retries reached - mark as permanent error (status 2)
            await db.execute(
                `UPDATE whatsapp_message_queue 
                 SET status = 2, retries = ?, updated_at = NOW() 
                 WHERE _uid = ?`,
                [currentRetries, queueUid]
            );
            console.error('[CAMPAIGN WORKER] Message failed permanently after', currentRetries, 'retries');
            logger.error(`Message ${queueUid} failed permanently after ${currentRetries} retries`);
        } else {
            // API error - mark as error (status 2)
            await db.execute(
                'UPDATE whatsapp_message_queue SET status = 2, retries = ?, updated_at = NOW() WHERE _uid = ?',
                [currentRetries, queueUid]
            );
        }

        throw error;  // Let BullMQ handle retry
    }
}, {
    connection: redis,
    concurrency: 5,  // Send 5 messages concurrently
    limiter: {
        max: 5,      // 5 messages per second (WhatsApp rate limit)
        duration: 1000
    },
    attempts: 3,  // BullMQ will retry 3 times
    backoff: {
        type: 'exponential',
        delay: 2000  // Start with 2 second delay
    }
});

campaignWorker.on('completed', (job) => {
    logger.info(`Campaign message ${job.id} sent successfully`);
});

campaignWorker.on('failed', (job, err) => {
    logger.error(`Campaign message ${job.id} failed:`, err.message);
});

module.exports = campaignWorker;
