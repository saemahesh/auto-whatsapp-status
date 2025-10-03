# WhatsApp Cloud API - Node.js Implementation Plan

## Overview
This document outlines the step-by-step implementation of a Node.js service to handle WhatsApp message sending and webhook processing, replacing the PHP backend for these critical operations while keeping the PHP admin panel intact.

---

## Architecture Design

### High-Level Architecture
```
┌─────────────────┐
│  PHP Laravel    │ ← Admin Panel, Campaign Management, UI
│  (Port 80/443)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  MySQL Database │ ← Shared data store
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Redis Server   │ ← Queue & Cache
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Node.js API    │ ← Message Sending & Webhook Processing
│  (Port 3000)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  WhatsApp       │ ← Cloud API
│  Cloud API      │
└─────────────────┘
```

### Services Breakdown
1. **Webhook Receiver** - Fast webhook endpoint (< 10ms response)
2. **Campaign Processor** - Message queue consumer with rate limiting
3. **Bot Reply Matcher** - Fast pattern matching engine
4. **Database Sync Service** - Updates MySQL with message status
5. **Health Monitor** - System health & metrics

---

## Phase 1: Project Setup & Foundation

### 1.1 Initialize Node.js Project

**Location**: `/nodeapp/`

**Dependencies**:
```json
{
  "name": "whatsjet-nodejs-service",
  "version": "1.0.0",
  "description": "High-performance WhatsApp message and webhook processing service",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js",
    "test": "jest",
    "lint": "eslint src/"
  },
  "dependencies": {
    "express": "^4.18.2",
    "bullmq": "^4.14.0",
    "ioredis": "^5.3.2",
    "mysql2": "^3.6.5",
    "axios": "^1.6.0",
    "dotenv": "^16.3.1",
    "helmet": "^7.1.0",
    "cors": "^2.8.5",
    "winston": "^3.11.0",
    "express-rate-limit": "^7.1.5",
    "compression": "^1.7.4",
    "morgan": "^1.10.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.2",
    "eslint": "^8.55.0",
    "jest": "^29.7.0"
  }
}
```

**File Structure**:
```
nodeapp/
├── src/
│   ├── index.js                 # Main application entry
│   ├── config/
│   │   ├── database.js          # MySQL connection pool
│   │   ├── redis.js             # Redis connection
│   │   └── whatsapp.js          # WhatsApp API config
│   ├── services/
│   │   ├── webhook-service.js   # Webhook processing
│   │   ├── campaign-service.js  # Campaign message sending
│   │   ├── bot-service.js       # Bot reply matching
│   │   └── sync-service.js      # Database sync
│   ├── queues/
│   │   ├── webhook-queue.js     # Webhook job queue
│   │   └── message-queue.js     # Message sending queue
│   ├── workers/
│   │   ├── webhook-worker.js    # Webhook consumer
│   │   └── campaign-worker.js   # Message sender consumer
│   ├── routes/
│   │   ├── webhook.js           # Webhook endpoints
│   │   ├── campaign.js          # Campaign trigger endpoints
│   │   └── health.js            # Health check
│   ├── middleware/
│   │   ├── auth.js              # API authentication
│   │   ├── validate.js          # Request validation
│   │   └── error-handler.js     # Error handling
│   └── utils/
│       ├── logger.js            # Winston logger setup
│       └── metrics.js           # Performance metrics
├── .env                         # Environment variables
├── .env.example                 # Example env file
├── .gitignore
├── package.json
└── README.md
```

---

## Phase 2: Core Services Implementation

### 2.1 Database Connection Pool

**File**: `src/config/database.js`

```javascript
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

// Create connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'whatsjet',
    waitForConnections: true,
    connectionLimit: 20,        // Max 20 concurrent connections
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

// Test connection
pool.getConnection()
    .then(connection => {
        console.log('✓ MySQL connection pool established');
        connection.release();
    })
    .catch(err => {
        console.error('✗ MySQL connection failed:', err.message);
        process.exit(1);
    });

module.exports = pool;
```

**Purpose**: 
- Reuses connections (no reconnect overhead)
- Handles 20 concurrent queries efficiently
- Auto-reconnects on failure

### 2.2 Redis Connection

**File**: `src/config/redis.js`

