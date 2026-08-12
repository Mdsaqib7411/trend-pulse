require('dotenv').config();
const mongoose = require('mongoose');
const Trend = require('./src/models/Trend');
const TrendHistory = require('./src/models/TrendHistory');

mongoose.connect(process.env.MONGO_URI).then(async () => {
    console.log("Connected to MongoDB for history seeding!");
    
    // Clear old histories
    await TrendHistory.deleteMany({});
    console.log("Cleared old history records.");
    
    const trends = await Trend.find({}).lean();
    if (trends.length === 0) {
        console.log("No trends found in DB to generate history for. Run seed_trends.js first.");
        process.exit(1);
    }
    
    const historyDocs = [];
    const now = Date.now();
    
    for (const t of trends) {
        const finalScore = t.trendScore || 75;
        const finalEng = t.engagementScore || 50;
        const virality = t.analysis?.viralityScore || 70;
        
        // Generate 5 points: 16h ago, 12h ago, 8h ago, 4h ago, and now
        const intervals = [16, 12, 8, 4, 0];
        intervals.forEach((hrs, idx) => {
            const factor = (5 - idx) / 5; // grows from 0.2 to 1.0
            const score = Math.round(finalScore * (0.6 + (idx * 0.1))); // grows from 60% of final to 100%
            const eng = Math.round(finalEng * (0.5 + (idx * 0.125)));
            
            historyDocs.push({
                trendId: t.trendId,
                title: t.title,
                source: t.source || t.category,
                trendScore: score,
                engagementScore: eng,
                viralityScore: virality,
                mentionsCount: eng * 10,
                timestamp: new Date(now - 3600000 * hrs)
            });
        });
    }
    
    const inserted = await TrendHistory.insertMany(historyDocs);
    console.log(`Successfully seeded ${inserted.length} history timeline entries for all trends!`);
    
    process.exit(0);
}).catch(err => {
    console.error("History seeding failed:", err);
    process.exit(1);
});
