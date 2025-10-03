const express = require('express');
const router = express.Router();
const db = require('../config/database');
const redis = require('../config/redis');

router.get('/', async (req, res) => {
    console.log('[HEALTH] Health check request received');
    
    try {
        // Check database
        await db.execute('SELECT 1');
        console.log('[HEALTH] ✓ Database OK');
        
        // Check Redis
        await redis.ping();
        console.log('[HEALTH] ✓ Redis OK');

        const response = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            services: {
                database: 'up',
                redis: 'up'
            }
        };
        console.log('[HEALTH] ✓ All services healthy');
        res.json(response);
    } catch (error) {
        console.error('[HEALTH] ✗ Health check failed:', error);
        res.status(500).json({
            status: 'unhealthy',
            error: error.message
        });
    }
});

module.exports = router;
