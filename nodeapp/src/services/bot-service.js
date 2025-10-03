const logger = require('../utils/logger');
const whatsappApi = require('../config/whatsapp');

class BotService {
    constructor(db, redis) {
        this.db = db;
        this.redis = redis;
    }

    /**
     * Check if bot timing restrictions allow processing (matches PHP isInAllowedBotTiming)
     * @param {number} vendorId 
     * @returns {Promise<boolean>}
     */
    async isInAllowedBotTiming(vendorId) {
        try {
            // Get timing settings from vendor_settings
            const [settings] = await this.db.execute(
                `SELECT name, value FROM vendor_settings 
                 WHERE vendors__id = ? AND status = 1 
                 AND name IN ('enable_bot_timing_restrictions', 'bot_start_timing', 'bot_end_timing', 'bot_timing_timezone')`,
                [vendorId]
            );

            const settingsMap = {};
            settings.forEach(s => settingsMap[s.name] = s.value);

            // If timing restrictions not enabled, always allow
            if (!settingsMap.enable_bot_timing_restrictions || settingsMap.enable_bot_timing_restrictions !== '1') {
                return true;
            }

            const timezone = settingsMap.bot_timing_timezone || 'UTC';
            const startTime = settingsMap.bot_start_timing || '00:00';
            const endTime = settingsMap.bot_end_timing || '23:59';

            // Parse times (format: HH:mm)
            const now = new Date().toLocaleString('en-US', { timeZone: timezone });
            const currentDate = new Date(now);
            const currentHours = currentDate.getHours();
            const currentMinutes = currentDate.getMinutes();

            const [startHours, startMinutes] = startTime.split(':').map(Number);
            const [endHours, endMinutes] = endTime.split(':').map(Number);

            // Convert to minutes since midnight for easier comparison
            const currentTimeMinutes = currentHours * 60 + currentMinutes;
            let startTimeMinutes = startHours * 60 + startMinutes;
            let endTimeMinutes = endHours * 60 + endMinutes;

            // Handle case where end time is before start time (crosses midnight)
            if (endTimeMinutes <= startTimeMinutes) {
                // If current time is after midnight, add 24 hours to end time
                if (currentTimeMinutes < startTimeMinutes) {
                    startTimeMinutes -= 24 * 60;
                }
            }

            const isInTime = currentTimeMinutes >= startTimeMinutes && currentTimeMinutes <= endTimeMinutes;
            
            logger.debug(`Bot timing check for vendor ${vendorId}: ${isInTime}`, {
                currentTime: `${currentHours}:${currentMinutes}`,
                startTime,
                endTime,
                timezone
            });

            return isInTime;
        } catch (error) {
            logger.error('Error checking bot timing:', error);
            return true; // Default to allowing if error
        }
    }

