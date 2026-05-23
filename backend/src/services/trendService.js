const Trend = require('../models/Trend');

/**
 * Escapes special regex characters to prevent catastrophic backtracking (ReDoS).
 */
const escapeRegExp = (string) => {
    if (!string || typeof string !== 'string') return '';
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

class TrendService {
    async getTopTrends() {
        return await Trend.find()
            .sort({ trendScore: -1 })
            .limit(10)
            .maxTimeMS(2000);
    }

    async getAllTrends() {
        // Enforce safe result caps to prevent database-wide query blowouts
        return await Trend.find()
            .sort({ createdAt: -1 })
            .limit(100)
            .maxTimeMS(2000);
    }

    async getByCategory(category) {
        const escaped = escapeRegExp(category);
        return await Trend.find({ category: new RegExp(escaped, 'i') })
            .sort({ trendScore: -1 })
            .limit(50)
            .maxTimeMS(2000);
    }

    async searchTrends(query) {
        const escaped = escapeRegExp(query);
        const pattern = new RegExp(escaped, 'i');
        return await Trend.find({
            $or: [
                { title: pattern },
                { category: pattern },
                { content: pattern }
            ]
        })
        .limit(50)
        .maxTimeMS(2000);
    }

    async getByLocation(location) {
        const escaped = escapeRegExp(location);
        return await Trend.find({ location: new RegExp(escaped, 'i') })
            .sort({ trendScore: -1 })
            .limit(50)
            .maxTimeMS(2000);
    }

    async getTrendById(id) {
        return await Trend.findOne({ trendId: id })
            .maxTimeMS(2000);
    }

    async compareTrends(id1, id2) {
        const trend1 = await Trend.findOne({ trendId: id1 }).maxTimeMS(2000);
        const trend2 = await Trend.findOne({ trendId: id2 }).maxTimeMS(2000);
        
        if (!trend1 || !trend2) return null;

        const winner = trend1.trendScore >= trend2.trendScore ? trend1 : trend2;

        return {
            trend1: {
                id: trend1.trendId,
                title: trend1.title,
                score: trend1.trendScore,
                growth: trend1.growth
            },
            trend2: {
                id: trend2.trendId,
                title: trend2.title,
                score: trend2.trendScore,
                growth: trend2.growth
            },
            winner: {
                id: winner.trendId,
                title: winner.title
            }
        };
    }
}

module.exports = new TrendService();
