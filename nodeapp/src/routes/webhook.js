const express = require('express');
const router = express.Router();
const WebhookService = require('../services/webhook-service');
const logger = require('../utils/logger');
const crypto = require('crypto');
const db = require('../config/database');
const redis = require('../config/redis');
const { Queue } = require('bullmq');

console.log('[WEBHOOK ROUTE] Webhook routes module loaded');
console.log('[WEBHOOK ROUTE] Initializing webhook queue...');

// Initialize webhook queue for async processing
const webhookQueue = new Queue('whatsapp-webhooks', { connection: redis });
console.log('[WEBHOOK ROUTE] ✓ Webhook queue initialized');

/**
 * GET /webhook/:vendorUid - Webhook verification
 * WhatsApp sends this to verify the webhook URL
 */
router.get('/:vendorUid', async (req, res) => {
    console.log('========================================');
    console.log('[WEBHOOK GET] Received verification request');
    console.log('[WEBHOOK GET] vendorUid:', req.params.vendorUid);
    console.log('[WEBHOOK GET] Query params:', JSON.stringify(req.query));
    
    try {
        const { vendorUid } = req.params;
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];
        
        console.log('[WEBHOOK GET] Mode:', mode);
        console.log('[WEBHOOK GET] Challenge:', challenge);
        console.log('[WEBHOOK GET] Token (first 20 chars):', token ? token.substring(0, 20) : 'undefined');
        
        if (mode && token) {
            // PHP uses sha1($vendorUid) as the verification token
            const expectedToken = crypto.createHash('sha1').update(vendorUid).digest('hex');
            console.log('[WEBHOOK GET] Expected token (first 20 chars):', expectedToken.substring(0, 20));
            
            if (mode === 'subscribe' && token === expectedToken) {
                console.log('[WEBHOOK GET] ✓ Verification successful! Sending challenge back.');
                logger.info('Webhook verified', { vendorUid });
                return res.status(200).send(challenge);
            } else {
                console.log('[WEBHOOK GET] ✗ Verification failed - token mismatch');
                console.log('[WEBHOOK GET] Mode matches:', mode === 'subscribe');
                console.log('[WEBHOOK GET] Token matches:', token === expectedToken);
                logger.warn('Webhook verification failed - invalid token', { 
                    vendorUid, 
                    receivedToken: token.substring(0, 10) + '...', 
                    expectedToken: expectedToken.substring(0, 10) + '...' 
                });
                return res.status(403).send('Forbidden');
            }
        } else {
            console.log('[WEBHOOK GET] ✗ Missing required parameters');
            console.log('[WEBHOOK GET] Has mode:', !!mode);
            console.log('[WEBHOOK GET] Has token:', !!token);
            logger.warn('Webhook verification failed - missing parameters', { vendorUid });
            return res.status(400).send('Bad Request');
        }
    } catch (error) {
        console.error('[WEBHOOK GET] ✗ Exception occurred:', error.message);
        console.error('[WEBHOOK GET] Stack trace:', error.stack);
        logger.error('Webhook verification error', { error: error.message });
        res.status(500).send('Internal Server Error');
    } finally {
        console.log('========================================');
    }
});

/**
 * POST /webhook/:vendorUid - Webhook processing
 * WhatsApp sends incoming messages, status updates, etc. here
 */
router.post('/:vendorUid', async (req, res) => {
    console.log('========================================');
    console.log('[WEBHOOK POST] Received webhook data');
    console.log('[WEBHOOK POST] vendorUid:', req.params.vendorUid);
    // console.log('[WEBHOOK POST] Payload:', JSON.stringify(req.body, null, 2));
    
    const { vendorUid } = req.params;
    
    try {
        console.log('[WEBHOOK POST] Sending 200 OK response immediately...');
        // Return 200 immediately (WhatsApp requires < 15 second response)
        res.status(200).json({ status: 'success' });
        console.log('[WEBHOOK POST] ✓ Response sent to WhatsApp');
        
        console.log('[WEBHOOK POST] Adding webhook to queue for async processing...');
        // Add to queue for async processing by worker
        const job = await webhookQueue.add('process-webhook', {
            vendorUid,
            payload: req.body,
            receivedAt: Date.now()
        });
        console.log('[WEBHOOK POST] ✓ Webhook queued with job ID:', job.id);
    } catch (error) {
        console.error('[WEBHOOK POST] ✗ Error processing webhook:', error.message);
        console.error('[WEBHOOK POST] Stack trace:', error.stack);
        logger.error('Webhook processing error', { 
            error: error.message, 
            vendorUid,
            stack: error.stack 
        });
        // Don't send error to WhatsApp, already sent 200
    } finally {
        console.log('========================================');
    }
});

console.log('[WEBHOOK ROUTE] Webhook routes registered (GET and POST)');

module.exports = router;


