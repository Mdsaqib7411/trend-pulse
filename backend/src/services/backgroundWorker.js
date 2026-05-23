const trendAggregator = require('./trendAggregator');

class BackgroundWorker {
    start() {
        console.log('[Background Worker] Started autonomous trend aggregation engine.');
        
        // Initial fetch after 10 seconds of server start
        setTimeout(() => {
            this.fetchBackgroundTrends();
        }, 10000);

        // Fetch new trends autonomously every 30 minutes to prevent Gemini 429 Rate Limits
        // In production, this can be changed to every 30 or 60 minutes
        const intervalMs = 30 * 60 * 1000; 
        setInterval(() => {
            this.fetchBackgroundTrends();
        }, intervalMs);
    }

    async fetchBackgroundTrends() {
        console.log('\n[Background Worker] Running autonomous trend fetch to keep data fresh...');
        try {
            // Force fetch fresh data by clearing cache or relying on aggregator logic
            // getAggregatedTrends handles its own caching, but we can call it here.
            // By calling it, it will either hit cache (if under 1 min) or fetch fresh from APIs.
            // Since our interval is 2 mins and cache is 1 min, it will always fetch fresh data!
            await trendAggregator.getAggregatedTrends('Home');
            console.log('[Background Worker] Autonomous fetch completed. Trends are fresh!\n');
        } catch (error) {
            console.error('[Background Worker] Error during autonomous fetch:', error.message);
        }
    }
}

module.exports = new BackgroundWorker();
