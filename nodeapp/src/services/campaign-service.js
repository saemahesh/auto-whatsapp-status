const messageQueue = require('../queues/message-queue');
const logger = require('../utils/logger');

class CampaignService {
    constructor(db, redis) {
        this.db = db;
        this.redis = redis;
    }

    async processCampaignSchedule() {
        try {
            // Get pending messages from queue
            const [messages] = await this.db.execute(
                `SELECT _uid, vendors__id, phone_with_country_code, __data
                 FROM whatsapp_message_queue
                 WHERE status = 1 
                 AND scheduled_at <= NOW()
                 ORDER BY scheduled_at ASC
                 LIMIT 100`
            );

            logger.info(`Found ${messages.length} messages to send`);

            for (const message of messages) {
                const data = JSON.parse(message.__data);
                const campaignData = data.campaign_data;

                // Get vendor settings
                const phoneNumberId = await this.getVendorPhoneNumberId(message.vendors__id);
                const accessToken = await this.getVendorAccessToken(message.vendors__id);

                // Add to queue
                await messageQueue.add('send-message', {
                    queueUid: message._uid,
                    vendorId: message.vendors__id,
                    phoneNumber: message.phone_with_country_code,
                    templateName: campaignData.whatsAppTemplateName,
                    language: campaignData.whatsAppTemplateLanguage,
                    components: campaignData.messageComponents,
                    phoneNumberId: phoneNumberId,
                    accessToken: accessToken
                });

                // Update status to processing
                await this.db.execute(
                    'UPDATE whatsapp_message_queue SET status = 3 WHERE _uid = ?',
                    [message._uid]
                );
            }

            return { processed: messages.length };
        } catch (error) {
            logger.error('Campaign processing error:', error);
            throw error;
        }
    }

    async getVendorPhoneNumberId(vendorId) {
        const cached = await this.redis.get(`vendor:${vendorId}:phone_number_id`);
        if (cached) return cached;

        const [rows] = await this.db.execute(
            'SELECT configuration_value FROM vendor_settings WHERE vendors__id = ? AND name = ?',
            [vendorId, 'current_phone_number_id']
        );

        if (rows.length === 0) throw new Error('Phone number ID not found');

        const value = rows[0].configuration_value;
        await this.redis.setex(`vendor:${vendorId}:phone_number_id`, 3600, value);
        return value;
    }

    async getVendorAccessToken(vendorId) {
        const [rows] = await this.db.execute(
            'SELECT configuration_value FROM vendor_settings WHERE vendors__id = ? AND name = ?',
            [vendorId, 'whatsapp_access_token']
        );

        if (rows.length === 0) throw new Error('Access token not found');
        return rows[0].configuration_value;
    }
}

module.exports = CampaignService;
