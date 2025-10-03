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
