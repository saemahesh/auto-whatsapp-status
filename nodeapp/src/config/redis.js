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
