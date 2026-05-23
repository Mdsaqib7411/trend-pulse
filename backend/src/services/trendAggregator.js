const axios = require('axios');
const Trend = require('../models/Trend');
const alertService = require('./alertService');
const analyticsService = require('./analyticsService');
const { aiEnrichmentQueue } = require('../config/queue');
const cacheService = require('./cacheService');
const trendModerationService = require('./trendModerationService');
const aiOptimizationService = require('./aiOptimizationService');
const platformFusionEngine = require('./platformFusionEngine');
const trendClusteringEngine = require('./trendClusteringEngine');
const graphEngine = require('./graphEngine');
const trendPredictionEngine = require('./trendPredictionEngine');

const CACHE_DURATION_SEC = 300; // 5 minutes

class TrendAggregator {

    /**
     * Entry point: Fetches, normalizes, ranks, and returns cached trends based on category.
     */
    async getAggregatedTrends(category = 'Home', forceRefresh = false) {
        const cacheKey = `trendpulse:trends:${category.toLowerCase().replace(/\s+/g, '_')}`;

        if (!forceRefresh) {
            // Return cached data if valid
            const cachedData = await cacheService.get(cacheKey);
            if (cachedData) {
                console.log(`[TrendAggregator] Serving ${category} trends from Redis cache`);
                return {
                    data: this.shuffleTrends(cachedData),
                    isStale: false,
                    fetchedAt: new Date().toISOString()
                };
            }
        }

        console.log(`[TrendAggregator] Fetching fresh trends for category: ${category} ...`);

        // 1. Fetch from all sources concurrently with fault tolerance
        const results = await Promise.allSettled([
            this.fetchFromNewsAPI(category),
            this.fetchFromReddit(category),
            this.fetchFromGNews(category),
            this.fetchFromYouTube(category)
        ]);

        let combined = [];
        results.forEach(result => {
            if (result.status === 'fulfilled' && result.value) {
                combined = [...combined, ...result.value];
            } else if (result.status === 'rejected') {
                console.warn(`[TrendAggregator] Fetch source failed:`, result.reason?.message);
            }
        });

        // Fallback: Stale-While-Revalidate if all APIs failed or returned empty
        if (combined.length === 0) {
            logger.info('[TrendAggregator] All APIs failed/empty for %s. Initiating DB Fallback.', category);
            try {
                // Fetch latest trends from MongoDB as fallback
                const escaped = category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const pattern = new RegExp(escaped, 'i');
                const query = (category === 'Home' || category === 'All') ? {} : {
                    $or: [
                        { category: pattern },
                        { title: pattern }
                    ]
                };
                const fallbackTrends = await Trend.find(query)
                    .sort({ trendScore: -1, publishedAt: -1 })
                    .limit(15)
                    .maxTimeMS(4000)
                    .lean();

                if (fallbackTrends && fallbackTrends.length > 0) {
                    logger.info('[TrendAggregator] DB Fallback successful, returned %d trends.', fallbackTrends.length);
                    return {
                        data: fallbackTrends,
                        isStale: true,
                        fetchedAt: fallbackTrends[0].publishedAt || new Date().toISOString()
                    };
                }
            } catch (err) {
                logger.error('[TrendAggregator] DB Fallback error: %s', err.message);
            }
            return { data: [], isStale: true, fetchedAt: new Date().toISOString() };
        }

        // 3. Deduplicate based on title similarity
        combined = this.removeDuplicates(combined);

        // 3.5. Anti-spam moderation pass
        combined = trendModerationService.moderateBatch(combined);

        // 3.6. Cross-Platform Fusion: merge duplicates across platforms
        const fusionResult = await platformFusionEngine.processBatch(combined);
        combined = fusionResult.newTrends;

        // 3.7. Phase 3.5 Step 3: Semantic Clustering + Geo-Anomaly Security Gate
        const clusterResult = await trendClusteringEngine.processClusteringAndSecurity(combined);
        combined = clusterResult.trends;
        if (clusterResult.anomalyCount > 0) {
            console.log(`[TrendAggregator] Clustering: ${clusterResult.anomalyCount} trends quarantined, ${clusterResult.clusterCount} clusters formed.`);
        }

        // 4. Apply Ranking & Sort
        combined = this.applyRanking(combined);

        // 5. Filter out very old trends (older than 7 days) to keep feed fresh, then Sort & Limit
        combined = combined.filter(t => {
            const hoursOld = (new Date() - t.publishedAt) / (1000 * 60 * 60);
            return hoursOld < 168; // Max 7 days old
        });

        combined.sort((a, b) => b.trendScore - a.trendScore);
        const finalTrends = combined.slice(0, 15);

        // 6. Upsert to Database so AI Analysis and other features work
        try {
            const bulkOps = finalTrends.map(trend => {
                // Prevent Mongoose Path Collision by flattening the update object
                // Mongoose can create path collisions if $set has { analysis: {...} } and $setOnInsert adds 'analysis.keywords'
                const flattenObject = (obj, prefix = '') => {
                    return Object.keys(obj).reduce((acc, k) => {
                        const pre = prefix.length ? prefix + '.' : '';
                        if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k]) && !(obj[k] instanceof Date)) {
                            Object.assign(acc, flattenObject(obj[k], pre + k));
                        } else {
                            acc[pre + k] = obj[k];
                        }
                        return acc;
                    }, {});
                };

                const flatTrend = flattenObject(trend);

                return {
                    updateOne: {
                        filter: { trendId: trend.trendId },
                        update: { $set: flatTrend },
                        upsert: true
                    }
                };
            });
            if (bulkOps.length > 0) {
                await Trend.bulkWrite(bulkOps);

                // AI enrichment gated by cost optimization
                for (const trend of finalTrends) {
                    const safeJobId = trend.trendId.replace(/:/g, '_');
                    const evaluation = await aiOptimizationService.evaluateForEnrichment(trend.trendId);

                    if (evaluation.mirroredAnalysis) {
                        await aiOptimizationService.applyMirroredAnalysis(trend.trendId, evaluation.mirroredAnalysis);
                    } else if (evaluation.shouldEnrich) {
                        await aiEnrichmentQueue.add('enrich-trend', { trendId: trend.trendId }, {
                            jobId: safeJobId
                        });
                    }
                }
            }
        } catch (dbErr) {
            console.error('Error saving aggregated trends to DB:', dbErr.message);
        }

        // 7. Update Redis Cache
        await cacheService.setex(cacheKey, CACHE_DURATION_SEC, finalTrends);

        // 7.5. Build trend relationship graph (fire-and-forget)
        graphEngine.buildRelationships(finalTrends).catch(err =>
            console.error('[TrendAggregator] Graph build error:', err.message)
        );

        // 7.6. Phase 3.5 Step 2: Run viral spread predictions (fire-and-forget)
        trendPredictionEngine.predictBatch(finalTrends).catch(err =>
            console.error('[TrendAggregator] Prediction engine error:', err.message)
        );

        // 8. Process Smart Alerts (fire-and-forget, don't block response)
        alertService.processAlerts(finalTrends).catch(err =>
            console.error('[TrendAggregator] Alert processing error:', err.message)
        );

        // 9. Store Analytics Snapshot (fire-and-forget)
        analyticsService.storeTrendSnapshots(finalTrends).catch(err =>
            console.error('[TrendAggregator] Analytics storage error:', err.message)
        );

        return {
            data: finalTrends,
            isStale: false,
            fetchedAt: new Date().toISOString()
        };
    }

    /**
     * Fetch from News API
     */
    async fetchFromNewsAPI(category) {
        try {
            const apiKey = process.env.NEWS_API_KEY;
            if (!apiKey) return [];

            const isIndia = ['Entertainment', 'Cricket', 'Gaming', 'Finance', 'Politics', 'Movies', 'Viral Videos', 'YouTube Trending', 'Influencers', 'Memes', 'Education'].includes(category);

            let baseQuery = 'trending OR viral OR breaking OR news';
            if (category !== 'Home' && category !== 'All' && category !== 'AI' && category !== 'AI Tech') {
                baseQuery = category;
                if (isIndia) baseQuery += ' AND india';
            }

            const query = encodeURIComponent(baseQuery);
            const url = `https://newsapi.org/v2/everything?q=${query}&sortBy=publishedAt&language=en&pageSize=10&apiKey=${apiKey}`;

            const response = await axios.get(url, { timeout: 4000 });

            return response.data.articles.map(article => ({
                title: article.title,
                description: article.description || '',
                url: article.url,
                image: article.urlToImage || 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=1000',
                source: article.source.name || 'NewsAPI',
                publishedAt: new Date(article.publishedAt),
                engagementScore: 1, // Base score for news
                type: 'news'
            }));
        } catch (error) {
            console.error('NewsAPI fetch error:', error.message);
            return [];
        }
    }

    /**
     * Fetch from Reddit JSON endpoints
     */
    async fetchFromReddit(category) {
        try {
            let subreddits = ['popular', 'news', 'entertainment', 'technology', 'funny'];

            // Global
            if (category === 'Healthcare') subreddits = ['health', 'medicine'];
            else if (category === 'Environment') subreddits = ['environment', 'climate'];
            else if (category === 'Hardware' || category === 'Gadgets') subreddits = ['hardware', 'gadgets'];
            else if (category === 'Blockchain') subreddits = ['CryptoCurrency', 'blockchain'];
            else if (category === 'Clean Energy') subreddits = ['energy', 'renewableEnergy'];
            else if (category === 'AI') subreddits = ['artificial', 'machinelearning'];
            else if (category === 'Technology') subreddits = ['technology', 'tech'];
            else if (category === 'Startups') subreddits = ['startups', 'entrepreneur'];
            else if (category === 'Cybersecurity') subreddits = ['cybersecurity', 'netsec'];
            else if (category === 'Developer Ecosystem') subreddits = ['programming', 'webdev', 'coding'];

            // India-Focused
            else if (category === 'Entertainment') subreddits = ['bollywood', 'entertainment'];
            else if (category === 'Cricket') subreddits = ['Cricket'];
            else if (category === 'Gaming') subreddits = ['IndianGaming', 'gaming'];
            else if (category === 'Finance') subreddits = ['IndiaInvestments', 'dalalstreetbets'];
            else if (category === 'Politics') subreddits = ['india', 'indianews'];
            else if (category === 'Movies') subreddits = ['bollywood', 'tollywood', 'movies'];
            else if (category === 'Viral Videos') subreddits = ['ViralVideo', 'PublicFreakout'];
            else if (category === 'YouTube Trending') subreddits = ['youtube', 'SaimanSays'];
            else if (category === 'Influencers') subreddits = ['InstaCelebsGossip'];
            else if (category === 'Memes') subreddits = ['IndianDankMemes', 'memes'];
            else if (category === 'Education') subreddits = ['IndianAcademia', 'education'];

            const promises = subreddits.map(sub =>
                axios.get(`https://www.reddit.com/r/${sub}/hot.json?limit=5`, { timeout: 4000 })
            );

            const responses = await Promise.all(promises);
            let redditPosts = [];

            responses.forEach(res => {
                const posts = res.data.data.children.map(child => {
                    const post = child.data;
                    return {
                        title: post.title,
                        description: post.selftext ? post.selftext.substring(0, 200) + '...' : '',
                        url: `https://reddit.com${post.permalink}`,
                        image: post.thumbnail && post.thumbnail.startsWith('http') ? post.thumbnail : 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&q=80&w=1000',
                        source: `r/${post.subreddit}`,
                        publishedAt: new Date(post.created_utc * 1000),
                        engagementScore: post.score + post.num_comments, // Reddit engagement
                        type: 'reddit'
                    };
                });
                redditPosts = [...redditPosts, ...posts];
            });

            return redditPosts;
        } catch (error) {
            console.error('Reddit fetch error:', error.message);
            return [];
        }
    }

    /**
     * Fetch from GNews API
     */
    async fetchFromGNews(category) {
        try {
            const apiKey = process.env.GNEWS_API_KEY;
            if (!apiKey) return [];

            const isIndia = ['Entertainment', 'Cricket', 'Gaming', 'Finance', 'Politics', 'Movies', 'Viral Videos', 'YouTube Trending', 'Influencers', 'Memes', 'Education'].includes(category);

            let baseQuery = 'viral OR breaking OR world';
            if (category !== 'Home' && category !== 'All' && category !== 'AI' && category !== 'AI Tech') {
                baseQuery = category;
            }

            const query = encodeURIComponent(baseQuery);
            const countryParam = isIndia ? '&country=in' : '';
            const url = `https://gnews.io/api/v4/search?q=${query}&lang=en&max=5${countryParam}&apikey=${apiKey}`;

            const response = await axios.get(url, { timeout: 4000 });

            return response.data.articles.map(article => ({
                title: article.title,
                description: article.description || '',
                url: article.url,
                image: article.image || 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=1000',
                source: article.source.name || 'GNews',
                publishedAt: new Date(article.publishedAt),
                engagementScore: 2, // slightly higher base score
                type: 'news'
            }));
        } catch (error) {
            console.error('GNews fetch error:', error.message);
            return [];
        }
    }

    /**
     * Fetch from YouTube API
     */
    async fetchFromYouTube(category) {
        try {
            const apiKey = process.env.YOUTUBE_API_KEY;
            if (!apiKey) return [];

            const isIndia = ['Entertainment', 'Cricket', 'Gaming', 'Finance', 'Politics', 'Movies', 'Viral Videos', 'YouTube Trending', 'Influencers', 'Memes', 'Education'].includes(category);

            let url;
            if (category === 'Home' || category === 'All') {
                // Fetch actual general trending videos for Home feed
                url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=IN&maxResults=5&key=${apiKey}`;
            } else {
                const query = encodeURIComponent(`latest trending ${category}`);
                const regionParam = isIndia ? '&regionCode=IN' : '';
                url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=video&order=relevance${regionParam}&maxResults=5&key=${apiKey}`;
            }

            const response = await axios.get(url, { timeout: 4000 });

            return response.data.items.map(item => ({
                title: item.snippet.title,
                description: item.snippet.description || '',
                url: `https://www.youtube.com/watch?v=${item.id.videoId || item.id}`,
                image: item.snippet.thumbnails?.high?.url || 'https://images.unsplash.com/photo-1617802690992-15d93263d3a9?auto=format&fit=crop&q=80&w=1000',
                source: item.snippet.channelTitle || 'YouTube',
                publishedAt: new Date(item.snippet.publishedAt),
                engagementScore: item.statistics ? Math.min(100, parseInt(item.statistics.viewCount) / 50000) : 15,
                type: 'video'
            }));
        } catch (error) {
            console.error('YouTube fetch error:', error.message);
            return [];
        }
    }

    /**
     * Deduplication using simple word overlap logic
     */
    removeDuplicates(trends) {
        const uniqueTrends = [];

        for (const trend of trends) {
            let isDuplicate = false;
            const wordsA = new Set(trend.title.toLowerCase().split(/\W+/));

            for (const existing of uniqueTrends) {
                const wordsB = new Set(existing.title.toLowerCase().split(/\W+/));

                // Calculate intersection
                const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
                const overlapRatio = intersection.size / Math.min(wordsA.size, wordsB.size);

                // If 60% of words overlap, consider it a duplicate
                if (overlapRatio > 0.6) {
                    isDuplicate = true;
                    // Keep the one with higher engagement if duplicate found
                    if (trend.engagementScore > existing.engagementScore) {
                        Object.assign(existing, trend);
                    }
                    break;
                }
            }

            if (!isDuplicate) {
                uniqueTrends.push(trend);
            }
        }
        return uniqueTrends;
    }

    /**
     * Ranking Algorithm
     */
    applyRanking(trends) {
        const now = new Date();

        return trends.map(trend => {
            // 1. Recency Score (Decays over time)
            const hoursOld = Math.max(0, (now - trend.publishedAt) / (1000 * 60 * 60));
            // e.g., max 100 points, losing 2 points per hour old
            let recencyScore = Math.max(0, 100 - (hoursOld * 2));

            // 2. Normalize Engagement Score 
            // Reddit scores can be thousands. We'll cap the boost or log it.
            let engagementBoost = trend.type === 'reddit'
                ? Math.log10(trend.engagementScore + 1) * 10
                : trend.engagementScore * 10;

            // Total Score
            const trendScore = Math.round(recencyScore + engagementBoost);

            // Determine Label
            let label = "🆕 New";
            if (trendScore >= 100) label = "🔥 Hot";
            else if (trendScore >= 60) label = "📈 Trending";

            return {
                ...trend,
                trendScore,
                label,
                // Adding fields to match frontend data model so UI doesn't break
                id: trend.url,
                trendId: trend.url,
                category: trend.source,
                time: hoursOld < 1 ? 'Just now' : hoursOld < 24 ? `${Math.floor(hoursOld)} hours ago` : `${Math.floor(hoursOld / 24)} days ago`,
                readTime: '5 min read',
                author: trend.source,
                growth: label === "🔥 Hot" ? "+200%" : "+50%",
                content: trend.description || trend.title // Ensure content exists
            };
        });
    }

    /**
     * Shuffle trends to give fresh feel on each request.
     * Keeps the #1 spot stable (most trending), shuffles rest.
     */
    shuffleTrends(trends) {
        if (!trends || trends.length <= 3) return [...trends];

        const copy = [...trends];
        const top3 = copy.splice(0, 3); // Keep top 3 completely stable for Featured Trends

        // Fisher-Yates shuffle for the rest
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }

        return [...top3, ...copy];
    }
}

module.exports = new TrendAggregator();
