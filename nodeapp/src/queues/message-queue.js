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