```javascript
const Redis = require('ioredis');
const dotenv = require('dotenv');
dotenv.config();

// Create Redis client
const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || null,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false
});

redis.on('connect', () => {
    console.log('✓ Redis connected');
});

redis.on('error', (err) => {
    console.error('✗ Redis error:', err.message);
});

module.exports = redis;
```

**Purpose**:
- BullMQ queue backend
- Caching layer
- Rate limiting store

### 2.3 WhatsApp API Configuration

**File**: `src/config/whatsapp.js`

```javascript
const axios = require('axios');

class WhatsAppAPI {
    constructor(phoneNumberId, accessToken) {
        this.phoneNumberId = phoneNumberId;
        this.accessToken = accessToken;
        this.baseURL = 'https://graph.facebook.com/v18.0';
    }

    async sendTemplateMessage(to, templateName, language, components) {
        try {
            const response = await axios.post(
                `${this.baseURL}/${this.phoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    to: to,
                    type: 'template',
                    template: {
                        name: templateName,
                        language: { code: language },
                        components: components
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000  // 10 second timeout
                }
            );
            
            return {
                success: true,
                wamid: response.data.messages[0].id,
                data: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data || error.message
            };
        }
    }
}

module.exports = WhatsAppAPI;
```

### 2.4 Logger Setup

**File**: `src/utils/logger.js`

```javascript
const winston = require('winston');
const path = require('path');

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'whatsjet-nodejs' },
    transports: [
        // Write to file
        new winston.transports.File({ 
            filename: path.join(__dirname, '../../logs/error.log'), 
            level: 'error' 
        }),
        new winston.transports.File({ 
            filename: path.join(__dirname, '../../logs/combined.log') 
        }),
        // Write to console
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

module.exports = logger;
```

---

## Phase 3: Webhook Processing System

### 3.1 Webhook Queue Setup

**File**: `src/queues/webhook-queue.js`

```javascript
const { Queue } = require('bullmq');
const redis = require('../config/redis');
const logger = require('../utils/logger');

const webhookQueue = new Queue('whatsapp-webhooks', {
    connection: redis,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000
        },
        removeOnComplete: {
            count: 100,  // Keep last 100 completed jobs
            age: 3600    // Remove after 1 hour
        },
        removeOnFail: {
            age: 86400   // Keep failed jobs for 24 hours
        }
    }
});

webhookQueue.on('error', (err) => {
    logger.error('Webhook queue error:', err);
});

module.exports = webhookQueue;
```

### 3.2 Webhook Receiver Endpoint

**File**: `src/routes/webhook.js`

```javascript
const express = require('express');
const router = express.Router();
const webhookQueue = require('../queues/webhook-queue');
const logger = require('../utils/logger');

