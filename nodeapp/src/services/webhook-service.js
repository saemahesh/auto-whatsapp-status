const logger = require('../utils/logger');
const BotService = require('./bot-service');
const mediaService = require('./media-service');

console.log('[WEBHOOK SERVICE] WebhookService module loaded');

class WebhookService {
    constructor(db, redis) {
        this.db = db;
        this.redis = redis;
        this.botService = new BotService(db, redis);
        this.timings = {}; // Track performance
    }

    async processWebhook(vendorUid, payload) {
        this.timings = {}; // Reset timings
        const t0 = Date.now();
        
        // Get vendor ID from UID
        const t1 = Date.now();
        const vendorId = await this.getVendorIdFromUid(vendorUid);
        this.timings.vendorLookup = Date.now() - t1;
        
        if (!vendorId) {
            throw new Error(`Vendor not found: ${vendorUid}`);
        }

        // Check if vendor has active plan
        const t2 = Date.now();
        const hasActivePlan = await this.checkVendorActivePlan(vendorId);
        this.timings.planCheck = Date.now() - t2;
        
        if (!hasActivePlan) {
            logger.warn(`Vendor ${vendorId} has no active plan`);
        }

        const entry = payload.entry?.[0];
        const changes = entry?.changes?.[0];
        const field = changes?.field;

        // Route to appropriate handler
        const t3 = Date.now();
        let result;
        switch (field) {
            case 'messages':
                result = await this.handleMessageWebhook(vendorId, changes);
                break;
            case 'message_template_status_update':
                result = await this.handleTemplateStatusUpdate(vendorId, changes);
                break;
            case 'account_update':
                result = await this.handleAccountUpdate(vendorId, changes);
                break;
            default:
                logger.warn(`Unknown webhook field: ${field}`);
                result = { processed: false, reason: 'unknown field' };
        }
        this.timings.handler = Date.now() - t3;
        this.timings.total = Date.now() - t0;
        
        // Add timings to result
        result.timings = this.timings;
        return result;
    }

    /**
     * Check if vendor has active subscription plan (matches PHP vendorPlanDetails)
     * Simplified version - just checks if subscription exists and is active
     * @param {number} vendorId 
     * @returns {Promise<boolean>}
     */
    async checkVendorActivePlan(vendorId) {
        try {
            return await this.botService.checkVendorActivePlan(vendorId);
        } catch (error) {
            logger.error('Error checking vendor plan in webhook service:', error);
            return true; // Default to true to avoid blocking
        }
    }

    async handleMessageWebhook(vendorId, changes) {
        const value = changes.value;
        const phoneNumberId = value.metadata?.phone_number_id;
        
        // Handle message statuses (sent, delivered, read)
        if (value.statuses) {
            const t1 = Date.now();
            const result = await this.handleMessageStatus(vendorId, phoneNumberId, value.statuses[0]);
            this.timings.statusUpdate = Date.now() - t1;
            return result;
        }
        
        // Handle incoming messages
        if (value.messages) {
            const t1 = Date.now();
            const result = await this.handleIncomingMessage(vendorId, phoneNumberId, value);
            this.timings.incomingMessage = Date.now() - t1;
            return result;
        }

        return { processed: false };
    }

