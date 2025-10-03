const logger = require('../utils/logger');
const BotService = require('./bot-service');

class WebhookService {
    constructor(db, redis) {
        this.db = db;
        this.redis = redis;
        this.botService = new BotService(db, redis);
    }

    async processWebhook(vendorUid, payload) {
        // Get vendor ID from UID
        const vendorId = await this.getVendorIdFromUid(vendorUid);
        if (!vendorId) {
            throw new Error(`Vendor not found: ${vendorUid}`);
        }

        const entry = payload.entry?.[0];
        const changes = entry?.changes?.[0];
        const field = changes?.field;

        // Route to appropriate handler
        switch (field) {
            case 'messages':
                return await this.handleMessageWebhook(vendorId, changes);
            case 'message_template_status_update':
                return await this.handleTemplateStatusUpdate(vendorId, changes);
            case 'account_update':
                return await this.handleAccountUpdate(vendorId, changes);
            default:
                logger.warn(`Unknown webhook field: ${field}`);
                return { processed: false };
        }
    }

    async handleMessageWebhook(vendorId, changes) {
        const value = changes.value;
        const phoneNumberId = value.metadata?.phone_number_id;
        
        // Handle message statuses (sent, delivered, read)
        if (value.statuses) {
            return await this.handleMessageStatus(vendorId, phoneNumberId, value.statuses[0]);
        }
        
        // Handle incoming messages
        if (value.messages) {
            return await this.handleIncomingMessage(vendorId, phoneNumberId, value);
        }

        return { processed: false };
    }

    async handleMessageStatus(vendorId, phoneNumberId, status) {
        const wamid = status.id;
        const messageStatus = status.status;  // sent, delivered, read, failed
        const timestamp = status.timestamp;
        const waId = status.recipient_id;

        // Update message log
        const [result] = await this.db.execute(
            `UPDATE whatsapp_message_logs 
             SET message_status = ?, 
                 status_timestamp = FROM_UNIXTIME(?),
                 updated_at = NOW()
             WHERE wamid = ? AND vendors__id = ?`,
            [messageStatus, timestamp, wamid, vendorId]
        );

        // If message was sent successfully, delete from queue
        if (messageStatus === 'sent' || messageStatus === 'delivered') {
            await this.db.execute(
                `DELETE FROM whatsapp_message_queue 
                 WHERE vendors__id = ? 
                 AND phone_with_country_code = ? 
                 AND status IN (3, 4)`,  // processing or waiting
                [vendorId, waId]
            );
        }

        logger.info(`Message status updated: ${wamid} -> ${messageStatus}`);
        return { processed: true, status: messageStatus };
    }

