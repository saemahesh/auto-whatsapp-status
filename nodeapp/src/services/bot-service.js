const logger = require('../utils/logger');
const whatsappApi = require('../config/whatsapp');

class BotService {
    constructor(db, redis) {
        this.db = db;
        this.redis = redis;
    }

    async checkAndReply(vendorId, contactId, waId, messageBody) {
        try {
            // Get contact's bot preferences
            const [contactRows] = await this.db.execute(
                'SELECT disable_reply_bot, disable_ai_bot FROM contacts WHERE _id = ?',
                [contactId]
            );

            if (contactRows.length === 0 || contactRows[0].disable_reply_bot) {
                return { matched: false };
            }

            // Get active bot replies (cached)
            const bots = await this.getActiveBots(vendorId);
            
            // Try to match message with bot triggers
            const matchedBot = this.findMatchingBot(messageBody.toLowerCase(), bots);

            if (matchedBot) {
                logger.info(`Bot matched: ${matchedBot._id} for message: ${messageBody}`);
                await this.sendBotReply(vendorId, contactId, waId, matchedBot);
                return { matched: true, botId: matchedBot._id };
            }

            return { matched: false };
        } catch (error) {
            logger.error('Bot check error:', error);
            return { matched: false, error: error.message };
        }
    }

    async getActiveBots(vendorId) {
        // Try cache first
        const cacheKey = `bots:${vendorId}`;
        const cached = await this.redis.get(cacheKey);
        
        if (cached) {
            return JSON.parse(cached);
        }

        // Fetch from database
        const [rows] = await this.db.execute(
            `SELECT _id, reply_trigger, trigger_type, reply_text, __data, priority_index
             FROM bot_replies
             WHERE vendors__id = ? AND status = 1
             ORDER BY priority_index ASC`,
            [vendorId]
        );

        const bots = rows.map(row => ({
            ...row,
            __data: JSON.parse(row.__data || '{}'),
            triggers: row.reply_trigger.split(',').map(t => t.trim().toLowerCase())
        }));

        // Cache for 30 minutes
        await this.redis.setex(cacheKey, 1800, JSON.stringify(bots));
        
        return bots;
    }

    findMatchingBot(messageBody, bots) {
        for (const bot of bots) {
            for (const trigger of bot.triggers) {
                let matched = false;

                switch (bot.trigger_type) {
                    case 'is':
                        matched = messageBody === trigger;
                        break;
                    case 'starts_with':
                        matched = messageBody.startsWith(trigger);
                        break;
                    case 'ends_with':
                        matched = messageBody.endsWith(trigger);
                        break;
                    case 'contains':
                        matched = messageBody.includes(trigger);
                        break;
                    case 'contains_word':
                        const regex = new RegExp(`\\b${this.escapeRegex(trigger)}\\b`, 'i');
                        matched = regex.test(messageBody);
                        break;
                }

                if (matched) {
                    return bot;
                }
            }
        }

        return null;
    }

    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    async sendBotReply(vendorId, contactId, waId, bot) {
        try {
            // Get message data from __data field (matches PHP)
            const interactionMessageData = bot.__data?.interaction_message || null;
            const mediaMessageData = bot.__data?.media_message || null;
            const templateMessageData = bot.__data?.template_message || null;

            let result;
            let messageType = 'text';
            let messageContent = bot.reply_text;

            // Send interactive message if configured (matches PHP logic at line 2403)
            if (interactionMessageData) {
                messageType = 'interactive';
                result = await whatsappApi.sendInteractiveMessage(
                    vendorId,
                    waId,
                    interactionMessageData
                );
            } 
            // Send media message if configured (matches PHP logic at line 2440)
            else if (mediaMessageData) {
                messageType = 'media';
                const mediaType = mediaMessageData.header_type; // image, video, document, audio
                const fileUrl = mediaMessageData.media_link;
                const fileName = mediaMessageData.file_name;
                const caption = mediaMessageData.caption || '';

                // Use media_id if available and not expired (matches PHP logic)
                let mediaLink = fileUrl;
                if (mediaMessageData.media_id && 
                    mediaMessageData.media_id_expiry_at && 
                    new Date(mediaMessageData.media_id_expiry_at) > new Date()) {
                    mediaLink = { id: mediaMessageData.media_id };
                }

                result = await whatsappApi.sendMediaMessage(
                    vendorId,
                    waId,
                    mediaType,
                    mediaLink,
                    caption,
                    fileName
                );
                messageContent = caption;
            }
            // Send template message if configured
            else if (templateMessageData) {
                messageType = 'template';
                result = await whatsappApi.sendTemplateMessage(
                    vendorId,
                    waId,
                    templateMessageData.name,
                    templateMessageData.language?.code || 'en',
                    templateMessageData.components || []
                );
                messageContent = `Template: ${templateMessageData.name}`;
            }
            // Default: send text message
            else {
                // Replace dynamic values in reply text
                messageContent = await this.replaceDynamicValues(bot.reply_text, contactId);
                result = await whatsappApi.sendTextMessage(vendorId, waId, messageContent);
            }

            if (result.success) {
                // Log bot reply (matches PHP updateOrCreateWhatsAppMessageFromWebhook)
                await this.db.execute(
                    `INSERT INTO whatsapp_message_logs 
                     (wamid, vendors__id, contacts__id, message, message_type, bot_replies__id, is_incoming_message, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, 0, NOW(), NOW())`,
                    [result.wamid, vendorId, contactId, messageContent, messageType, bot._id]
                );

                logger.info(`Bot reply sent: ${result.wamid} (type: ${messageType})`);
            } else {
                logger.error(`Bot reply failed for bot ${bot._id}:`, result.error);
            }

            return result;
        } catch (error) {
            logger.error('Bot reply error:', error);
            throw error;
        }
    }

    async replaceDynamicValues(text, contactId) {
        // Get contact details
        const [rows] = await this.db.execute(
            'SELECT first_name, last_name, email, phone_number FROM contacts WHERE _id = ?',
            [contactId]
        );

        if (rows.length === 0) return text;

        const contact = rows[0];
        return text
            .replace(/\{\{first_name\}\}/g, contact.first_name || '')
            .replace(/\{\{last_name\}\}/g, contact.last_name || '')
            .replace(/\{\{email\}\}/g, contact.email || '')
            .replace(/\{\{phone\}\}/g, contact.phone_number || '');
    }
}

module.exports = BotService;