    async handleMessageStatus(vendorId, phoneNumberId, status) {
        const wamid = status.id;
        const messageStatus = status.status;  // sent, delivered, read, failed
        const timestamp = status.timestamp;
        const waId = status.recipient_id;
        const errors = status.errors || [];  // WhatsApp API errors

        // Check for healthy ecosystem error 131049 (matches PHP at line 3341-3368)
        // Marketing messages failed due to healthy ecosystem - we may reschedule it
        const hasHealthyEcosystemError = errors.some(err => err.code == 131049);
        
        if (hasHealthyEcosystemError && messageStatus === 'failed') {
            
            // Find the queue item for this message
            const [queueRows] = await this.db.execute(
                `SELECT q._id, q._uid, q.retries, q.campaigns__id, c._id as contact_id
                 FROM whatsapp_message_queue q
                 INNER JOIN whatsapp_message_logs ml ON ml.campaigns__id = q.campaigns__id AND ml.wamid = ?
                 LEFT JOIN contacts c ON c.wa_id = ? AND c.vendors__id = q.vendors__id
                 WHERE q.vendors__id = ? 
                 LIMIT 1`,
                [wamid, waId, vendorId]
            );
            
            if (queueRows.length > 0) {
                const queueItem = queueRows[0];
                const currentRetries = queueItem.retries || 0;
                
                // Requeue only if retries < 5 (matches PHP logic at line 3343)
                if (currentRetries < 5) {
                    const nextRetryHours = currentRetries + 1;
                    
                    // Requeue with delay (matches PHP addHours logic at line 3344)
                    await this.db.execute(
                        `UPDATE whatsapp_message_queue 
                         SET status = 1, 
                             retries = ?,
                             scheduled_at = DATE_ADD(NOW(), INTERVAL ? HOUR),
                             __data = JSON_SET(COALESCE(__data, '{}'), 
                                 '$.process_response.error_message', ?,
                                 '$.process_response.error_status', 'requeued_maintain_healthy_ecosystem'),
                             updated_at = NOW()
                         WHERE _uid = ?`,
                        [
                            currentRetries + 1,
                            nextRetryHours,
                            errors[0]?.message || 'Healthy ecosystem error',
                            queueItem._uid
                        ]
                    );
                    
                    // Delete the failed log entry (matches PHP at line 3362-3365)
                    await this.db.execute(
                        'DELETE FROM whatsapp_message_logs WHERE wamid = ? AND vendors__id = ?',
                        [wamid, vendorId]
                    );
                    
                    console.log(`[WEBHOOK SERVICE] Message requeued for healthy ecosystem (retry ${currentRetries + 1}/5), will retry in ${nextRetryHours} hour(s)`);
                    logger.info(`Message ${wamid} requeued for healthy ecosystem error (retry ${currentRetries + 1}/5)`);
                    
                    return { processed: true, status: 'requeued', reason: 'healthy_ecosystem_131049' };
                } else {
                    // Max retries reached, delete queue entry (matches PHP else block at line 3369-3376)
                    await this.db.execute(
                        'DELETE FROM whatsapp_message_queue WHERE _uid = ?',
                        [queueItem._uid]
                    );
                    console.log('[WEBHOOK SERVICE] Max retries reached for healthy ecosystem error, queue entry deleted');
                }
            }
        }

        // Update message log
        const t1 = Date.now();
        const [result] = await this.db.execute(
            `UPDATE whatsapp_message_logs 
             SET status = ?, 
                 updated_at = NOW(),
                 __data = JSON_SET(COALESCE(__data, '{}'), 
                     '$.message_status', ?, 
                     '$.status_timestamp', ?,
                     '$.status_errors', ?)
             WHERE wamid = ? AND vendors__id = ?`,
            [messageStatus, messageStatus, timestamp, JSON.stringify(errors), wamid, vendorId]
        );
        this.timings.dbUpdate = Date.now() - t1;

        // If message was sent successfully, delete from queue
        if (messageStatus === 'sent' || messageStatus === 'delivered') {
            const t2 = Date.now();
            await this.db.execute(
                `DELETE FROM whatsapp_message_queue 
                 WHERE vendors__id = ? 
                 AND phone_with_country_code = ? 
                 AND status IN (3, 4)`,
                [vendorId, waId]
            );
            this.timings.queueDelete = Date.now() - t2;
        }

        return { processed: true, status: messageStatus };
    }

