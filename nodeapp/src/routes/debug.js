const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const Redis = require('ioredis');
const BotService = require('../services/bot-service');

// Initialize services
let db, redis, botService;

(async () => {
    try {
        db = await mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'whatsjet',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        redis = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            maxRetriesPerRequest: 3,
            lazyConnect: false
        });

        botService = new BotService(db, redis);
        console.log('[DEBUG ROUTES] Services initialized');
    } catch (error) {
        console.error('[DEBUG ROUTES] Failed to initialize services:', error);
    }
})();

// GET /debug/bots/:vendorId - List all active bots for a vendor
router.get('/bots/:vendorId', async (req, res) => {
    try {
        const vendorId = parseInt(req.params.vendorId);
        
        if (!botService) {
            return res.status(500).json({ error: 'Bot service not initialized' });
        }

        // Clear cache if requested
        if (req.query.clearCache === 'true') {
            const cacheKey = `bots:${vendorId}`;
            await redis.del(cacheKey);
            console.log(`[DEBUG] Cleared bot cache for vendor ${vendorId}`);
        }

        const bots = await botService.getActiveBots(vendorId);

        res.json({
            vendorId,
            botsCount: bots.length,
            bots: bots.map(bot => ({
                id: bot._id,
                triggerType: bot.trigger_type,
                triggers: bot.triggers,
                replyText: bot.reply_text?.substring(0, 50) + '...',
                priorityIndex: bot.priority_index,
                hasInteractionMessage: !!bot.__data?.interaction_message,
                hasMediaMessage: !!bot.__data?.media_message,
                hasTemplateMessage: !!bot.__data?.template_message
            }))
        });
    } catch (error) {
        console.error('[DEBUG] Error fetching bots:', error);
        res.status(500).json({ 
            error: error.message,
            stack: error.stack
        });
    }
});

// GET /debug/test-match/:vendorId - Test bot matching for a message
router.get('/test-match/:vendorId', async (req, res) => {
    try {
        const vendorId = parseInt(req.params.vendorId);
        const message = req.query.message || '';
        
        if (!botService) {
            return res.status(500).json({ error: 'Bot service not initialized' });
        }

        if (!message) {
            return res.status(400).json({ error: 'message query parameter required' });
        }

        const bots = await botService.getActiveBots(vendorId);
        const messageBody = message.toLowerCase();

        const matches = [];
        for (const bot of bots) {
            for (const trigger of bot.triggers) {
                let matched = false;
                
                if (bot.trigger_type === 'is') {
                    matched = messageBody === trigger;
                } else if (bot.trigger_type === 'starts_with') {
                    matched = messageBody.startsWith(trigger);
                } else if (bot.trigger_type === 'ends_with') {
                    matched = messageBody.endsWith(trigger);
                } else if (bot.trigger_type === 'contains') {
                    matched = messageBody.includes(trigger);
                } else if (bot.trigger_type === 'contains_word') {
                    const regex = new RegExp(`\\b${trigger}\\b`, 'i');
                    matched = regex.test(messageBody);
                }

                if (matched) {
                    matches.push({
                        botId: bot._id,
                        trigger: trigger,
                        triggerType: bot.trigger_type,
                        replyText: bot.reply_text?.substring(0, 100)
                    });
                }
            }
        }

        res.json({
            message: message,
            messageBody: messageBody,
            botsChecked: bots.length,
            matches: matches,
            matchedCount: matches.length
        });
    } catch (error) {
        console.error('[DEBUG] Error testing match:', error);
        res.status(500).json({ 
            error: error.message,
            stack: error.stack
        });
    }
});

// GET /debug/cache-clear/:vendorId - Clear bot cache for vendor
router.get('/cache-clear/:vendorId', async (req, res) => {
    try {
        const vendorId = parseInt(req.params.vendorId);
        const cacheKey = `bots:${vendorId}`;
        
        const result = await redis.del(cacheKey);
        
        res.json({
            success: true,
            vendorId,
            cacheKey,
            deleted: result === 1
        });
    } catch (error) {
        console.error('[DEBUG] Error clearing cache:', error);
        res.status(500).json({ 
            error: error.message
        });
    }
});

module.exports = router;
