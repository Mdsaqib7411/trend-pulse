const cron = require('node-cron');
const { trendQueue } = require('../config/queue');

// List of global and India-focused categories to keep fresh
const categoriesToFetch = [
    'Home', 'All', 'AI', 'Technology', 'Startups', 'Cybersecurity', 
    'Entertainment', 'Cricket', 'Finance', 'Politics', 'Movies',
    'Viral Videos', 'YouTube Trending', 'Influencers', 'Memes', 'Education'
];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Run every 15 minutes with staggered delays to prevent API quota thundering herds
cron.schedule('*/15 * * * *', async () => {
    console.log('[Cron] Triggering staggered trend aggregation pulse...');
    
    // Create a deterministic time block
    const now = new Date();
    const timeBlock = `${now.getFullYear()}${now.getMonth()}${now.getDate()}_${now.getHours()}${Math.floor(now.getMinutes() / 15)}`;
    
    for (let i = 0; i < categoriesToFetch.length; i++) {
        const category = categoriesToFetch[i];
        
        await trendQueue.add('fetchTrends', { category }, { 
            jobId: `fetch_trend_${category.replace(/\s+/g, '_')}_${timeBlock}` 
        });

        // Stagger processing by 4 seconds between categories
        if (i < categoriesToFetch.length - 1) {
            await sleep(4000);
        }
    }
});

console.log('[Cron] Trend Aggregator Job initialized (Staggered 15-min cadence).');
