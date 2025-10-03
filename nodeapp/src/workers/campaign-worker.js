const { Worker } = require('bullmq');
const redis = require('../config/redis');
const db = require('../config/database');
const logger = require('../utils/logger');
const WhatsAppAPI = require('../config/whatsapp');

const campaignWorker = new Worker('campaign-messages', async (job) => {
    const { 
        queueUid, 
        vendorId, 
        phoneNumber, 
        templateName, 
        language, 
        components,
        phoneNumberId,
        accessToken
    } = job.data;

    try {
        // Initialize WhatsApp API
        const whatsapp = new WhatsAppAPI(phoneNumberId, accessToken);

        // Send message
        const result = await whatsapp.sendTemplateMessage(
            phoneNumber,
            templateName,
            language,
            components
        );

        if (result.success) {
            // Update database
            await db.execute(
                'UPDATE whatsapp_message_queue SET status = 4, updated_at = NOW() WHERE _uid = ?',
                [queueUid]
            );

            // Create message log
            await db.execute(
                'INSERT INTO whatsapp_message_logs (wamid, vendors__id, phone_number_id, message_status, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
                [result.wamid, vendorId, phoneNumberId, 'sent']
            );

            logger.info(`Message sent: ${queueUid} -> ${result.wamid}`);
            return { success: true, wamid: result.wamid };
        } else {
            throw new Error(JSON.stringify(result.error));
        }
    } catch (error) {
        logger.error(`Message send failed for ${queueUid}:`, error.message);
        
        // Update queue with error
        await db.execute(
            'UPDATE whatsapp_message_queue SET status = 2, retries = retries + 1, updated_at = NOW() WHERE _uid = ?',
            [queueUid]
        );

        throw error;  // Trigger retry
    }
}, {
    connection: redis,
    concurrency: 5,  // Send 5 messages concurrently
    limiter: {
        max: 5,      // 5 messages per second (WhatsApp rate limit)
        duration: 1000
    }
});

campaignWorker.on('completed', (job) => {
    logger.info(`Campaign message ${job.id} sent successfully`);
});

campaignWorker.on('failed', (job, err) => {
    logger.error(`Campaign message ${job.id} failed:`, err.message);
});

module.exports = campaignWorker;