// Webhook verification (GET request from WhatsApp)
router.get('/:vendorUid', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // Verify token matches
    if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
        logger.info('Webhook verified for vendor:', req.params.vendorUid);
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

// Webhook receiver (POST request from WhatsApp)
router.post('/:vendorUid', async (req, res) => {
    const vendorUid = req.params.vendorUid;
    const payload = req.body;

    // CRITICAL: Return 200 immediately (< 5ms)
    res.status(200).send('OK');

    try {
        // Determine priority
        const field = payload.entry?.[0]?.changes?.[0]?.field;
        const priority = field === 'messages' ? 1 : 2;  // Messages are high priority

        // Queue for background processing
        await webhookQueue.add('process-webhook', {
            vendorUid: vendorUid,
            payload: payload,
            receivedAt: Date.now()
        }, {
            priority: priority
        });

        logger.info(`Webhook queued for vendor ${vendorUid}`, {
            field: field,
            priority: priority
        });
    } catch (error) {
        logger.error('Failed to queue webhook:', error);
    }
});

module.exports = router;
```

**Key Features**:
- Returns 200 in < 5ms
- Queues webhook for async processing
- Prioritizes message webhooks over status updates

### 3.3 Webhook Worker

**File**: `src/workers/webhook-worker.js`

```javascript
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
```

### 3.4 Webhook Service

**File**: `src/services/webhook-service.js`

```javascript
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
```

---

## Phase 4: Campaign Message Processing

### 4.1 Message Queue Setup

**File**: `src/queues/message-queue.js`

```javascript
const { Queue } = require('bullmq');
const redis = require('../config/redis');

const messageQueue = new Queue('campaign-messages', {
    connection: redis,
    defaultJobOptions: {
        attempts: 5,
        backoff: {
            type: 'exponential',
            delay: 5000
        },
        removeOnComplete: {
            count: 500,
            age: 7200  // 2 hours
        },
        removeOnFail: {
            age: 86400  // 24 hours
        }
    }
});

module.exports = messageQueue;
```

### 4.2 Campaign Worker

**File**: `src/workers/campaign-worker.js`

```javascript
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
                `UPDATE whatsapp_message_queue 
                 SET status = 4, updated_at = NOW()
                 WHERE _uid = ?`,
                [queueUid]
            );

            // Create message log
            await db.execute(
                `INSERT INTO whatsapp_message_logs 
                 (wamid, vendors__id, phone_number_id, message_status, created_at, updated_at)
                 VALUES (?, ?, ?, 'sent', NOW(), NOW())`,
                [result.wamid, vendorId, phoneNumberId]
            );

            logger.info(`Message sent: ${queueUid} -> ${result.wamid}`);
            return { success: true, wamid: result.wamid };
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        logger.error(`Message send failed for ${queueUid}:`, error.message);
        
        // Update queue with error
        await db.execute(
            `UPDATE whatsapp_message_queue 
             SET status = 2, retries = retries + 1, updated_at = NOW()
             WHERE _uid = ?`,
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
```

### 4.3 Campaign Service

**File**: `src/services/campaign-service.js`

```javascript
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
            "SELECT configuration_value FROM vendor_settings 
             WHERE vendors__id = ? AND name = 'current_phone_number_id'",
            [vendorId]
        );

        if (rows.length === 0) throw new Error('Phone number ID not found');

        const value = rows[0].configuration_value;
        await this.redis.setex(`vendor:${vendorId}:phone_number_id`, 3600, value);
        return value;
    }

    async getVendorAccessToken(vendorId) {
        const [rows] = await this.db.execute(
            "SELECT configuration_value FROM vendor_settings 
             WHERE vendors__id = ? AND name = 'whatsapp_access_token'",
            [vendorId]
        );

        if (rows.length === 0) throw new Error('Access token not found');
        return rows[0].configuration_value;
    }
}

module.exports = CampaignService;
```

### 4.4 Campaign Trigger Endpoint

**File**: `src/routes/campaign.js`

```javascript
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const redis = require('../config/redis');
const CampaignService = require('../services/campaign-service');
const logger = require('../utils/logger');

