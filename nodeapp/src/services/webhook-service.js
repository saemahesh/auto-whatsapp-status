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

        // Get or create contact
        let contactId = await this.getOrCreateContact(vendorId, waId, contact);

        // Extract message body based on type
        let messageBody = '';
        if (messageType === 'text') {
            messageBody = message.text?.body;
        } else if (messageType === 'interactive') {
            messageBody = message.interactive?.button_reply?.title || 
                         message.interactive?.list_reply?.title;
        } else if (messageType === 'button') {
            messageBody = message.button?.text;
        }

        // Store message in database
        await this.db.execute(
            `INSERT INTO whatsapp_message_logs 
             (wamid, vendors__id, contacts__id, phone_number_id, message, 
              message_type, is_incoming_message, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 1, FROM_UNIXTIME(?), NOW())`,
            [wamid, vendorId, contactId, phoneNumberId, messageBody, messageType, timestamp]
        );

        // Process bot reply if message has text
        if (messageBody) {
            await this.botService.checkAndReply(vendorId, contactId, waId, messageBody, phoneNumberId);
        }

        logger.info(`Incoming message stored: ${wamid} from ${waId}`);
        return { processed: true, contactId: contactId };
    }

    async getOrCreateContact(vendorId, waId, contactData) {
        // Try to find existing contact
        const [rows] = await this.db.execute(
            'SELECT _id FROM contacts WHERE vendors__id = ? AND wa_id = ?',
            [vendorId, waId]
        );

        if (rows.length > 0) {
            return rows[0]._id;
        }

        // Create new contact
        const profileName = contactData?.profile?.name || '';
        const firstName = profileName.split(' ')[0] || '';
        const lastName = profileName.replace(firstName, '').trim();

        const [result] = await this.db.execute(
            `INSERT INTO contacts (vendors__id, wa_id, first_name, last_name, phone_number, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
            [vendorId, waId, firstName, lastName, waId]
        );

        logger.info(`New contact created: ${waId}`);
        return result.insertId;
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