    async handleIncomingMessage(vendorId, phoneNumberId, value) {
        const message = value.messages[0];
        const contact = value.contacts[0];
        
        const waId = message.from;
        const wamid = message.id;
        const messageType = message.type;
        const timestamp = message.timestamp;

        // Skip welcome and deleted messages
        if (messageType === 'request_welcome') {
            return { processed: false, reason: 'welcome_message' };
        }
        if (message.errors && message.errors[0]?.code === 131051) {
            return { processed: false, reason: 'deleted_message' };
        }

        // Get or create contact
        const t1 = Date.now();
        let contactId = await this.getOrCreateContact(vendorId, waId, contact);
        this.timings.contactLookup = Date.now() - t1;

        // Prevent duplicate message creation
        const t2 = Date.now();
        const [existingMsg] = await this.db.execute(
            'SELECT _id FROM whatsapp_message_logs WHERE wamid = ? AND vendors__id = ?',
            [wamid, vendorId]
        );
        this.timings.duplicateCheck = Date.now() - t2;

        if (existingMsg.length > 0) {
            return { processed: false, reason: 'duplicate_message' };
        }

        // Extract message body and media data based on type
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
            const mediaId = message[messageType]?.id;
            const caption = message[messageType]?.caption;
            
            const t3 = Date.now();
            try {
                // Get vendor UID for storage path
                const [vendorRows] = await this.db.execute(
                    'SELECT _uid FROM vendors WHERE _id = ?',
                    [vendorId]
                );
                const vendorUid = vendorRows[0]?._uid;

                if (vendorUid && mediaId) {
                    // Download and store media using MediaService
                    const downloadedMedia = await mediaService.downloadAndStoreMediaFile(
                        mediaId,
                        vendorUid,
                        vendorId,
                        messageType
                    );

                    if (downloadedMedia) {
                        mediaData = {
                            type: messageType,
                            link: downloadedMedia.path,
                            caption: caption,
                            mime_type: downloadedMedia.mime_type,
                            file_name: downloadedMedia.fileName,
                            original_filename: downloadedMedia.original_filename,
                            file_size: downloadedMedia.file_size,
                            sha256: downloadedMedia.sha256
                        };
                        logger.info(`Media downloaded and stored: ${downloadedMedia.path}`);
                    } else {
                        // Fallback if download fails - store metadata only
                        mediaData = {
                            type: messageType,
                            id: mediaId,
                            mime_type: message[messageType]?.mime_type,
                            caption: caption,
                            sha256: message[messageType]?.sha256
                        };
                        logger.warn(`Media download failed for ID: ${mediaId}, storing metadata only`);
                    }
                }
            } catch (error) {
                logger.error('Error downloading media:', error);
                // Store metadata only on error
                mediaData = {
                    type: messageType,
                    id: mediaId,
                    mime_type: message[messageType]?.mime_type,
                    caption: caption,
                    sha256: message[messageType]?.sha256
                };
            }
            
            messageBody = caption || `[${messageType}]`;
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
        let isForwarded = false;  // Matches PHP at line 3253
        
        if (message.reaction) {
            messageBody = message.reaction.emoji;
            repliedToWamid = message.reaction.message_id;
        } else if (message.context?.id) {
            // Regular reply
            repliedToWamid = message.context.id;
            // Check if forwarded (matches PHP at line 3253)
            isForwarded = message.context.forwarded || false;
        }

        // Find replied message UID if exists (column is replied_to_whatsapp_message_logs__uid)
        let repliedToMessageUid = null;
        if (repliedToWamid) {
            const [repliedRows] = await this.db.execute(
                'SELECT _uid FROM whatsapp_message_logs WHERE wamid = ? AND vendors__id = ?',
                [repliedToWamid, vendorId]
            );
            if (repliedRows.length > 0) {
                repliedToMessageUid = repliedRows[0]._uid;
            }
        }

        // Store message in database (matches PHP schema)
        const insertData = {
            _uid: this.generateUid(),  // Generate unique ID for this record
            wamid,
            vendors__id: vendorId,
            contacts__id: contactId,
            wab_phone_number_id: phoneNumberId,  // Note: column name is wab_phone_number_id in DB
            message: messageBody,
            is_incoming_message: 1,
            is_forwarded: isForwarded ? 1 : 0,  // Add forwarded flag (matches PHP at line 3311)
            replied_to_whatsapp_message_logs__uid: repliedToMessageUid,  // Note: column stores UID not ID
            __data: JSON.stringify({
                message_type: messageType,  // Store message_type in __data JSON
                media: mediaData,
                other: otherMessageData,
                timestamp: timestamp
            }),
            created_at: new Date(timestamp * 1000),
            updated_at: new Date()
        };

        console.log('[WEBHOOK SERVICE] Inserting message into DB:', {
            _uid: insertData._uid,
            wamid: insertData.wamid,
            contactId: insertData.contacts__id,
            messageType: messageType,
        });

        const t4 = Date.now();
        await this.db.execute(
            `INSERT INTO whatsapp_message_logs 
             (_uid, wamid, vendors__id, contacts__id, wab_phone_number_id, message, 
              is_incoming_message, is_forwarded, replied_to_whatsapp_message_logs__uid,
              __data, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                insertData._uid,
                insertData.wamid,
                insertData.vendors__id,
                insertData.contacts__id,
                insertData.wab_phone_number_id,
                insertData.message,
                insertData.is_incoming_message,
                insertData.is_forwarded,
                insertData.replied_to_whatsapp_message_logs__uid,
                insertData.__data,
                insertData.created_at,
                insertData.updated_at
            ]
        );
        this.timings.messageInsert = Date.now() - t4;

        // Process bot reply only for text-based messages
        if (messageBody && ['text', 'interactive', 'button'].includes(messageType)) {
            const t5 = Date.now();
            await this.botService.checkAndReply(vendorId, contactId, waId, messageBody, { phoneNumberId });
            this.timings.botCheck = Date.now() - t5;
            
            if (this.timings.botCheck > 1000) {
                logger.warn(`Slow bot check: ${this.timings.botCheck}ms for message: "${messageBody}"`);
            }
        }

        logger.info(`Message ${messageType} from ${waId} processed in ${this.timings.total || 0}ms`, { 
            timings: this.timings 
        });
        return { processed: true, contactId: contactId, messageType: messageType };
    }

    async getOrCreateContact(vendorId, waId, contactData) {
        // Try to find existing contact
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
