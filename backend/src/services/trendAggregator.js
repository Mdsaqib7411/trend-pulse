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
const trendScoreEngine = require('./trendScoreEngine');
const logger = require('./loggerService');

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

        // Initialize unique trendIds and category mappings early
        combined = combined.map(t => {
            const tId = t.url || `trend_${Math.random().toString(36).substr(2, 9)}`;
            return {
                ...t,
                trendId: tId,
                category: t.category || category
            };
        });

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

        // 4. Apply Authoritative Scoring via TrendScoreEngine & Filter/Sort
        combined = await trendScoreEngine.scoreBatch(combined);

        // 5. Filter out very old trends (older than 7 days) to keep feed fresh, then Sort & Limit
        combined = combined.filter(t => {
            const hoursOld = (new Date() - t.publishedAt) / (1000 * 60 * 60);
            return hoursOld < 168; // Max 7 days old
        });

        combined.sort((a, b) => b.trendScore - a.trendScore);
        let finalTrends = combined.slice(0, 15);

        // Fallback if final trends is empty after age/moderation filtering
        if (finalTrends.length === 0) {
            logger.info('[TrendAggregator] Final filtered trends empty for %s. Initiating DB Fallback.', category);
            try {
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
                    logger.info('[TrendAggregator] DB Fallback successful from empty filters, returned %d trends.', fallbackTrends.length);
                    return {
                        data: fallbackTrends,
                        isStale: true,
                        fetchedAt: fallbackTrends[0].publishedAt || new Date().toISOString()
                    };
                }
            } catch (err) {
                logger.error('[TrendAggregator] DB Fallback error on empty filters: %s', err.message);
            }
        }

        // 5.5 Hydrate perfect backward-compatible model fields for UI
        finalTrends = this.hydrateModelFields(finalTrends);

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
            console.error('Error saving aggregated trends to DB:', dbErr);
        }

        // 7. Update Redis Cache (only if we have trends, to avoid caching empty states)
        if (finalTrends.length > 0) {
            await cacheService.setex(cacheKey, CACHE_DURATION_SEC, finalTrends);
        } else {
            console.log(`[TrendAggregator] Skipping cache update for empty trends in: ${category}`);
        }

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
     * In-Memory Caches & In-Flight Request Locking (prevents Cache Stampedes)
     */
    gnewsCache = new Map();
    gnewsInFlight = new Map();
    redditInFlight = new Map();

    /**
     * Fetch from Reddit JSON endpoints
     */
    async fetchFromReddit(category) {
        const cacheKey = `reddit_${category}`;
        
        // Single-Flight Locking: If a request for this category is already in-flight, await it to prevent stampedes
        if (this.redditInFlight.has(cacheKey)) {
            return this.redditInFlight.get(cacheKey);
        }

        const fetchPromise = (async () => {
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
                if (category === 'Technology' || category === 'AI') subreddits = ['technology', 'artificial', 'hardware', 'programming'];
                if (category === 'Crypto') subreddits = ['CryptoCurrency', 'Bitcoin'];
                if (category === 'Cricket') subreddits = ['Cricket', 'CricketNews'];
                if (category === 'Gaming') subreddits = ['gaming', 'Games'];
                if (category === 'Finance') subreddits = ['personalfinance', 'investing', 'wallstreetbets'];

                // Reddit Compliant User-Agent string
                const userAgent = process.env.REDDIT_USER_AGENT || 'android:com.trendpulse.app:v1.0.0 (by /u/mdsaqibhussain123)';

                const promises = subreddits.map(sub =>
                    axios.get(`https://www.reddit.com/r/${sub}/hot.json?limit=3`, {
                        headers: { 'User-Agent': userAgent },
                        timeout: 3000
                    })
                );

                const results = await Promise.allSettled(promises);

                let redditPosts = [];
                results.forEach((res, index) => {
                    if (res.status === 'fulfilled' && res.value.data?.data?.children) {
                        const posts = res.value.data.data.children.map(c => ({
                            title: c.data.title,
                            description: c.data.selftext ? c.data.selftext.substring(0, 150) + '...' : '',
                            url: `https://reddit.com${c.data.permalink}`,
                            image: c.data.thumbnail && c.data.thumbnail.startsWith('http') ? c.data.thumbnail : 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=1000',
                            source: `r/${subreddits[index]}`,
                            publishedAt: new Date(c.data.created_utc * 1000),
                            engagementScore: Math.min(100, (c.data.score || 10) / 100),
                            type: 'social'
                        }));
                        redditPosts = [...redditPosts, ...posts];
                    } else if (res.status === 'rejected') {
                        console.warn(`[Reddit Scraper] Subreddit r/${subreddits[index]} unavailable (${res.reason?.response?.status || res.reason?.message})`);
                    }
                });

                return redditPosts;
            } catch (error) {
                console.error('Reddit fetch global error:', error.message);
                return [];
            } finally {
                this.redditInFlight.delete(cacheKey);
            }
        })();

        this.redditInFlight.set(cacheKey, fetchPromise);
        return fetchPromise;
    }

    /**
     * Fetch from GNews API (with 20-minute response caching, Cache Stampede Protection & RSS Fallback)
     */
    async fetchFromGNews(category) {
        const apiKey = process.env.GNEWS_API_KEY;
        const cacheKey = `gnews_${category}`;

        // 1. Check GNews Cache (20 mins TTL)
        const cached = this.gnewsCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < 20 * 60 * 1000)) {
            return cached.data;
        }

        // 2. Cache Stampede Single-Flight Protection: Reuse pending in-flight Promise if concurrent requests arrive
        if (this.gnewsInFlight.has(cacheKey)) {
            return this.gnewsInFlight.get(cacheKey);
        }

        const fetchPromise = (async () => {
            let baseQuery = 'viral OR breaking OR world';
            if (category !== 'Home' && category !== 'All' && category !== 'AI' && category !== 'AI Tech') {
                baseQuery = category;
            }

            try {
                if (!apiKey) {
                    return await this.fetchGoogleNewsRSS(baseQuery, category);
                }

                const isIndia = ['Entertainment', 'Cricket', 'Gaming', 'Finance', 'Politics', 'Movies', 'Viral Videos', 'YouTube Trending', 'Influencers', 'Memes', 'Education'].includes(category);

                const query = encodeURIComponent(baseQuery);
                const countryParam = isIndia ? '&country=in' : '';
                const url = `https://gnews.io/api/v4/search?q=${query}&lang=en&max=5${countryParam}&apikey=${apiKey}`;

                const response = await axios.get(url, { timeout: 4000 });

                const articles = (response.data.articles || []).map(article => ({
                    title: article.title,
                    description: article.description || '',
                    url: article.url,
                    image: article.image || 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=1000',
                    source: article.source?.name || 'GNews',
                    publishedAt: new Date(article.publishedAt),
                    engagementScore: 2,
                    type: 'news'
                }));

                // Save to Cache
                this.gnewsCache.set(cacheKey, { data: articles, timestamp: Date.now() });
                return articles;
            } catch (error) {
                if (error.response?.status === 429) {
                    console.warn(`[GNews Scraper] Rate limit / quota 429 hit for category: ${category}. Triggering zero-quota Google News RSS Fallback.`);
                    const rssArticles = await this.fetchGoogleNewsRSS(baseQuery, category);
                    if (rssArticles.length > 0) {
                        this.gnewsCache.set(cacheKey, { data: rssArticles, timestamp: Date.now() });
                        return rssArticles;
                    }
                    const stale = this.gnewsCache.get(cacheKey);
                    if (stale) return stale.data;
                } else {
                    console.error('GNews fetch error:', error.message);
                }
                return [];
            } finally {
                this.gnewsInFlight.delete(cacheKey);
            }
        })();

        this.gnewsInFlight.set(cacheKey, fetchPromise);
        return fetchPromise;
    }

    /**
     * Fetch from YouTube API (with 30-min Response Cache, Multi-Key Rotation & In-Flight Locking)
     */
    async fetchFromYouTube(category) {
        const rawKeys = process.env.YOUTUBE_API_KEY || '';
        const apiKeys = rawKeys.split(',').map(k => k.trim()).filter(Boolean);
        if (apiKeys.length === 0) return [];

        const cacheKey = `youtube_${category}`;

        // 1. Check YouTube Cache (30 mins TTL to conserve YouTube quota)
        const cached = this.youtubeCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < 30 * 60 * 1000)) {
            return cached.data;
        }

        // 2. Single-Flight In-Flight Request Locking (prevents parallel identical YouTube calls)
        if (this.youtubeInFlight.has(cacheKey)) {
            return this.youtubeInFlight.get(cacheKey);
        }

        const fetchPromise = (async () => {
            try {
                const isIndia = ['Entertainment', 'Cricket', 'Gaming', 'Finance', 'Politics', 'Movies', 'Viral Videos', 'YouTube Trending', 'Influencers', 'Memes', 'Education'].includes(category);
                let items = [];
                let success = false;

                // 3. Multi-Key Rotation: Try keys sequentially if key 1 returns 429 quota error
                for (const apiKey of apiKeys) {
                    try {
                        let url;
                        if (category === 'Home' || category === 'All') {
                            url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=IN&maxResults=5&key=${apiKey}`;
                        } else {
                            const query = encodeURIComponent(`latest trending ${category}`);
                            const regionParam = isIndia ? '&regionCode=IN' : '';
                            url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=video&order=relevance${regionParam}&maxResults=5&key=${apiKey}`;
                        }

                        const response = await axios.get(url, { timeout: 4000 });
                        if (response.data?.items) {
                            items = response.data.items.map(item => ({
                                title: item.snippet.title,
                                description: item.snippet.description || '',
                                url: `https://www.youtube.com/watch?v=${item.id.videoId || item.id}`,
                                image: item.snippet.thumbnails?.high?.url || 'https://images.unsplash.com/photo-1617802690992-15d93263d3a9?auto=format&fit=crop&q=80&w=1000',
                                source: item.snippet.channelTitle || 'YouTube',
                                publishedAt: new Date(item.snippet.publishedAt),
                                engagementScore: item.statistics ? Math.min(100, parseInt(item.statistics.viewCount) / 50000) : 15,
                                type: 'video'
                            }));
                            success = true;
                            break;
                        }
                    } catch (keyErr) {
                        const status = keyErr.response?.status;
                        if (status === 429 || status === 403) {
                            console.warn(`[YouTube Scraper] Key ending with ...${apiKey.slice(-4)} hit quota limit (status: ${status}). Rotating to next key if available.`);
                            continue;
                        }
                        console.error('[YouTube Scraper Key Error]:', keyErr.message);
                    }
                }

                if (success && items.length > 0) {
                    this.youtubeCache.set(cacheKey, { data: items, timestamp: Date.now() });
                    return items;
                }

                // 4. Stale cache fallback if all keys failed
                const stale = this.youtubeCache.get(cacheKey);
                if (stale) {
                    console.warn(`[YouTube Scraper] All API keys exhausted. Serving stale cached videos for category: ${category}`);
                    return stale.data;
                }

                return [];
            } finally {
                this.youtubeInFlight.delete(cacheKey);
            }
        })();

        this.youtubeInFlight.set(cacheKey, fetchPromise);
        return fetchPromise;
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
     * Hydrate perfect backward-compatible model fields for UI.
     */
    hydrateModelFields(trends) {
        const now = new Date();
        return trends.map(t => {
            const hoursOld = Math.max(0, (now - new Date(t.publishedAt)) / (1000 * 60 * 60));
            const score = t.trendScore || 0;
            let label = "🆕 New";
            if (score >= 75) label = "🔥 Hot";
            else if (score >= 45) label = "📈 Trending";

            return {
                ...t,
                label,
                id: t.url || t.trendId,
                trendId: t.url || t.trendId,
                category: t.category || t.source || 'General',
                time: hoursOld < 1 ? 'Just now' : hoursOld < 24 ? `${Math.floor(hoursOld)} hours ago` : `${Math.floor(hoursOld / 24)} days ago`,
                readTime: '5 min read',
                author: t.author || t.source || 'Unknown',
                growth: label === "🔥 Hot" ? "+200%" : "+50%",
                content: t.description || t.content || t.title
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