// Trigger campaign processing (called by PHP or cron)
router.post('/process', async (req, res) => {
    try {
        const campaignService = new CampaignService(db, redis);
        const result = await campaignService.processCampaignSchedule();
        
        res.json({
            success: true,
            processed: result.processed
        });
    } catch (error) {
        logger.error('Campaign trigger error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
```

---

## Phase 5: Bot Reply System

### 5.1 Bot Service

**File**: `src/services/bot-service.js`

```javascript
const logger = require('../utils/logger');
const WhatsAppAPI = require('../config/whatsapp');

class BotService {
    constructor(db, redis) {
        this.db = db;
        this.redis = redis;
    }

    async checkAndReply(vendorId, contactId, waId, messageBody, phoneNumberId) {
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
                await this.sendBotReply(vendorId, contactId, waId, matchedBot, phoneNumberId);
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
            __data: JSON.parse(row.__data),
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
                        const regex = new RegExp(`\\b${trigger}\\b`, 'i');
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

    async sendBotReply(vendorId, contactId, waId, bot, phoneNumberId) {
        try {
            // Get WhatsApp credentials
            const accessToken = await this.getVendorAccessToken(vendorId);
            const whatsapp = new WhatsAppAPI(phoneNumberId, accessToken);

            // Replace dynamic values in reply text
            const replyText = await this.replaceDynamicValues(bot.reply_text, contactId);

            // Send message
            const result = await whatsapp.sendTemplateMessage(
                waId,
                'text',
                'en',
                [{ type: 'text', text: replyText }]
            );

            if (result.success) {
                // Log bot reply
                await this.db.execute(
                    `INSERT INTO whatsapp_message_logs 
                     (wamid, vendors__id, contacts__id, message, bot_replies__id, is_incoming_message, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, 0, NOW(), NOW())`,
                    [result.wamid, vendorId, contactId, replyText, bot._id]
                );

                logger.info(`Bot reply sent: ${result.wamid}`);
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
            .replace('{{first_name}}', contact.first_name || '')
            .replace('{{last_name}}', contact.last_name || '')
            .replace('{{email}}', contact.email || '')
            .replace('{{phone}}', contact.phone_number || '');
    }

    async getVendorAccessToken(vendorId) {
        const [rows] = await this.db.execute(
            "SELECT configuration_value FROM vendor_settings 
             WHERE vendors__id = ? AND name = 'whatsapp_access_token'",
            [vendorId]
        );

        return rows[0]?.configuration_value;
    }
}

module.exports = BotService;
```

---

## Phase 6: Main Application

### 6.1 Main Server

**File**: `src/index.js`

```javascript
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());  // Security headers
app.use(cors());    // Enable CORS
app.use(compression());  // Gzip compression
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));  // Request logging

// Routes
const webhookRoutes = require('./routes/webhook');
const campaignRoutes = require('./routes/campaign');
const healthRoutes = require('./routes/health');

app.use('/webhook', webhookRoutes);
app.use('/campaign', campaignRoutes);
app.use('/health', healthRoutes);

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        error: err.message
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════╗
    ║  WhatsJet Node.js Service Started    ║
    ║  Port: ${PORT}                        ║
    ║  Environment: ${process.env.NODE_ENV || 'development'} ║
    ╚═══════════════════════════════════════╝
    `);
});

// Start workers
require('./workers/webhook-worker');
require('./workers/campaign-worker');

console.log('✓ Workers started');

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    process.exit(0);
});
```

### 6.2 Health Check

**File**: `src/routes/health.js`

```javascript
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const redis = require('../config/redis');

router.get('/', async (req, res) => {
    try {
        // Check database
        await db.execute('SELECT 1');
        
        // Check Redis
        await redis.ping();

        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            services: {
                database: 'up',
                redis: 'up'
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message
        });
    }
});

module.exports = router;
```

### 6.3 Environment Variables

**File**: `.env.example`

```env
# Node Environment
NODE_ENV=production
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_DATABASE=whatsjet

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# WhatsApp
WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token

# Logging
LOG_LEVEL=info
```

---

## Phase 7: PHP Integration

### 7.1 Update PHP to Call Node.js

**File**: `Source/app/Services/NodeJsService.php` (New)

```php
<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class NodeJsService
{
    protected $baseUrl;

    public function __construct()
    {
        $this->baseUrl = config('services.nodejs.url', 'http://localhost:3000');
    }

    /**
     * Trigger campaign processing in Node.js
     */
    public function processCampaign()
    {
        try {
            $response = Http::timeout(5)->post("{$this->baseUrl}/campaign/process");
            return $response->successful();
        } catch (\Exception $e) {
            \Log::error('Node.js campaign trigger failed: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Check Node.js service health
     */
    public function healthCheck()
    {
        try {
            $response = Http::timeout(2)->get("{$this->baseUrl}/health");
            return $response->successful();
        } catch (\Exception $e) {
            return false;
        }
    }
}
```

### 7.2 Update Cron Job

**File**: `Source/app/Console/Commands/ProcessWhatsappCampaign.php`

```php
<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\NodeJsService;

class ProcessWhatsappCampaign extends Command
{
    protected $signature = 'whatsapp:campaign:process';
    protected $description = 'Trigger Node.js to process campaign messages';

    public function handle()
    {
        $nodeJs = new NodeJsService();
        
        if ($nodeJs->processCampaign()) {
            $this->info('Campaign processing triggered in Node.js');
        } else {
            $this->error('Failed to trigger Node.js campaign processing');
        }
    }
}
```

### 7.3 Update Webhook Route

**File**: `Source/routes/api.php`

Add redirect to Node.js:

```php
// Redirect WhatsApp webhooks to Node.js service
Route::any('/whatsapp/webhook/{vendorUid}', function ($vendorUid, Request $request) {
    $nodeJsUrl = config('services.nodejs.url', 'http://localhost:3000');
    
    if ($request->isMethod('GET')) {
        // Verification request
        return Http::get("{$nodeJsUrl}/webhook/{$vendorUid}", $request->all());
    } else {
        // POST webhook - forward to Node.js
        Http::post("{$nodeJsUrl}/webhook/{$vendorUid}", $request->all());
        return response('OK', 200);
    }
});
```

---

## Phase 8: Deployment & Testing

### 8.1 PM2 Configuration

**File**: `ecosystem.config.js`

```javascript
module.exports = {
    apps: [{
        name: 'whatsjet-nodejs',
        script: './src/index.js',
        instances: 2,  // Run 2 instances for load balancing
        exec_mode: 'cluster',
        env: {
            NODE_ENV: 'production',
            PORT: 3000
        },
        error_file: './logs/pm2-error.log',
        out_file: './logs/pm2-out.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        merge_logs: true,
        autorestart: true,
        watch: false,
        max_memory_restart: '500M'
    }]
};
```

### 8.2 Installation Script

**File**: `install.sh`

```bash
#!/bin/bash

echo "Installing WhatsJet Node.js Service..."

# Navigate to nodeapp directory
cd nodeapp

# Install dependencies
echo "Installing dependencies..."
npm install

# Create logs directory
mkdir -p logs

# Copy environment file
if [ ! -f .env ]; then
    cp .env.example .env
    echo "Created .env file. Please configure it before starting."
fi

# Install PM2 globally
echo "Installing PM2..."
npm install -g pm2

echo "Installation complete!"
echo "Next steps:"
echo "1. Configure .env file"
echo "2. Start service: pm2 start ecosystem.config.js"
echo "3. Monitor: pm2 monit"
```

### 8.3 Start/Stop Scripts

**File**: `start.sh`

```bash
#!/bin/bash
cd nodeapp
pm2 start ecosystem.config.js
pm2 save
```

**File**: `stop.sh`

```bash
#!/bin/bash
pm2 stop whatsjet-nodejs
```

---

## Testing Checklist

### Unit Tests
- [ ] Webhook queue functionality
- [ ] Message sending logic
- [ ] Bot pattern matching
- [ ] Database connections
- [ ] Redis caching

### Integration Tests
- [ ] WhatsApp webhook verification
- [ ] Message status updates
- [ ] Campaign message sending
- [ ] Bot auto-reply
- [ ] PHP to Node.js communication

### Load Tests
- [ ] 1000 webhooks/second
- [ ] 100 messages/second
- [ ] Concurrent bot replies
- [ ] Database connection pool
- [ ] Memory usage under load

### Performance Benchmarks
- [ ] Webhook response time < 10ms
- [ ] Message send rate: 20-50/sec
- [ ] Bot reply latency < 100ms
- [ ] CPU usage < 40% (vs 100%)
- [ ] Memory usage < 2GB

---

## Monitoring Setup

### Metrics to Track
```javascript
// src/utils/metrics.js
const prometheus = require('prom-client');

const webhookCounter = new prometheus.Counter({
    name: 'webhooks_total',
    help: 'Total webhooks received'
});

const messageCounter = new prometheus.Counter({
    name: 'messages_sent_total',
    help: 'Total messages sent'
});

const webhookDuration = new prometheus.Histogram({
    name: 'webhook_processing_duration',
    help: 'Webhook processing time'
});

module.exports = {
    webhookCounter,
    messageCounter,
    webhookDuration
};
```

---

## Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Phase 1 | Day 1 | Project setup, dependencies installed |
| Phase 2 | Day 2 | Database & Redis connections working |
| Phase 3 | Day 3-4 | Webhook system fully functional |
| Phase 4 | Day 5-6 | Campaign processing working |
| Phase 5 | Day 7 | Bot reply system implemented |
| Phase 6 | Day 8 | Main app & health checks |
| Phase 7 | Day 9 | PHP integration complete |
| Phase 8 | Day 10-12 | Testing & deployment |
| **Total** | **12 days** | **Production ready** |

---

## Success Criteria

✅ **Performance**:
- Webhook response < 10ms
- CPU usage < 40% under load
- Handle 1000 message campaigns smoothly
- Bot reply CPU spike < 20%

✅ **Reliability**:
- Zero message loss
- Automatic retry on failures
- Graceful error handling
- 99.9% uptime

✅ **Scalability**:
- Horizontal scaling ready
- Support 10,000+ campaigns/day
- Handle 100,000+ webhooks/day

---

## Next Steps

1. ✅ **Review this implementation plan**
2. 🔄 **Start Phase 1: Setup Node.js project**
3. ⏳ Continue with subsequent phases

---

**Document Version**: 1.0
**Last Updated**: October 3, 2025
**Status**: Ready to implement
