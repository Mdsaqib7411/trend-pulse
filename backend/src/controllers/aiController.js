const Trend = require('../models/Trend');
const aiAnalyticsService = require('../services/aiAnalyticsService');
const geoTrendEngine = require('../services/geoTrendEngine');
const logger = require('../services/loggerService');

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

exports.getAnalysis = async (req, res, next) => {
    try {
        const trendId = req.params.id;
        const trend = await Trend.findOne({ trendId });
        
        if (!trend) {
            return res.status(404).json({ success: false, message: 'Trend not found' });
        }

        // If DeepSeek/Shahkal hasn't enriched it yet, trigger dynamic JIT synchronous enrichment on-the-fly!
        if (!trend.analysis || trend.analysis.status !== 'completed') {
            logger.info(`[JIT AI Enrichment] Synchronously enriching trend on-demand: ${trendId}`);
            try {
                // 1. Build scoring context from trend metrics
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

                // 2. Build geo-local context for AI prompt
                const geoContext = geoTrendEngine.buildLocalContext(trend);

                // 3. Call LLM with a strict 3-second JIT timeout
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('JIT_TIMEOUT')), 3000);
                });

                let enrichedData;
                let isProvisional = false;

                try {
                    enrichedData = await Promise.race([
                        aiAnalyticsService.enrichTrendWithContext(trend, scoringContext, velocityDelta, geoContext),
                        timeoutPromise
                    ]);
                } catch (raceErr) {
                    if (raceErr.message === 'JIT_TIMEOUT') {
                        logger.warn(`[JIT AI Enrichment] Synchronous LLM timed out after 3000ms. Serving high-fidelity local fallback and queueing full analysis.`);
                        
                        // Push to BullMQ background queue for non-blocking resolution
                        try {
                            const { aiEnrichmentQueue } = require('../config/queue');
                            const safeJobId = trend.trendId.replace(/:/g, '_');
                            await aiEnrichmentQueue.add('enrich-trend', { trendId: trend.trendId }, {
                                jobId: safeJobId
                            });
                        } catch (qErr) {
                            logger.error(`[JIT AI Enrichment] BullMQ queue push failed: ${qErr.message}`);
                        }

                        // Generate premium local fallback
                        enrichedData = aiAnalyticsService.getFallbackEnrichment(trend, scoringContext, velocityDelta);
                        isProvisional = true;
                    } else {
                        throw raceErr;
                    }
                }

                // 4. Compute AI Confidence sub-object
                const aiConfidence = computeConfidence(trend, enrichedData);

                // 5. Persist enriched analysis to DB (marked isProvisional if timed out)
                trend.analysis = {
                    ...enrichedData,
                    status: 'completed',
                    isProvisional,
                    processedAt: new Date()
                };
                trend.aiConfidence = aiConfidence;
                await trend.save();

                logger.info(`[JIT AI Enrichment] Trend ${trendId} successfully enriched (provisional: ${isProvisional}).`);
            } catch (enrichErr) {
                logger.error(`[JIT AI Enrichment] Synchronous enrichment failed: ${enrichErr.message}. Serving dynamic fallback.`);
                // Fallback to avoid blocking user flow
                return res.status(200).json({ 
                    success: true, 
                    data: {
                        sentimentScore: 50,
                        viralityScore: 5,
                        keyDrivers: [{ title: 'Overview', desc: trend.category || 'General' }],
                        aiPrediction: 'Shahkal AI analysis is being generated dynamically.',
                        confidence: 85
                    }
                });
            }
        }

        // Map DeepSeek/Shahkal Schema to Frontend Schema
        const ds = trend.analysis;
        
        // Convert growthMomentum, alertType, or sentiment string to a sentiment score proxy
        let sentimentScore = 50;
        if (ds.growthMomentum === 'rapid') sentimentScore = 90;
        else if (ds.growthMomentum === 'moderate') sentimentScore = 70;
        else if (ds.sentiment === 'positive') sentimentScore = 80;
        else if (ds.sentiment === 'negative') sentimentScore = 20;
        
        const mappedData = {
            sentimentScore,
            viralityScore: ds.viralityScore || 5,
            keyDrivers: ds.keywords && ds.keywords.length > 0
                ? ds.keywords.map(k => ({ title: 'Keyword', desc: k }))
                : [{ title: 'Audience', desc: ds.audienceType || ds.targetAudience || 'General' }],
            aiPrediction: ds.summary || 'Trend is growing steadily.',
            confidence: trend.aiConfidence?.score || ds.confidenceScore || 85
        };

        res.status(200).json({ success: true, data: mappedData });
    } catch (error) {
        next(error);
    }
};
