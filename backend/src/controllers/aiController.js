const Trend = require('../models/Trend');

exports.getAnalysis = async (req, res, next) => {
    try {
        const trendId = req.params.id;
        const trend = await Trend.findOne({ trendId });
        
        if (!trend) {
            return res.status(404).json({ success: false, message: 'Trend not found' });
        }

        // If DeepSeek hasn't enriched it yet, return a pending state
        if (!trend.analysis || trend.analysis.status !== 'completed') {
            return res.status(200).json({ 
                success: true, 
                data: {
                    sentimentScore: 50,
                    viralityScore: 0,
                    keyDrivers: [{ title: 'Processing', desc: 'Shahkal is currently analyzing this trend in the background...' }],
                    aiPrediction: 'Analysis not available at the moment. Shahkal is processing...',
                    confidence: 0
                }
            });
        }

        // Map DeepSeek Schema to Frontend Schema
        const ds = trend.analysis;
        
        // Convert growthMomentum or alertType to a sentiment score proxy
        let sentimentScore = 50;
        if (ds.growthMomentum === 'rapid') sentimentScore = 90;
        else if (ds.growthMomentum === 'moderate') sentimentScore = 70;
        
        const mappedData = {
            sentimentScore,
            viralityScore: ds.viralityScore || 5,
            keyDrivers: ds.keywords ? ds.keywords.map(k => ({ title: 'Keyword', desc: k })) : [{ title: 'Audience', desc: ds.audienceType || 'General' }],
            aiPrediction: ds.summary || 'Trend is growing steadily.',
            confidence: ds.confidenceScore || 85
        };

        res.status(200).json({ success: true, data: mappedData });
    } catch (error) {
        next(error);
    }
};
