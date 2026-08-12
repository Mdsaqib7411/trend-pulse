const { Queue: BullQueue, Worker: BullWorker } = require('bullmq');
const { redisConnection, isRedisAvailable } = require('./redis');
const logger = require('../services/loggerService');

const localProcessors = {};

class CustomQueue {
    constructor(name, opts = {}) {
        this.name = name;
        this.opts = opts;
        
        if (isRedisAvailable()) {
            try {
                this.bullQueue = new BullQueue(name, {
                    connection: redisConnection,
                    ...opts
                });
                logger.info(`[Queue] BullMQ Queue initialized successfully for: ${name}`);
            } catch (err) {
                logger.error(`[Queue] Failed to initialize BullMQ queue ${name}: ${err.message}`);
            }
        } else {
            logger.warn(`[Queue] Redis offline. Initializing in-process fallback queue for: ${name}`);
        }
    }

    /**
     * Fallback-safe method to dynamically retrieve the underlying BullMQ queue if Redis comes online.
     */
    getQueueInstance() {
        if (isRedisAvailable()) {
            if (!this.bullQueue) {
                try {
                    this.bullQueue = new BullQueue(this.name, {
                        connection: redisConnection,
                        ...this.opts
                    });
                    logger.info(`[Queue] Dynamically connected to Redis and created BullMQ queue: ${this.name}`);
                } catch (err) {
                    logger.error(`[Queue] Failed to dynamically create BullMQ queue: ${err.message}`);
                }
            }
            return this.bullQueue;
        }
        return null;
    }

    async add(jobName, data, opts = {}) {
        const bullQueue = this.getQueueInstance();
        if (bullQueue) {
            try {
                return await bullQueue.add(jobName, data, opts);
            } catch (err) {
                logger.error(`[Queue] BullMQ add failed for ${this.name}: ${err.message}. Degrading to in-process execution.`);
            }
        }

        // Degradation Mode: Schedule task execution locally in-process (asynchronously)
        logger.warn(`[Queue Fallback] Redis offline. Scheduling in-process task execution: Queue "${this.name}", Job "${jobName}"`);
        
        setImmediate(async () => {
            const processor = localProcessors[this.name];
            if (processor) {
                try {
                    const mockJob = {
                        id: opts.jobId || `mock-job-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                        name: jobName,
                        data: data,
                        updateProgress: async (progress) => {
                            logger.debug(`[Queue Fallback - MockJob] Progress update for ${jobName}: ${progress}`);
                        }
                    };
                    logger.info(`[Queue Fallback] Processing job "${jobName}" in-process for queue: ${this.name}`);
                    await processor(mockJob);
                    logger.info(`[Queue Fallback] Successfully processed job "${jobName}" in-process.`);
                } catch (err) {
                    logger.error(`[Queue Fallback] Error in-process execution failed for queue ${this.name}: %o`, { error: err.message });
                }
            } else {
                logger.error(`[Queue Fallback] No active worker processor registered locally for queue: ${this.name}. Job "${jobName}" was skipped.`);
            }
        });

        return { id: opts.jobId || `mock-job-id-${Date.now()}` };
    }

    async getJobCounts() {
        const bullQueue = this.getQueueInstance();
        if (bullQueue) {
            try {
                return await bullQueue.getJobCounts();
            } catch (err) {
                logger.error(`[Queue] Failed to get job counts from BullMQ for ${this.name}: ${err.message}`);
            }
        }
        return {
            active: 0,
            completed: 0,
            failed: 0,
            delayed: 0,
            waiting: 0,
            paused: 0
        };
    }
}

class CustomWorker {
    constructor(name, processor, opts = {}) {
        this.name = name;
        this.processor = processor;
        
        // Register locally for in-process fallback
        localProcessors[name] = processor;

        if (isRedisAvailable()) {
            try {
                this.bullWorker = new BullWorker(name, processor, {
                    connection: redisConnection,
                    ...opts
                });
                logger.info(`[Worker] BullMQ Worker registered successfully for queue: ${name}`);
            } catch (err) {
                logger.error(`[Worker] Failed to register BullMQ Worker for ${name}: ${err.message}`);
            }
        } else {
            logger.warn(`[Worker] Redis offline. Registered local in-process processor for queue: ${name}`);
        }
    }

    on(event, handler) {
        if (this.bullWorker) {
            this.bullWorker.on(event, handler);
        }
        logger.debug(`[Worker] Event listener registered for '${event}' on queue: ${this.name}`);
    }
}

// Instantiate queues
const aiEnrichmentQueue = new CustomQueue('ai-enrichment', {
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 10000
        },
        removeOnComplete: true,
        removeOnFail: 100
    }
});

const trendQueue = new CustomQueue('trend-fetching', {
    defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'fixed', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: 100
    }
});

module.exports = {
    Queue: CustomQueue,
    Worker: CustomWorker,
    aiEnrichmentQueue,
    trendQueue
};

