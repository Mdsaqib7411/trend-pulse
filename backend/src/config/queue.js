const { Queue } = require('bullmq');
const redisConnection = require('./redis');

// Create the AI Enrichment Queue
const aiEnrichmentQueue = new Queue('ai-enrichment', {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3, // Retry 3 times if DeepSeek fails
        backoff: {
            type: 'exponential',
            delay: 10000 // 10s, 20s, 40s
        },
        removeOnComplete: true, // Keep Redis clean
        removeOnFail: 100 // Keep last 100 failed jobs for debugging
    }
});

const trendQueue = new Queue('trend-fetching', {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'fixed', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: 100
    }
});

module.exports = {
    aiEnrichmentQueue,
    trendQueue
};