    /**
     * Check if this is a first message for welcome bot (matches PHP welcome bot logic)
     * @param {number} vendorId 
     * @param {number} contactId 
     * @returns {Promise<boolean>}
     */
    async isFirstMessage(vendorId, contactId) {
        try {
            // Check if we have incoming message in last 24 hours (matches PHP logic at line 2684)
            const [rows] = await this.db.execute(
                `SELECT COUNT(*) as count FROM whatsapp_message_logs
                 WHERE vendors__id = ? 
                 AND contacts__id = ? 
                 AND is_incoming_message = 1
                 AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
                [vendorId, contactId]
            );

            // If count > 1, it's not first message
            return rows[0].count <= 1;
        } catch (error) {
            logger.error('Error checking first message:', error);
            return false;
        }
    }

    async checkAndReply(vendorId, contactId, waId, messageBody, options = {}) {
        try {
            // Check if vendor has active plan (matches PHP logic at line 2655-2658)
            const hasActivePlan = await this.checkVendorActivePlan(vendorId);
            if (!hasActivePlan) {
                logger.warn(`Vendor ${vendorId} has no active plan, skipping bot reply`);
                return { matched: false, reason: 'no_active_plan' };
            }

            // Get contact's bot preferences
            const [contactRows] = await this.db.execute(
                'SELECT disable_reply_bot, disable_ai_bot, whatsapp_opt_out FROM contacts WHERE _id = ?',
                [contactId]
            );

            if (contactRows.length === 0 || contactRows[0].disable_reply_bot) {
                return { matched: false };
            }

            const contact = contactRows[0];

            // Check bot timing restrictions (matches PHP logic at line 2671-2673)
            const isBotTimingsEnabled = await this.getVendorSetting(vendorId, 'enable_bot_timing_restrictions');
            const isBotTimingsInTime = await this.isInAllowedBotTiming(vendorId);

            // Get active bot replies (cached)
            const bots = await this.getActiveBots(vendorId);
            
            // Check if it's first message for welcome bot
            const isFirstMsg = await this.isFirstMessage(vendorId, contactId);

            // Try to match message with bot triggers
            const matchedBot = await this.findMatchingBot(
                messageBody.toLowerCase(), 
                bots, 
                isFirstMsg,
                isBotTimingsEnabled,
                isBotTimingsInTime,
                contact
            );

            if (matchedBot) {
                logger.info(`Bot matched: ${matchedBot._id} for message: ${messageBody}`);
                await this.sendBotReply(vendorId, contactId, waId, matchedBot, contact);
                return { matched: true, botId: matchedBot._id };
            }

            return { matched: false };
        } catch (error) {
            logger.error('Bot check error:', error);
            return { matched: false, error: error.message };
        }
    }

    /**
     * Check if vendor has active subscription plan (matches PHP vendorPlanDetails)
     * @param {number} vendorId 
     * @returns {Promise<boolean>}
     */
    async checkVendorActivePlan(vendorId) {
        try {
            const [rows] = await this.db.execute(
                `SELECT _id FROM subscriptions 
                 WHERE vendors__id = ? 
                 AND status = 1
                 AND (ends_at IS NULL OR ends_at > NOW())
                 LIMIT 1`,
                [vendorId]
            );
            return rows.length > 0;
        } catch (error) {
            logger.error('Error checking vendor plan:', error);
            return true; // Default to true to avoid blocking
        }
    }

    /**
     * Get single vendor setting (helper method)
     */
    async getVendorSetting(vendorId, settingName) {
        const cacheKey = `vendor_setting:${vendorId}:${settingName}`;
        const cached = await this.redis.get(cacheKey);
        
        if (cached !== null) {
            return cached;
        }

        const [rows] = await this.db.execute(
            `SELECT value FROM vendor_settings WHERE vendors__id = ? AND name = ? AND status = 1`,
            [vendorId, settingName]
        );

        const value = rows.length > 0 ? rows[0].value : null;
        await this.redis.setex(cacheKey, 300, value || ''); // Cache 5 minutes
        return value;
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

    async findMatchingBot(messageBody, bots, isFirstMessage, timingEnabled, timingInTime, contact) {
        for (const bot of bots) {
            // Check timing restrictions for this bot type (matches PHP logic at line 2688-2690)
            if (timingEnabled && !timingInTime) {
                // Skip bots that have timing restrictions
                // Note: PHP has enable_selected_other_bot_timing_restrictions - we simplify here
                if (bot.trigger_type !== 'welcome') {
                    continue;
                }
            }

            // Handle welcome bot (matches PHP logic at line 2750-2753)
            if (bot.trigger_type === 'welcome') {
                if (!isFirstMessage) {
                    continue; // Skip welcome bot if not first message
                }
                return bot; // Welcome bot matches on first message
            }

            // Handle special triggers (matches PHP logic at line 2754-2809)
            for (const trigger of bot.triggers) {
                let matched = false;

                // Special trigger: start_promotional (matches PHP line 2754-2764)
                if (bot.trigger_type === 'start_promotional') {
                    if (messageBody === trigger) {
                        // Update contact to opt-in (remove whatsapp_opt_out)
                        if (contact.whatsapp_opt_out) {
                            await this.db.execute(
                                'UPDATE contacts SET whatsapp_opt_out = NULL WHERE _id = ?',
                                [contact._id]
                            );
                        }
                        matched = true;
                    }
                }
                // Special trigger: stop_promotional (matches PHP line 2765-2775)
                else if (bot.trigger_type === 'stop_promotional') {
                    if (messageBody === trigger) {
                        // Update contact to opt-out
                        if (!contact.whatsapp_opt_out) {
                            await this.db.execute(
                                'UPDATE contacts SET whatsapp_opt_out = 1 WHERE _id = ?',
                                [contact._id]
                            );
                        }
                        matched = true;
                    }
                }
                // Special trigger: start_ai_bot (matches PHP line 2776-2786)
                else if (bot.trigger_type === 'start_ai_bot') {
                    if (messageBody === trigger) {
                        // Enable AI bot for contact
                        if (contact.disable_ai_bot) {
                            await this.db.execute(
                                'UPDATE contacts SET disable_ai_bot = 0 WHERE _id = ?',
                                [contact._id]
                            );
                        }
                        matched = true;
                    }
                }
                // Special trigger: stop_ai_bot (matches PHP line 2787-2797)
                else if (bot.trigger_type === 'stop_ai_bot') {
                    if (messageBody === trigger) {
                        // Disable AI bot for contact
                        if (!contact.disable_ai_bot) {
                            await this.db.execute(
                                'UPDATE contacts SET disable_ai_bot = 1 WHERE _id = ?',
                                [contact._id]
                            );
                        }
                        matched = true;
                    }
                }
                // Regular triggers (matches PHP logic at line 2798-2825)
                else if (bot.trigger_type === 'is') {
                    matched = messageBody === trigger;
                }
                else if (bot.trigger_type === 'starts_with') {
                    matched = messageBody.startsWith(trigger);
                }
                else if (bot.trigger_type === 'ends_with') {
                    matched = messageBody.endsWith(trigger);
                }
                else if (bot.trigger_type === 'contains') {
                    matched = messageBody.includes(trigger);
                }
                else if (bot.trigger_type === 'contains_word') {
                    const regex = new RegExp(`\\b${this.escapeRegex(trigger)}\\b`, 'i');
                    matched = regex.test(messageBody);
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

    async sendBotReply(vendorId, contactId, waId, bot, contact) {
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
                     (_uid, wamid, vendors__id, contacts__id, message, bot_replies__id, is_incoming_message, 
                      __data, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, 0, ?, NOW(), NOW())`,
                    [
                        this.generateUid(),
                        result.wamid, 
                        vendorId, 
                        contactId, 
                        messageContent, 
                        bot._id,
                        JSON.stringify({ message_type: messageType })
                    ]
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

    /**
     * Replace dynamic values in text (matches PHP dynamicValuesReplacement)
     * Supports: {{first_name}}, {{last_name}}, {{full_name}}, {{email}}, {{phone_number}}, {{country}}
     * @param {string} text 
     * @param {number} contactId 
     * @returns {Promise<string>}
     */
    async replaceDynamicValues(text, contactId) {
        try {
            // Get contact details with country name (matches PHP)
            const [rows] = await this.db.execute(
                `SELECT c.first_name, c.last_name, c.email, c.phone_number, c.wa_id, c.language_code,
                        co.name as country_name
                 FROM contacts c
                 LEFT JOIN countries co ON c.countries__id = co._id
                 WHERE c._id = ?`,
                [contactId]
            );

            if (rows.length === 0) return text;

            const contact = rows[0];
            
            // Dynamic fields to replace (matches PHP at line 2560-2568)
            const replacements = {
                '{{first_name}}': contact.first_name || '',
                '{{last_name}}': contact.last_name || '',
                '{{full_name}}': `${contact.first_name || ''} ${contact.last_name || ''}`.trim(),
                '{{phone_number}}': contact.wa_id || contact.phone_number || '',
                '{{email}}': contact.email || '',
                '{{country}}': contact.country_name || '',
                '{{language_code}}': contact.language_code || ''
            };

            // Also support single curly braces (matches PHP strtr logic)
            const singleBraceReplacements = {
                '{first_name}': contact.first_name || '',
                '{last_name}': contact.last_name || '',
                '{full_name}': `${contact.first_name || ''} ${contact.last_name || ''}`.trim(),
                '{phone_number}': contact.wa_id || contact.phone_number || '',
                '{email}': contact.email || '',
                '{country}': contact.country_name || '',
                '{language_code}': contact.language_code || ''
            };

            // Replace double braces first, then single braces
            let result = text;
            Object.entries(replacements).forEach(([key, value]) => {
                result = result.split(key).join(value);
            });
            Object.entries(singleBraceReplacements).forEach(([key, value]) => {
                result = result.split(key).join(value);
            });

            // TODO: Add custom field support (matches PHP line 2570-2575)
            // This would require fetching from contact_custom_field_values table

            return result;
        } catch (error) {
            logger.error('Error replacing dynamic values:', error);
            return text; // Return original text on error
        }
    }

    /**
     * Generate UID for records (matches PHP YesSecurity::generateUid)
     * @returns {string}
     */
    generateUid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}

module.exports = BotService;
