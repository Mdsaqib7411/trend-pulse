require('dotenv').config();
const mongoose = require('mongoose');
const Trend = require('./src/models/Trend');

mongoose.connect(process.env.MONGO_URI).then(async () => {
    // Delete all trends where trendId is short (mock data was '1', '2', '3', '4', '5')
    const result = await Trend.deleteMany({ trendId: { $in: ['1', '2', '3', '4', '5'] } });
    console.log(`Deleted ${result.deletedCount} old mock trends.`);
    process.exit(0);
}).catch(console.error);
