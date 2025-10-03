const express = require('express');
const router = express.Router();
const webhookService = require('../services/webhook-service');
const logger = require('../config/logger');
const crypto = require('crypto');

/**
 * GET /webhook/:vendorUid - Webhook verification
 * WhatsApp sends this to verify the webhook URL
 */
router.get('/:vendorUid', async (req, res) => {
    try {
        const { vendorUid } = req.params;
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];
        
        if (mode && token) {
            // PHP uses sha1($vendorUid) as the verification token
            const expectedToken = crypto.createHash('sha1').update(vendorUid).digest('hex');
            
            if (mode === 'subscribe' && token === expectedToken) {
                logger.info('Webhook verified', { vendorUid });
                return res.status(200).send(challenge);
            } else {
                logger.warn('Webhook verification failed - invalid token', { 
                    vendorUid, 
                    receivedToken: token.substring(0, 10) + '...', 
                    expectedToken: expectedToken.substring(0, 10) + '...' 
                });
                return res.status(403).send('Forbidden');
            }
        } else {
            logger.warn('Webhook verification failed - missing parameters', { vendorUid });
            return res.status(400).send('Bad Request');
        }
    } catch (error) {
        logger.error('Webhook verification error', { error: error.message });
        res.status(500).send('Internal Server Error');
    }
});

/**
 * POST /webhook/:vendorUid - Webhook processing
 * WhatsApp sends incoming messages, status updates, etc. here
 */
router.post('/:vendorUid', async (req, res) => {
    const { vendorUid } = req.params;
    
    try {
        // Return 200 immediately (WhatsApp requires < 15 second response)
        res.status(200).json({ status: 'success' });
        
        // Process webhook asynchronously via queue
        await webhookService.processWebhook(vendorUid, req.body);
    } catch (error) {
        logger.error('Webhook processing error', { 
            error: error.message, 
            vendorUid,
            stack: error.stack 
        });
        // Don't send error to WhatsApp, already sent 200
    }
});

module.exports = router;
