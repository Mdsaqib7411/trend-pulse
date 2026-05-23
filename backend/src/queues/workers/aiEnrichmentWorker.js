/**
 * AI Enrichment Worker — Isolated BullMQ worker for LLM token operations.
 * 
 * Responsibilities:
 *   - Process the ai-enrichment queue (separate from trend-fetching).
 *   - Set aiStatus: "processing" with structural skeleton immediately.
 *   - Inject scoring deltas from trendScoreEngine into the LLM prompt context.
 *   - Map: AI Summary, Why Trending, Sentiment, Target Audience.
 *   - Emit WebSocket event on completion for live mobile UI patching.
 *   - Compute AI Confidence sub-object (Task 7).
 */

const { Worker } = require('bullmq');
const redisConnection = require('../../config/redis');
const Trend = require('../../models/Trend');
const aiAnalyticsService = require('../../services/aiAnalyticsService');
const geoTrendEngine = require('../../services/geoTrendEngine');
const socketService = require('../../services/socketService');
const alertService = require('../../services/alertService');
const logger = require('../../services/loggerService');

console.log('[Worker] Initializing Shahkal AI Enrichment Worker...');

const aiWorker = new Worker('ai-enrichment', async (job) => {
    const { trendId } = job.data;
    logger.info(`[AIWorker] Processing Job ${job.id} for Trend: ${trendId}`);

    // 1. Fetch trend from DB
    const trend = await Trend.findOne({ trendId });
    if (!trend) {
        throw new Error(`Trend ${trendId} not found in DB`);
    }

    // Skip if already processed successfully
    if (trend.analysis && trend.analysis.status === 'completed') {
        return { status: 'skipped', reason: 'already processed' };
    }

    // 2. Set aiStatus: "processing" with explicit structural skeleton
    trend.analysis = {
        ...trend.analysis?.toObject?.() || {},
        status: 'processing',
        summary: 'Shahkal AI is analyzing this trend...',
        whyTrending: 'Computing acceleration metrics...',
        sentiment: 'neutral',
        sentimentScore: 50,
        targetAudience: 'Calculating...',
        prediction: 'stable',
        viralityScore: 0,
        growthMomentum: 'moderate',
        alertType: 'none',
        confidenceScore: 0,
        keywords: []
    };
    await trend.save();

    try {
        // 3. Build scoring context from trendScoreEngine metrics
        const scoringContext = trend.scoring ? {
            viralScore: trend.scoring.viralScore || 0,
            heatScore: trend.scoring.heatScore || 0,
            growthScore: trend.scoring.growthScore || 0,
            compositeScore: trend.scoring.compositeScore || 0
        } : { viralScore: 0, heatScore: 0, growthScore: 0, compositeScore: 0 };

        // Compute velocity delta from scoreHistory
        let velocityDelta = 0;
        if (trend.scoreHistory && trend.scoreHistory.length >= 2) {
            const latest = trend.scoreHistory[trend.scoreHistory.length - 1].c;
            const previous = trend.scoreHistory[trend.scoreHistory.length - 2].c;
            if (previous > 0) {
                velocityDelta = parseFloat((((latest - previous) / previous) * 100).toFixed(1));
            }
        }

        // 4. Build geo-local context for AI prompt (Layer 3)
        const geoContext = geoTrendEngine.buildLocalContext(trend);

        // 5. Call LLM with enriched prompt context + geo context
        const enrichedData = await aiAnalyticsService.enrichTrendWithContext(trend, scoringContext, velocityDelta, geoContext);

        // 5. Compute AI Confidence sub-object (Task 7)
        const aiConfidence = computeConfidence(trend, enrichedData);

        // 6. Persist enriched analysis to DB
        trend.analysis = {
            ...enrichedData,
            status: 'completed',
            processedAt: new Date()
        };
        trend.aiConfidence = aiConfidence;
        await trend.save();

        logger.info(`[AIWorker] Trend ${trendId} successfully enriched.`);

        // 7. Emit WebSocket event for live UI patching
        socketService.emitAICompleted(trendId, {
            status: 'completed',
            summary: enrichedData.summary,
            whyTrending: enrichedData.whyTrending,
            sentiment: enrichedData.sentiment,
            sentimentScore: enrichedData.sentimentScore,
            targetAudience: enrichedData.targetAudience,
            viralityScore: enrichedData.viralityScore,
            confidenceScore: enrichedData.confidenceScore,
            aiConfidence
        });

        // 8. Trigger Smart Alerts for viral spikes
        if (enrichedData.viralityScore > 8 || enrichedData.growthMomentum === 'rapid' || velocityDelta > 50) {
            logger.info(`[AIWorker] Viral spike detected for ${trendId} (velocity: ${velocityDelta}%)`);
            await alertService.triggerPushNotification(trend, enrichedData);
        }

        return { status: 'success', data: enrichedData };

    } catch (error) {
        logger.error(`[AIWorker] Failed for ${trendId}: ${error.message}`);
        
        trend.analysis.status = 'failed';
        await trend.save();
        
        // Throwing error causes BullMQ to auto-retry based on backoff config
        throw error;
    }
}, {
    connection: redisConnection,
    concurrency: 3
});

/**
 * Task 7: Compute AI Confidence based on source structural metadata consistency.
 * Isolated within a sub-object to avoid blowing past token allocation.
 */
function computeConfidence(trend, enrichedData) {
    let sourceConsistency = 50; // Base
    let dataCompleteness = 0;

    // Source consistency: higher if trend has URL, image, and content
    if (trend.sourceUrl) sourceConsistency += 15;
    if (trend.image && !trend.image.includes('unsplash.com')) sourceConsistency += 15; // Non-placeholder image
    if (trend.content && trend.content.length > 100) sourceConsistency += 10;
    if (trend.type === 'reddit' && trend.engagementScore > 100) sourceConsistency += 10;
    sourceConsistency = Math.min(100, sourceConsistency);

    // Data completeness: check how many fields the LLM successfully filled
    const fields = ['summary', 'whyTrending', 'sentiment', 'targetAudience', 'prediction', 'keywords'];
    let filledCount = 0;
    for (const field of fields) {
        if (enrichedData[field] && enrichedData[field] !== '' && enrichedData[field] !== 'N/A') {
            filledCount++;
        }
    }
    dataCompleteness = Math.round((filledCount / fields.length) * 100);

    // Final confidence score: weighted average
    const score = Math.round((sourceConsistency * 0.4) + (dataCompleteness * 0.4) + ((enrichedData.confidenceScore || 50) * 0.2));

    return {
        score: Math.min(100, score),
        sourceConsistency,
        dataCompleteness,
        evaluatedAt: new Date()
    };
}

aiWorker.on('completed', (job) => {
    logger.info(`[AIWorker] Job ${job.id} completed.`);
});

aiWorker.on('failed', (job, err) => {
    logger.error(`[AIWorker] Job ${job?.id} failed: ${err.message}`);
});

module.exports = aiWorker;
