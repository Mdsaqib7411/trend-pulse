const cron = require('node-cron');
const Trend = require('../models/Trend');
const User = require('../models/User');
const trendPredictionEngine = require('../services/trendPredictionEngine');
const predictionValidationWorker = require('../services/predictionValidationWorker');
const recommendationEngine = require('../services/recommendationEngine');
const alertService = require('../services/alertService');
const logger = require('../services/loggerService');

// Safe execution guards to prevent overlapping cron runs
const runningJobs = {
    spikeScan: false,
    recoRefresh: false,
    predictionReeval: false,
    intelligentPush: false,
    predictionValidation: false  // Phase 4B: accuracy validation worker
};

// ─── 1. Trend Spike Scans ──────────────────────────────────────────────────────
// Scans for dynamic surges/velocity shifts in local & regional trends every 10 mins
cron.schedule('*/10 * * * *', async () => {
    if (runningJobs.spikeScan) {
        logger.warn('[Scheduler] Trend Spike Scan skipped: previous run still active.');
        return;
    }
    runningJobs.spikeScan = true;
    logger.info('[Scheduler] Starting Trend Spike Scan job...');

    try {
        const activeTrends = await Trend.find({ trendScore: { $gt: 20 } })
            .sort({ trendScore: -1 })
            .limit(30)
            .lean();

        if (activeTrends.length > 0) {
            await alertService.processAlerts(activeTrends);
            logger.info(`[Scheduler] Spike Scan complete: analyzed ${activeTrends.length} trends.`);
        } else {
            logger.info('[Scheduler] Spike Scan complete: no active trends found.');
        }
    } catch (error) {
        logger.error('[Scheduler] Trend Spike Scan job failed: %s', error.message);
    } finally {
        runningJobs.spikeScan = false;
    }
});

// ─── 2. Recommendation Cache Refresh ──────────────────────────────────────────
// Pre-calculates and caches global/top recommendation feeds every 30 mins
cron.schedule('*/30 * * * *', async () => {
    if (runningJobs.recoRefresh) {
        logger.warn('[Scheduler] Recommendation Refresh skipped: previous run still active.');
        return;
    }
    runningJobs.recoRefresh = true;
    logger.info('[Scheduler] Starting Recommendation Cache Refresh job...');

    try {
        const topFeed = await recommendationEngine.getGlobalTopFeed(30);
        logger.info(`[Scheduler] Recommendation cache refreshed with ${topFeed.length} core trends.`);
    } catch (error) {
        logger.error('[Scheduler] Recommendation Refresh job failed: %s', error.message);
    } finally {
        runningJobs.recoRefresh = false;
    }
});

// ─── 3. Prediction Reevaluation ──────────────────────────────────────────────
// Re-evaluates lifecycle states and propagation indices for active trends every hour
cron.schedule('0 * * * *', async () => {
    if (runningJobs.predictionReeval) {
        logger.warn('[Scheduler] Prediction Reevaluation skipped: previous run still active.');
        return;
    }
    runningJobs.predictionReeval = true;
    logger.info('[Scheduler] Starting Prediction Reevaluation job...');

    try {
        const trends = await Trend.find({ trendScore: { $gt: 30 } })
            .sort({ trendScore: -1 })
            .limit(50)
            .select('trendId')
            .lean();

        if (trends.length > 0) {
            const count = await trendPredictionEngine.predictBatch(trends);
            logger.info(`[Scheduler] Prediction reevaluation complete: ${count}/${trends.length} updated.`);
        } else {
            logger.info('[Scheduler] Prediction reevaluation complete: no high-score trends found.');
        }
    } catch (error) {
        logger.error('[Scheduler] Prediction Reevaluation job failed: %s', error.message);
    } finally {
        runningJobs.predictionReeval = false;
    }
});

// ─── 4. Intelligent Push Triggers ──────────────────────────────────────────────
// Checks for highly viral trends and delivers push notifications to subscribed tokens every 15 mins
cron.schedule('*/15 * * * *', async () => {
    if (runningJobs.intelligentPush) {
        logger.warn('[Scheduler] Intelligent Push Triggers skipped: previous run still active.');
        return;
    }
    runningJobs.intelligentPush = true;
    logger.info('[Scheduler] Starting Intelligent Push Triggers job...');

    try {
        // Find top viral trend that hasn't decayed
        const viralTrend = await Trend.findOne({ 
            trendScore: { $gt: 85 } 
        })
        .sort({ trendScore: -1 })
        .lean();

        if (viralTrend) {
            const predictedState = await trendPredictionEngine.predictForTrend(viralTrend.trendId);
            
            // Only trigger pushes for highly confident, emerging/viral lifecycle spikes
            if (predictedState && (predictedState.lifecycleState === 'viral' || predictedState.lifecycleState === 'accelerating')) {
                logger.info(`[Scheduler] High-signal trend identified: "${viralTrend.title}" (${predictedState.lifecycleState}). Dispaching pushes...`);
                await alertService.triggerPushNotification(viralTrend, {
                    growthMomentum: predictedState.lifecycleState,
                    confidenceScore: Math.round(predictedState.confidenceScore * 100)
                });
            } else {
                logger.info(`[Scheduler] Top trend "${viralTrend.title}" is in a ${predictedState?.lifecycleState || 'normal'} phase. Skipping push.`);
            }
        } else {
            logger.info('[Scheduler] No top viral trends exceeding threshold (85). Push skipped.');
        }
    } catch (error) {
        logger.error('[Scheduler] Intelligent Push Triggers job failed: %s', error.message);
    } finally {
        runningJobs.intelligentPush = false;
    }
});

// ─── 5. Prediction Accuracy Validation ────────────────────────────────────────
// Evaluates historical predictions at 24h, 72h, and 7d windows.
// Runs every 15 minutes. Offset by 7 minutes (7,22,37,52) to avoid
// contention with the push notification job (0,15,30,45).
cron.schedule('7,22,37,52 * * * *', async () => {
    if (runningJobs.predictionValidation) {
        logger.warn('[Scheduler] Prediction Validation skipped: previous run still active.');
        return;
    }
    runningJobs.predictionValidation = true;
    logger.info('[Scheduler] Starting Prediction Validation Worker...');

    try {
        const results = await predictionValidationWorker.run();
        const total = results.processed24h + results.processed72h + results.processed7d;
        if (total > 0) {
            logger.info(
                '[Scheduler] Prediction Validation complete — 24h:%d 72h:%d 7d:%d',
                results.processed24h, results.processed72h, results.processed7d
            );
        } else {
            logger.debug('[Scheduler] Prediction Validation: no pending records found.');
        }
    } catch (error) {
        logger.error('[Scheduler] Prediction Validation job failed: %s', error.message);
    } finally {
        runningJobs.predictionValidation = false;
    }
});

logger.info('[Scheduler] Modular Intelligence Automation scheduler initialized.');
