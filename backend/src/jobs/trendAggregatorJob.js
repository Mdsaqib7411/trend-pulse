const cron = require('node-cron');
const { trendQueue } = require('../config/queue');

// List of global and India-focused categories to keep fresh
const categoriesToFetch = [
    'Home', 'All', 'AI', 'Technology', 'Startups', 'Cybersecurity', 
    'Entertainment', 'Cricket', 'Finance', 'Politics', 'Movies',
    'Viral Videos', 'YouTube Trending', 'Influencers', 'Memes', 'Education'
];

// Run every 5 minutes
cron.schedule('*/5 * * * *', async () => {
    console.log('[Cron] Triggering trend aggregation pulse...');
    
    // Create a deterministic time block (e.g., 10:05, 10:10)
    const now = new Date();
    const timeBlock = `${now.getFullYear()}${now.getMonth()}${now.getDate()}_${now.getHours()}${Math.floor(now.getMinutes() / 5)}`;
    
    for (const category of categoriesToFetch) {
        // Deterministic jobId prevents duplicate background fetching
        await trendQueue.add('fetchTrends', { category }, { 
            jobId: `fetch_trend_${category.replace(/\s+/g, '_')}_${timeBlock}` 
        });
    }
});

console.log('[Cron] Trend Aggregator Job initialized.');
