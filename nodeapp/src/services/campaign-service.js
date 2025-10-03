const messageQueue = require('../queues/message-queue');
const logger = require('../utils/logger');

class CampaignService {
    constructor(db, redis) {
        this.db = db;
        this.redis = redis;
    }

    async processCampaignSchedule() {
        try {
            // 1. Handle stuck messages (matches PHP stuckInProcessing)
            // Messages stuck in processing for more than 5 minutes
            const [stuckResult] = await this.db.execute(
                `UPDATE whatsapp_message_queue 
                 SET status = 6, updated_at = NOW()
                 WHERE status = 3 
                 AND scheduled_at <= NOW() 
                 AND updated_at <= DATE_SUB(NOW(), INTERVAL 5 MINUTE)`
            );

            if (stuckResult.affectedRows > 0) {
                logger.warn(`Found ${stuckResult.affectedRows} stuck messages, marked as awaiting response`);
            }

            // 2. Handle expired messages (matches PHP expiry check)
            // Mark messages with past expiry_at as expired (status 5)
            await this.db.execute(
                `UPDATE whatsapp_message_queue 
                 SET status = 5, updated_at = NOW()
                 WHERE status = 1 
                 AND JSON_EXTRACT(__data, '$.expiry_at') IS NOT NULL
                 AND JSON_EXTRACT(__data, '$.expiry_at') <= NOW()`
            );

            // 3. Get batch size from database (matches PHP getAppSettings('cron_process_messages_per_lot'))
            // Fetches from configurations table with caching
            const batchSize = await this.getBatchSize();
            
            const [messages] = await this.db.execute(
                `SELECT _uid, vendors__id, phone_with_country_code, __data, retries
                 FROM whatsapp_message_queue
                 WHERE status = 1 
                 AND scheduled_at <= NOW()
                 ORDER BY scheduled_at ASC
                 LIMIT ?`,
                [batchSize]
            );

            if (messages.length === 0) {
                return { processed: 0, message: 'Nothing to process' };
            }

            logger.info(`Found ${messages.length} messages to send (batch size: ${batchSize})`);

            for (const message of messages) {
                const data = JSON.parse(message.__data);
                const campaignData = data.campaign_data;

                // Add to BullMQ queue with retry count
                await messageQueue.add('send-message', {
                    queueUid: message._uid,
                    vendorId: message.vendors__id,
                    phoneNumber: message.phone_with_country_code,
                    templateName: campaignData.whatsAppTemplateName,
                    language: campaignData.whatsAppTemplateLanguage,
                    components: campaignData.messageComponents,
                    retries: message.retries || 0
                });

                // Update status to processing (3)
                await this.db.execute(
                    'UPDATE whatsapp_message_queue SET status = 3, updated_at = NOW() WHERE _uid = ?',
                    [message._uid]
                );
            }

            return { processed: messages.length };
        } catch (error) {
            logger.error('Campaign processing error:', error);
            throw error;
        }
    }

    /**
     * Get batch size from database configurations table (matches PHP getAppSettings)
     * @returns {Promise<number>}
     */
    async getBatchSize() {
        // Try cache first (matches PHP viaFlashCache)
        const cacheKey = 'app_setting:cron_process_messages_per_lot';
        const cached = await this.redis.get(cacheKey);
        
        if (cached) {
            return parseInt(cached);
        }

        try {
            // Fetch from configurations table (matches PHP ConfigurationModel)
            const [rows] = await this.db.execute(
                `SELECT value FROM configurations 
                 WHERE name = 'cron_process_messages_per_lot' 
                 LIMIT 1`
            );

            // Default to 60 if not found (matches PHP default)
            const batchSize = rows.length > 0 ? parseInt(rows[0].value) : 60;

            // Cache for 5 minutes (matches PHP flash cache duration)
            await this.redis.setex(cacheKey, 300, batchSize);

            return batchSize;
        } catch (error) {
            logger.error('Error fetching batch size from DB, using default 60:', error.message);
            return 60; // Fallback to default
        }
    }
}

module.exports = CampaignService;