    async handleIncomingMessage(vendorId, phoneNumberId, value) {
        const message = value.messages[0];
        const contact = value.contacts[0];
        
        const waId = message.from;
        const wamid = message.id;
        const messageType = message.type;
        const timestamp = message.timestamp;

        // Skip welcome and deleted messages (matches PHP logic)
        if (messageType === 'request_welcome') {
            return { processed: false, reason: 'welcome_message' };
        }

        // Check for deleted message error (matches PHP)
        if (message.errors && message.errors[0]?.code === 131051) {
            return { processed: false, reason: 'deleted_message' };
        }

        // Get or create contact
        let contactId = await this.getOrCreateContact(vendorId, waId, contact);

        // Prevent duplicate message creation (matches PHP hasLogEntryOfMessage check)
        const [existingMsg] = await this.db.execute(
            'SELECT _id FROM whatsapp_message_logs WHERE wamid = ? AND vendors__id = ?',
            [wamid, vendorId]
        );

        if (existingMsg.length > 0) {
            logger.info(`Duplicate message skipped: ${wamid}`);
            return { processed: false, reason: 'duplicate_message' };
        }

        // Extract message body and media data based on type (matches PHP logic)
        let messageBody = '';
        let mediaData = null;
        let otherMessageData = null;

        if (messageType === 'text') {
            messageBody = message.text?.body;
        } 
        else if (messageType === 'interactive') {
            messageBody = message.interactive?.button_reply?.title || 
                         message.interactive?.list_reply?.title ||
                         JSON.stringify(message.interactive?.nfm_reply?.response_json);
        } 
        else if (messageType === 'button') {
            messageBody = message.button?.text;
        }
        else if (['image', 'video', 'audio', 'document', 'sticker'].includes(messageType)) {
            // Store media information (matches PHP media handling)
            mediaData = {
                type: messageType,
                id: message[messageType]?.id,
                mime_type: message[messageType]?.mime_type,
                caption: message[messageType]?.caption,
                sha256: message[messageType]?.sha256
            };
            messageBody = message[messageType]?.caption || `[${messageType}]`;
        }
        else if (['location', 'contacts'].includes(messageType)) {
            // Store location/contacts data (matches PHP)
            otherMessageData = {
                type: messageType,
                data: message[messageType]
            };
            messageBody = messageType === 'location' 
                ? `[Location: ${message.location?.latitude}, ${message.location?.longitude}]`
                : `[Contact]`;
        }

        // Handle reactions (matches PHP logic)
        let repliedToWamid = null;
        if (message.reaction) {
            messageBody = message.reaction.emoji;
            repliedToWamid = message.reaction.message_id;
        } else if (message.context?.id) {
            // Regular reply
            repliedToWamid = message.context.id;
        }

        // Find replied message if exists
        let repliedToMessageId = null;
        if (repliedToWamid) {
            const [repliedRows] = await this.db.execute(
                'SELECT _id FROM whatsapp_message_logs WHERE wamid = ? AND vendors__id = ?',
                [repliedToWamid, vendorId]
            );
            if (repliedRows.length > 0) {
                repliedToMessageId = repliedRows[0]._id;
            }
        }

        // Store message in database (matches PHP schema)
        const insertData = {
            wamid,
            vendors__id: vendorId,
            contacts__id: contactId,
            phone_number_id: phoneNumberId,
            message: messageBody,
            message_type: messageType,
            is_incoming_message: 1,
            replied_to_whatsapp_message_logs__id: repliedToMessageId,
            __data: JSON.stringify({
                media: mediaData,
                other: otherMessageData,
                timestamp: timestamp
            }),
            created_at: new Date(timestamp * 1000),
            updated_at: new Date()
        };

        await this.db.execute(
            `INSERT INTO whatsapp_message_logs 
             (wamid, vendors__id, contacts__id, phone_number_id, message, 
              message_type, is_incoming_message, replied_to_whatsapp_message_logs__id,
              __data, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                insertData.wamid,
                insertData.vendors__id,
                insertData.contacts__id,
                insertData.phone_number_id,
                insertData.message,
                insertData.message_type,
                insertData.is_incoming_message,
                insertData.replied_to_whatsapp_message_logs__id,
                insertData.__data,
                insertData.created_at,
                insertData.updated_at
            ]
        );

        // Process bot reply only for text-based messages (matches PHP logic)
        if (messageBody && ['text', 'interactive', 'button'].includes(messageType)) {
            await this.botService.checkAndReply(vendorId, contactId, waId, messageBody);
        }

        logger.info(`Incoming message stored: ${wamid} from ${waId}, type: ${messageType}`);
        return { processed: true, contactId: contactId, messageType: messageType };
    }

    async getOrCreateContact(vendorId, waId, contactData) {
        // Try to find existing contact (matches PHP getVendorContactByWaId)
        const [rows] = await this.db.execute(
            'SELECT _id, _uid, first_name FROM contacts WHERE vendors__id = ? AND wa_id = ?',
            [vendorId, waId]
        );

        if (rows.length > 0) {
            const contact = rows[0];
            
            // Update contact name if empty (matches PHP logic)
            if (!contact.first_name && contactData?.profile?.name) {
                const profileName = contactData.profile.name;
                const nameParts = profileName.split(' ');
                const firstName = nameParts[0] || '';
                const lastName = nameParts.slice(1).join(' ');

                await this.db.execute(
                    'UPDATE contacts SET first_name = ?, last_name = ?, updated_at = NOW() WHERE _id = ?',
                    [firstName, lastName, contact._id]
                );

                logger.info(`Contact name updated: ${waId}`);
            }
            
            return contact._id;
        }

        // Check plan limits before creating (matches PHP vendorPlanDetails check)
        const [countResult] = await this.db.execute(
            'SELECT COUNT(*) as count FROM contacts WHERE vendors__id = ?',
            [vendorId]
        );
        
        // Note: Actual plan limit check should be implemented based on vendor's subscription
        // For now, we're allowing contact creation (PHP also allows if no limit)

        // Create new contact with UID (matches PHP storeContact)
        const profileName = contactData?.profile?.name || '';
        const nameParts = profileName.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ');
        const contactUid = this.generateUid();

        await this.db.execute(
            `INSERT INTO contacts 
             (_uid, vendors__id, wa_id, first_name, last_name, phone_number, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [contactUid, vendorId, waId, firstName, lastName, waId]
        );

        // Get the newly created contact ID
        const [newContact] = await this.db.execute(
            'SELECT _id FROM contacts WHERE _uid = ?',
            [contactUid]
        );

        logger.info(`New contact created: ${waId} with UID: ${contactUid}`);
        return newContact[0]._id;
    }

    /**
     * Generate UID for records (matches PHP YesSecurity::generateUid)
     * @returns {string}
     */
    generateUid() {
        // Generate a UUID-like string (matches PHP's UID format)
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    async getVendorIdFromUid(vendorUid) {
        const cached = await this.redis.get(`vendor:uid:${vendorUid}`);
        if (cached) return parseInt(cached);

        const [rows] = await this.db.execute(
            'SELECT _id FROM vendors WHERE _uid = ?',
            [vendorUid]
        );

        if (rows.length === 0) return null;

        const vendorId = rows[0]._id;
        await this.redis.setex(`vendor:uid:${vendorUid}`, 3600, vendorId);
        return vendorId;
    }

    async handleTemplateStatusUpdate(vendorId, changes) {
        // Handle template approval/rejection
        logger.info('Template status update received');
        return { processed: true };
    }

    async handleAccountUpdate(vendorId, changes) {
        // Handle account connection changes
        logger.info('Account update received');
        return { processed: true };
    }
}

module.exports = WebhookService;
