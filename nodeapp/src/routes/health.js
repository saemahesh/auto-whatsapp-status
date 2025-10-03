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
