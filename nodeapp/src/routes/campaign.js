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
