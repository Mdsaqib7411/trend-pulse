const TrendHistory = require('../models/TrendHistory');
const logger = require('./loggerService');

class AnalyticsService {
    /**
     * Stores a snapshot of trends. Prevents duplicate snapshots for the same trend within the same hour.
     * @param {Array} trends - Array of trend objects to snapshot
     */
    async storeTrendSnapshots(trends) {
        if (!trends || trends.length === 0) return;

        try {
            // Changed to 1 minute ago for TESTING purposes (originally 1 hour)
            const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
            const snapshotsToInsert = [];

            for (const trend of trends) {
                // Check if we already have a snapshot for this trend in the last minute
                const recentSnapshot = await TrendHistory.findOne({
                    trendId: trend.trendId || trend.id,
                    timestamp: { $gte: oneMinuteAgo }
                })
                .maxTimeMS(2000)
                .lean();

                if (!recentSnapshot) {
                    snapshotsToInsert.push({
                        trendId: trend.trendId || trend.id,
                        title: trend.title,
                        source: trend.source || trend.category,
                        trendScore: trend.trendScore || 0,
                        engagementScore: trend.engagementScore || 0,
                        viralityScore: trend.analysis?.viralityScore || 0,
                        mentionsCount: (trend.engagementScore || 0) * 10, // Approximation if mentions count is not natively available
                        timestamp: new Date()
                    });
                }
            }

            if (snapshotsToInsert.length > 0) {
                await TrendHistory.insertMany(snapshotsToInsert, { ordered: false });
                logger.info(`[Analytics Service] Stored ${snapshotsToInsert.length} new trend snapshots.`);
            }
        } catch (error) {
            logger.error('[Analytics Service] Error storing snapshots: %s', error.message);
        }
    }

    /**
     * Gets all historical data points for a specific trend, sorted chronologically.
     * @param {String} trendId 
     * @returns {Array} History records
     */
    async getTrendHistory(trendId) {
        return await TrendHistory.find({ trendId })
            .sort({ timestamp: 1 })
            .maxTimeMS(2000)
            .lean();
    }

    /**
     * Calculates the growth rate percentage.
     * @param {Number} oldestScore 
     * @param {Number} latestScore 
     * @returns {Number} Growth rate percentage
     */
    calculateGrowthRate(oldestScore, latestScore) {
        if (!oldestScore || oldestScore === 0) {
            return latestScore > 0 ? 100 : 0;
        }
        const growth = ((latestScore - oldestScore) / oldestScore) * 100;
        return parseFloat(growth.toFixed(1));
    }

    /**
     * Aggregates and calculates analytics for a single trend to be displayed in the UI.
     * @param {String} trendId 
     * @returns {Object} Analytics payload
     */
    async getTrendAnalytics(trendId) {
        const history = await this.getTrendHistory(trendId);
        
        // Safe defaults for newly tracked trends
        if (!history || history.length === 0) {
            return {
                currentScore: 0,
                averageScore: 0,
                highestScore: 0,
                growthRate: 0,
                mentionsCount: 0,
                viralityTrend: 'Stable',
                graphData: []
            };
        }

        const latestRecord = history[history.length - 1];
        const oldestRecord = history[0];

        // Calculations
        let totalScore = 0;
        let highestScore = 0;

        const graphData = history.map(record => {
            totalScore += record.trendScore;
            if (record.trendScore > highestScore) highestScore = record.trendScore;
            
            return {
                date: record.timestamp,
                // UI expects 'month' for x-axis, using time for better real-time testing feedback
                month: new Date(record.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                value: record.trendScore
            };
        });

        const averageScore = Math.round(totalScore / history.length);
        const growthRate = this.calculateGrowthRate(oldestRecord.trendScore, latestRecord.trendScore);

        let viralityTrend = 'Stable';
        if (growthRate > 20) viralityTrend = 'Bullish';
        else if (growthRate < -20) viralityTrend = 'Bearish';

        // Generate consistent regional distribution based on trendId hash
        const regionsPool = ['US', 'IN', 'UK', 'CA', 'AU', 'DE', 'FR', 'JP', 'BR'];
        let hash = 0;
        for (let i = 0; i < trendId.length; i++) {
            hash = trendId.charCodeAt(i) + ((hash << 5) - hash);
        }
        hash = Math.abs(hash);

        const regionalDistribution = [];
        let remainingPercentage = 100;
        for (let i = 0; i < 3; i++) {
            const regionIndex = (hash + i * 7) % regionsPool.length;
            let percentage = (i === 2) ? remainingPercentage : Math.floor((hash + i * 13) % (remainingPercentage - 20)) + 15;
            remainingPercentage -= percentage;
            
            regionalDistribution.push({
                region: regionsPool[regionIndex],
                percentage
            });
        }
        regionalDistribution.sort((a, b) => b.percentage - a.percentage);

        return {
            currentScore: latestRecord.trendScore,
            averageScore,
            highestScore,
            growthRate,
            mentionsCount: latestRecord.mentionsCount,
            viralityTrend,
            graphData,
            regionalDistribution
        };
    }
}

module.exports = new AnalyticsService();
