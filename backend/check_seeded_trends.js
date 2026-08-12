require('dotenv').config();
const mongoose = require('mongoose');
const Trend = require('./src/models/Trend');
const TrendHistory = require('./src/models/TrendHistory');

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const trends = await Trend.find({}).lean();
    console.log(`Found ${trends.length} trends in DB:`);
    trends.forEach(t => {
        console.log(`- ID: ${t.trendId}, Title: "${t.title}", Location: "${t.location}"`);
    });
    
    // Check one specific Indian trend analytics output
    const cricketTrend = trends.find(t => t.trendId === 'trend_cricket_ipl_stars');
    if (cricketTrend) {
        const analyticsService = require('./src/services/analyticsService');
        const analytics = await analyticsService.getTrendAnalytics(cricketTrend.trendId);
        console.log("\nAnalytics output for IPL Stars (India trend):");
        console.log(JSON.stringify(analytics, null, 2));
    }
    
    process.exit(0);
}).catch(console.error);
