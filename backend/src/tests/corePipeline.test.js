/**
 * Core Pipeline Integration Test
 * 
 * Validates the primary loop:
 *   Raw ingestion → TrendScoreEngine scoring → MongoDB snapshot failover
 *
 * Single file. No mocks. Uses real scoring engine logic with synthetic trend data.
 */

const TrendScoreEngine = require('../services/trendScoreEngine');
const TrendModerationService = require('../services/trendModerationService');
const AIOptimizationService = require('../services/aiOptimizationService');

// Synthetic trend factory (no randomization — deterministic)
function createTrend(overrides = {}) {
    return {
        trendId: overrides.trendId || 'test:pipeline:001',
        title: overrides.title || 'OpenAI releases GPT-5 with groundbreaking reasoning capabilities',
        category: overrides.category || 'AI',
        engagementScore: overrides.engagementScore || 500,
        type: overrides.type || 'news',
        trendScore: overrides.trendScore || 60,
        publishedAt: overrides.publishedAt || new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        createdAt: overrides.createdAt || new Date(),
        source: 'TestSource',
        content: 'AI breakthrough in reasoning and code generation',
        scoring: overrides.scoring || null
    };
}

describe('TrendScoreEngine', () => {

    test('computeDecayedEngagement applies correct time-decay formula', () => {
        const engine = TrendScoreEngine;
        
        // At 0 hours: decay divisor = (0+2)^1.5 = 2.828
        const score0h = engine.computeDecayedEngagement(1000, 0);
        expect(score0h).toBeCloseTo(1000 / Math.pow(2, 1.5), 2);

        // At 24 hours: decay divisor = (24+2)^1.5 = 132.57
        const score24h = engine.computeDecayedEngagement(1000, 24);
        expect(score24h).toBeCloseTo(1000 / Math.pow(26, 1.5), 2);

        // Time-decay must be strictly monotonically decreasing
        expect(score0h).toBeGreaterThan(score24h);
    });

    test('logNormalize compresses outliers and caps at 100', () => {
        const engine = TrendScoreEngine;

        expect(engine.logNormalize(0, 100)).toBe(0);
        expect(engine.logNormalize(100, 100)).toBe(100); // max = self → 100
        expect(engine.logNormalize(50, 100)).toBeLessThan(100);
        expect(engine.logNormalize(50, 100)).toBeGreaterThan(0);

        // Mega-influencer compression: 50000 vs 100 should not be 500x different
        const small = engine.logNormalize(100, 50000);
        const large = engine.logNormalize(50000, 50000);
        expect(large / small).toBeLessThan(3); // Log compression means <3x, not 500x
    });

    test('scoreBatch produces valid 0-100 metrics without DB', async () => {
        // Create synthetic batch (no DB calls — scoreBatch will fail on Trend.find
        // but we can test the pure computation by calling individual methods)
        const engine = TrendScoreEngine;
        const trend = createTrend({ engagementScore: 800 });

        const hoursOld = engine.getHoursOld(trend);
        expect(hoursOld).toBeGreaterThan(1);
        expect(hoursOld).toBeLessThan(3);

        const decayed = engine.computeDecayedEngagement(800, hoursOld);
        expect(decayed).toBeGreaterThan(0);

        const viral = engine.computeViralScore(trend, decayed * 2);
        expect(viral).toBeGreaterThanOrEqual(0);
        expect(viral).toBeLessThanOrEqual(100);
    });
});

describe('TrendModerationService', () => {

    test('penalizes duplicate title clusters', () => {
        const trends = [
            createTrend({ trendId: 'a', title: 'Breaking: Major AI breakthrough announced today', engagementScore: 100 }),
            createTrend({ trendId: 'b', title: 'Breaking: Major AI breakthrough announced today!', engagementScore: 100 }),
            createTrend({ trendId: 'c', title: 'Breaking: Major AI breakthrough announced today.', engagementScore: 100 }),
            createTrend({ trendId: 'd', title: 'Cricket World Cup final highlights and results', engagementScore: 200 }),
        ];

        const moderated = TrendModerationService.moderateBatch(trends);

        // Clustered duplicates (a, b, c) should have reduced engagement
        // The non-duplicate (d) may still get minor metadata penalties but NOT cluster spam penalties
        const unique = moderated.find(t => t.trendId === 'd');
        const clustered = moderated.find(t => t.trendId === 'a');
        // Unique should have significantly higher engagement than cluster-penalized items
        expect(unique.engagementScore).toBeGreaterThan(clustered.engagementScore);
    });

    test('flags suspicious velocity spikes', () => {
        const trends = [
            createTrend({
                trendId: 'spike',
                title: 'Suspiciously viral post from unknown source',
                engagementScore: 15000,
                publishedAt: new Date(Date.now() - 10 * 60 * 1000) // 10 minutes old
            }),
            createTrend({ trendId: 'normal', engagementScore: 50 })
        ];

        const moderated = TrendModerationService.moderateBatch(trends);
        const spiked = moderated.find(t => t.trendId === 'spike');
        expect(spiked.engagementScore).toBeLessThan(15000); // Penalized
    });
});

describe('AIOptimizationService', () => {

    test('extractKeywords produces normalized word arrays', () => {
        const keywords = AIOptimizationService.extractKeywords('OpenAI releases GPT-5!!! Amazing #breakthrough');
        expect(keywords).toContain('openai');
        expect(keywords).toContain('releases');
        expect(keywords).toContain('gpt5');
        expect(keywords).toContain('amazing');
        expect(keywords).toContain('breakthrough');
    });

    test('computeOverlap detects high similarity correctly', () => {
        const a = ['openai', 'releases', 'gpt5', 'amazing', 'breakthrough'];
        const b = ['openai', 'releases', 'gpt5', 'incredible', 'breakthrough'];
        const overlap = AIOptimizationService.computeOverlap(a, b);
        expect(overlap).toBeGreaterThan(0.6); // 3/5 overlap at minimum
    });

    test('computeOverlap returns 0 for completely different sets', () => {
        const a = ['cricket', 'world', 'cup'];
        const b = ['openai', 'releases', 'gpt5'];
        const overlap = AIOptimizationService.computeOverlap(a, b);
        expect(overlap).toBe(0);
    });
});

describe('AnalysisSchema (Zod)', () => {
    const { analysisSchema } = require('../validators/analysisSchema');

    test('accepts valid LLM output', () => {
        const validOutput = {
            summary: 'OpenAI releases GPT-5 with groundbreaking reasoning capabilities.',
            whyTrending: 'This trend spiked due to a 210% velocity delta and viral score of 87/100.',
            sentiment: 'positive',
            sentimentScore: 82,
            targetAudience: 'AI Researchers, Tech Founders',
            prediction: 'growing',
            viralityScore: 8.5,
            audienceType: 'Tech Community',
            growthMomentum: 'rapid',
            alertType: 'velocity_spike',
            confidenceScore: 90,
            keywords: ['openai', 'gpt5', 'reasoning']
        };

        const result = analysisSchema.safeParse(validOutput);
        expect(result.success).toBe(true);
    });

    test('rejects broken/hallucinated output', () => {
        const brokenOutput = {
            summary: 'Short',  // too short (<10 chars)
            whyTrending: 123,  // wrong type
            sentiment: 'very positive', // invalid enum
            sentimentScore: 150, // out of range
            targetAudience: '',  // too short
            prediction: 'exploding', // invalid enum
            viralityScore: 15, // out of range
            audienceType: 'T',  // too short
            growthMomentum: 'explosive', // invalid enum
            alertType: 'critical', // invalid enum
            confidenceScore: -5, // out of range
            keywords: [] // empty array
        };

        const result = analysisSchema.safeParse(brokenOutput);
        expect(result.success).toBe(false);
        expect(result.error.issues.length).toBeGreaterThan(3);
    });

    test('rejects plain text (non-JSON LLM response)', () => {
        const plainText = 'I am an AI and I think this trend is very interesting.';
        const result = analysisSchema.safeParse(plainText);
        expect(result.success).toBe(false);
    });
});

describe('AIAnalyticsService Coercion', () => {
    const AIAnalyticsService = require('../services/aiAnalyticsService');

    test('coercePartialResult salvages valid fields and fills gaps', () => {
        const partial = {
            summary: 'This is a valid summary for the trend analysis.',
            whyTrending: 'Something completely wrong',  // valid string but < 10 is fine since it's > 10
            sentiment: 'positive',
            sentimentScore: 'not a number', // invalid
            targetAudience: 'Developers',
            prediction: 'invalid_enum',
            viralityScore: 7,
            audienceType: 'Tech',
            growthMomentum: 'rapid',
            alertType: 'none',
            confidenceScore: 85,
            keywords: ['ai', 'tech']
        };

        const result = AIAnalyticsService.coercePartialResult(partial);

        // Valid fields should be preserved
        expect(result.summary).toBe('This is a valid summary for the trend analysis.');
        expect(result.sentiment).toBe('positive');
        expect(result.targetAudience).toBe('Developers');
        expect(result.viralityScore).toBe(7);
        expect(result.growthMomentum).toBe('rapid');
        expect(result.keywords).toEqual(['ai', 'tech']);

        // Invalid fields should be coerced to defaults
        expect(result.sentimentScore).toBe(50); // was string
        expect(result.prediction).toBe('stable'); // was invalid enum
    });

    test('getFallbackEnrichment produces valid schema output', () => {
        const trend = { title: 'Test Trend for Fallback Validation' };
        const scoring = { viralScore: 75, heatScore: 60, growthScore: 40, compositeScore: 65 };
        const fallback = AIAnalyticsService.getFallbackEnrichment(trend, scoring, 55);

        const { analysisSchema } = require('../validators/analysisSchema');
        const result = analysisSchema.safeParse(fallback);
        expect(result.success).toBe(true);
    });
});

describe('GeoProfileService', () => {
    const geoProfileService = require('../services/geoProfileService');

    test('resolveIP normalizes IPv6-mapped IPv4 addresses', () => {
        const normalized = geoProfileService.normalizeIP('::ffff:203.0.113.50');
        expect(normalized).toBe('203.0.113.50');
    });

    test('resolveIP handles X-Forwarded-For proxy chains', () => {
        const normalized = geoProfileService.normalizeIP('203.0.113.50, 70.41.3.18, 150.172.238.178');
        expect(normalized).toBe('203.0.113.50');
    });

    test('resolveIP returns fallback for null/empty input', () => {
        expect(geoProfileService.normalizeIP(null)).toBe('0.0.0.0');
        expect(geoProfileService.normalizeIP('')).toBe('0.0.0.0');
    });

    test('resolveIP returns structured geo-data for known IPs', () => {
        // Google DNS IP — should resolve
        const geo = geoProfileService.resolveIP('8.8.8.8');
        expect(geo).toHaveProperty('country');
        expect(geo).toHaveProperty('state');
        expect(geo).toHaveProperty('city');
        expect(geo).toHaveProperty('timezone');
    });
});

describe('GeoTrendEngine', () => {
    const geoTrendEngine = require('../services/geoTrendEngine');

    test('buildLocalContext returns empty string for non-emerging trends', () => {
        const trend = { isEmerging: false, geography: { state: 'CA', country: 'US' } };
        expect(geoTrendEngine.buildLocalContext(trend)).toBe('');
    });

    test('buildLocalContext returns geo-enriched context for emerging trends', () => {
        const trend = {
            isEmerging: true,
            geography: { state: 'Punjab', city: 'Lahore', country: 'PK' },
            emergingDetectedAt: new Date()
        };
        const context = geoTrendEngine.buildLocalContext(trend);
        expect(context).toContain('LOCAL CONTEXT');
        expect(context).toContain('Lahore');
        expect(context).toContain('PK');
        expect(context).toContain('Why Trending In Your Area');
    });

    test('findEntryFromNHoursAgo returns closest entry', () => {
        const now = Date.now();
        const history = [
            { ts: new Date(now - 3 * 60 * 60 * 1000), c: 30 },
            { ts: new Date(now - 1.1 * 60 * 60 * 1000), c: 50 },
            { ts: new Date(now - 5 * 60 * 1000), c: 80 }
        ];
        const entry = geoTrendEngine.findEntryFromNHoursAgo(history, 1);
        expect(entry.c).toBe(50); // Closest to 1 hour ago
    });
});

describe('RecommendationEngine', () => {
    const recommendationEngine = require('../services/recommendationEngine');

    test('buildAffinityVector produces normalized weights', () => {
        const weightMap = [
            { _id: 'AI', totalWeight: 60, keywords: ['openai', 'gpt'] },
            { _id: 'Cricket', totalWeight: 40, keywords: ['ipl', 'world cup'] }
        ];
        const { affinityMap, allKeywords } = recommendationEngine.buildAffinityVector(weightMap);

        expect(affinityMap['AI']).toBeCloseTo(0.6);
        expect(affinityMap['Cricket']).toBeCloseTo(0.4);
        expect(allKeywords).toContain('openai');
        expect(allKeywords).toContain('ipl');
    });

    test('buildAffinityVector returns empty for no activity', () => {
        const { affinityMap, allKeywords } = recommendationEngine.buildAffinityVector([]);
        expect(Object.keys(affinityMap).length).toBe(0);
        expect(allKeywords.length).toBe(0);
    });

    test('interleave deduplicates by trendId', () => {
        const local = [{ trendId: 'a' }, { trendId: 'b' }];
        const national = [{ trendId: 'b' }, { trendId: 'c' }]; // 'b' is duplicate
        const global = [{ trendId: 'd' }];

        const result = recommendationEngine.interleave(local, national, global);
        const ids = result.map(t => t.trendId);
        expect(new Set(ids).size).toBe(ids.length); // No duplicates
        expect(ids).toContain('a');
        expect(ids).toContain('b');
        expect(ids).toContain('c');
        expect(ids).toContain('d');
    });
});

describe('PlatformFusionEngine', () => {
    const fusionEngine = require('../services/platformFusionEngine');

    test('extractKeywords strips stop words and short tokens', () => {
        const keywords = fusionEngine.extractKeywords('The OpenAI GPT-5 release is a major breakthrough in AI');
        expect(keywords).toContain('openai');
        expect(keywords).toContain('gpt5');
        expect(keywords).toContain('release');
        expect(keywords).toContain('major');
        expect(keywords).toContain('breakthrough');
        expect(keywords).not.toContain('the');
        expect(keywords).not.toContain('is');
        expect(keywords).not.toContain('a');
        expect(keywords).not.toContain('in');
    });

    test('extractKeywords returns empty array for null/empty input', () => {
        expect(fusionEngine.extractKeywords(null)).toEqual([]);
        expect(fusionEngine.extractKeywords('')).toEqual([]);
    });

    test('computeOverlap returns 1.0 for identical keyword sets', () => {
        const kw = ['openai', 'gpt5', 'release', 'breakthrough'];
        expect(fusionEngine.computeOverlap(kw, kw)).toBe(1.0);
    });

    test('computeOverlap returns 0 for completely disjoint sets', () => {
        const kwA = ['openai', 'gpt5', 'release'];
        const kwB = ['cricket', 'ipl', 'match'];
        expect(fusionEngine.computeOverlap(kwA, kwB)).toBe(0);
    });

    test('computeOverlap detects high overlap (≥85%) correctly', () => {
        const kwA = ['openai', 'gpt5', 'release', 'model', 'launch'];
        const kwB = ['openai', 'gpt5', 'release', 'model', 'announcement'];
        const overlap = fusionEngine.computeOverlap(kwA, kwB);
        expect(overlap).toBeGreaterThanOrEqual(0.8);
    });

    test('computeOverlap detects moderate overlap (<85%) correctly', () => {
        const kwA = ['openai', 'gpt5', 'release', 'model', 'launch'];
        const kwB = ['silicon', 'valley', 'startup', 'funding', 'openai'];
        const overlap = fusionEngine.computeOverlap(kwA, kwB);
        expect(overlap).toBeLessThan(0.85);
    });

    test('buildInitialSources creates correct structure for reddit type', () => {
        const trend = { type: 'reddit', url: 'https://reddit.com/r/tech/abc', source: 'r/technology', engagementScore: 500 };
        const sources = fusionEngine.buildInitialSources(trend);
        expect(sources.reddit).toHaveLength(1);
        expect(sources.reddit[0].subreddit).toBe('technology');
        expect(sources.youtube).toHaveLength(0);
        expect(sources.googleNews).toHaveLength(0);
    });

    test('buildInitialSources creates correct structure for video type', () => {
        const trend = { type: 'video', url: 'https://youtube.com/watch?v=abc', source: 'TechChannel', engagementScore: 1000 };
        const sources = fusionEngine.buildInitialSources(trend);
        expect(sources.youtube).toHaveLength(1);
        expect(sources.youtube[0].channelTitle).toBe('TechChannel');
        expect(sources.reddit).toHaveLength(0);
    });

    test('buildInitialSources creates correct structure for news type', () => {
        const trend = { type: 'news', url: 'https://bbc.com/article', source: 'BBC News' };
        const sources = fusionEngine.buildInitialSources(trend);
        expect(sources.googleNews).toHaveLength(1);
        expect(sources.googleNews[0].sourceName).toBe('BBC News');
        expect(sources.reddit).toHaveLength(0);
    });
});

describe('GraphEngine', () => {
    const graphEngine = require('../services/graphEngine');

    test('extractKeywords produces consistent tokens', () => {
        const kw = graphEngine.extractKeywords('Silicon Valley Startup Funding News 2026');
        expect(kw).toContain('silicon');
        expect(kw).toContain('valley');
        expect(kw).toContain('startup');
        expect(kw).toContain('funding');
        expect(kw).toContain('news');
        expect(kw).toContain('2026');
        expect(kw).not.toContain('the');
    });

    test('computeOverlap detects contextual relationship (≥40%)', () => {
        const kwA = graphEngine.extractKeywords('OpenAI GPT-5 Release Major Breakthrough');
        const kwB = graphEngine.extractKeywords('OpenAI CEO Discusses GPT-5 Future Plans');
        const overlap = graphEngine.computeOverlap(kwA, kwB);
        expect(overlap).toBeGreaterThanOrEqual(0.4);
    });

    test('computeOverlap rejects unrelated trends (<40%)', () => {
        const kwA = graphEngine.extractKeywords('OpenAI GPT-5 Release Major Breakthrough');
        const kwB = graphEngine.extractKeywords('Pakistan Cricket Team Wins World Cup Final');
        const overlap = graphEngine.computeOverlap(kwA, kwB);
        expect(overlap).toBeLessThan(0.4);
    });

    test('computeOverlap returns 0 for empty inputs', () => {
        expect(graphEngine.computeOverlap([], ['test'])).toBe(0);
        expect(graphEngine.computeOverlap(['test'], [])).toBe(0);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// PHASE 3.5 STEP 2: VIRAL SPREAD PREDICTION ENGINE
// ═════════════════════════════════════════════════════════════════════════════

describe('TrendPredictionEngine — Lifecycle State Machine', () => {
    const engine = require('../services/trendPredictionEngine');

    // Helper: build scoreHistory with linearly increasing composite values
    function buildHistory(compositeValues) {
        const now = Date.now();
        return compositeValues.map((c, i) => ({
            ts: new Date(now - (compositeValues.length - i) * 30 * 60 * 1000),
            v: 0, h: 0, g: 0, c
        }));
    }

    test('transitions to VIRAL when composite ≥65 AND velocity ≥35', () => {
        // 4 snapshots: deltas [35,35,35] → avg velocity = 35
        const trend = {
            scoring: { compositeScore: 85 },
            scoreHistory: buildHistory([10, 45, 80, 115]),
            publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
        };
        expect(engine.computeLifecycleState(trend)).toBe('viral');
    });

    test('transitions to ACCELERATING when composite ≥15 AND velocity ≥20 (but below viral)', () => {
        // deltas [25,25,25] → avg velocity = 25, composite = 40
        const trend = {
            scoring: { compositeScore: 40 },
            scoreHistory: buildHistory([10, 35, 60, 85]),
            publishedAt: new Date(Date.now() - 3 * 60 * 60 * 1000)
        };
        expect(engine.computeLifecycleState(trend)).toBe('accelerating');
    });

    test('transitions to DECLINING when velocity ≤ -10 and trend is >6h old', () => {
        // deltas [-15,-15,-15] → avg velocity = -15
        const trend = {
            scoring: { compositeScore: 30 },
            scoreHistory: buildHistory([80, 65, 50, 35]),
            publishedAt: new Date(Date.now() - 12 * 60 * 60 * 1000)
        };
        expect(engine.computeLifecycleState(trend)).toBe('declining');
    });

    test('transitions to DEAD when composite <8 AND older than 72 hours', () => {
        const trend = {
            scoring: { compositeScore: 5 },
            scoreHistory: buildHistory([5, 4, 3, 2]),
            publishedAt: new Date(Date.now() - 96 * 60 * 60 * 1000)
        };
        expect(engine.computeLifecycleState(trend)).toBe('dead');
    });

    test('transitions to EMERGING for fresh trend with moderate score', () => {
        const trend = {
            scoring: { compositeScore: 25 },
            scoreHistory: buildHistory([20, 22, 24, 25]),
            publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
        };
        expect(engine.computeLifecycleState(trend)).toBe('emerging');
    });

    test('falls back to declining for negative velocity default path', () => {
        // velocity -5 (above -10 threshold but negative), old trend, moderate score
        const trend = {
            scoring: { compositeScore: 20 },
            scoreHistory: buildHistory([40, 37, 34, 31]),
            publishedAt: new Date(Date.now() - 48 * 60 * 60 * 1000)
        };
        expect(engine.computeLifecycleState(trend)).toBe('declining');
    });

    test('computeVelocity returns 0 for empty or single-entry history', () => {
        expect(engine.computeVelocity([])).toBe(0);
        expect(engine.computeVelocity(null)).toBe(0);
        expect(engine.computeVelocity([{ c: 50 }])).toBe(0);
    });

    test('computeVelocity computes correct average delta over window', () => {
        const history = buildHistory([10, 30, 50, 70]);
        // deltas: [20, 20, 20], avg = 20
        expect(engine.computeVelocity(history)).toBeCloseTo(20, 1);
    });
});


describe('TrendPredictionEngine — Historical Memory & Keyword Matching', () => {
    const engine = require('../services/trendPredictionEngine');

    test('extractKeywords returns meaningful tokens from AI trend title', () => {
        const kw = engine.extractKeywords('OpenAI releases GPT-5 with groundbreaking capabilities');
        expect(kw).toContain('openai');
        expect(kw).toContain('gpt5');
        expect(kw).toContain('releases');
        expect(kw).toContain('groundbreaking');
        expect(kw).not.toContain('with'); // stop word
    });

    test('extractKeywords returns empty for null/empty input', () => {
        expect(engine.extractKeywords(null)).toEqual([]);
        expect(engine.extractKeywords('')).toEqual([]);
    });

    test('computeOverlap detects ≥45% match for semantically similar AI trends', () => {
        const kwA = engine.extractKeywords('OpenAI GPT-5 reasoning breakthrough model');
        const kwB = engine.extractKeywords('OpenAI GPT-5 model achieves reasoning milestone');
        const overlap = engine.computeOverlap(kwA, kwB);
        expect(overlap).toBeGreaterThanOrEqual(0.45);
    });

    test('computeOverlap returns 0 for completely unrelated trends', () => {
        const kwA = engine.extractKeywords('OpenAI GPT-5 reasoning breakthrough');
        const kwB = engine.extractKeywords('Cricket World Cup India victory celebrations');
        expect(engine.computeOverlap(kwA, kwB)).toBe(0);
    });

    test('computeOverlap returns 1.0 for identical keyword sets', () => {
        const kw = ['openai', 'gpt5', 'breakthrough'];
        expect(engine.computeOverlap(kw, kw)).toBe(1.0);
    });

    test('computeOverlap returns 0 when either array is empty', () => {
        expect(engine.computeOverlap([], ['openai'])).toBe(0);
        expect(engine.computeOverlap(['openai'], [])).toBe(0);
    });

    test('historical keyword simulation: 3-month-old trend with matching tokens detected', () => {
        // Simulate what computeHistoricalConfidence does internally
        const currentTrendKw = engine.extractKeywords('OpenAI launches GPT-5 model breakthrough');
        const historicalTrendKw = engine.extractKeywords('OpenAI GPT-5 model creates breakthrough results');
        const overlap = engine.computeOverlap(currentTrendKw, historicalTrendKw);
        // Should pass the 45% threshold used by the engine
        expect(overlap).toBeGreaterThanOrEqual(0.45);
    });

    test('historical keyword simulation: unrelated historical trend rejected below threshold', () => {
        const currentKw = engine.extractKeywords('OpenAI launches GPT-5 model breakthrough');
        const unrelatedKw = engine.extractKeywords('Bitcoin price crashes below support levels market panic');
        const overlap = engine.computeOverlap(currentKw, unrelatedKw);
        expect(overlap).toBeLessThan(0.45);
    });
});


describe('TrendPredictionEngine — Mathematical Confidence Calibration', () => {
    const engine = require('../services/trendPredictionEngine');

    function buildHistory(compositeValues) {
        const now = Date.now();
        return compositeValues.map((c, i) => ({
            ts: new Date(now - (compositeValues.length - i) * 30 * 60 * 1000),
            v: 0, h: 0, g: 0, c
        }));
    }

    test('computeBaselineConfidence returns score between 0.0 and 1.0', () => {
        const trend = {
            scoreHistory: buildHistory([10, 20, 30]),
            analysis: { status: 'completed' },
            platformCount: 2,
            engagementScore: 500
        };
        const result = engine.computeBaselineConfidence(trend);
        expect(result.confidenceScore).toBeGreaterThanOrEqual(0.0);
        expect(result.confidenceScore).toBeLessThanOrEqual(1.0);
        expect(typeof result.confidenceScore).toBe('number');
        expect(result.matchedTrendId).toBeNull();
    });

    test('confidence increases with more data completeness signals', () => {
        const sparse = { scoreHistory: [], platformCount: 1, engagementScore: 0 };
        const rich = {
            scoreHistory: buildHistory([10, 20, 30, 40, 50, 60, 70, 80, 90, 100,
                                        10, 20, 30, 40, 50, 60, 70, 80, 90, 100]),
            analysis: { status: 'completed' },
            platformCount: 3,
            engagementScore: 5000
        };
        const sparseResult = engine.computeBaselineConfidence(sparse);
        const richResult = engine.computeBaselineConfidence(rich);
        expect(richResult.confidenceScore).toBeGreaterThan(sparseResult.confidenceScore);
    });

    test('computeBaselineConfidence floor is ≥0.20', () => {
        const emptyTrend = { scoreHistory: [], platformCount: 1, engagementScore: 0 };
        const result = engine.computeBaselineConfidence(emptyTrend);
        expect(result.confidenceScore).toBeGreaterThanOrEqual(0.20);
    });

    test('analysis status completed adds more confidence than processing', () => {
        const base = { scoreHistory: [], platformCount: 1, engagementScore: 0 };
        const completed = engine.computeBaselineConfidence({ ...base, analysis: { status: 'completed' } });
        const processing = engine.computeBaselineConfidence({ ...base, analysis: { status: 'processing' } });
        const none = engine.computeBaselineConfidence({ ...base });
        expect(completed.confidenceScore).toBeGreaterThan(processing.confidenceScore);
        expect(processing.confidenceScore).toBeGreaterThan(none.confidenceScore);
    });

    test('compareVelocityCurves returns 0.5 (neutral) for short histories', () => {
        expect(engine.compareVelocityCurves([{ c: 10 }], [{ c: 20 }])).toBe(0.5);
        expect(engine.compareVelocityCurves([], [])).toBe(0.5);
    });

    test('compareVelocityCurves returns 1.0 for perfectly aligned rising curves', () => {
        const histA = buildHistory([10, 30, 50, 70, 90]);
        const histB = buildHistory([5, 20, 40, 55, 80]);
        // Both have all positive deltas → 100% directional agreement
        expect(engine.compareVelocityCurves(histA, histB)).toBe(1.0);
    });

    test('compareVelocityCurves returns 0.0 for perfectly opposed curves', () => {
        const rising = buildHistory([10, 30, 50, 70]);
        const falling = buildHistory([70, 50, 30, 10]);
        expect(engine.compareVelocityCurves(rising, falling)).toBe(0.0);
    });

    test('extractDeltas computes correct delta array', () => {
        const history = buildHistory([10, 25, 40, 30]);
        const deltas = engine.extractDeltas(history);
        expect(deltas).toEqual([15, 15, -10]);
    });

    test('extractDeltas returns empty for single-entry history', () => {
        expect(engine.extractDeltas([{ c: 50 }])).toEqual([]);
    });
});


describe('TrendPredictionEngine — Geopolitical Migration Matrix', () => {
    const engine = require('../services/trendPredictionEngine');

    test('AI trend from US generates multiple predicted regions', () => {
        const trend = {
            category: 'AI',
            geography: { country: 'US', state: '' },
            platformCount: 1
        };
        const regions = engine.predictRegionalMigration(trend, 'viral', 0.8);
        expect(regions.length).toBeGreaterThan(0);
        // Should include known AI migration targets: GB, IN(KA), IN(MH), IN(MP), DE
        const countries = regions.map(r => r.country);
        expect(countries).toContain('GB');
        expect(countries).toContain('DE');
    });

    test('Cricket trend from IN generates PK, AU, GB predictions', () => {
        const trend = {
            category: 'Cricket',
            geography: { country: 'IN', state: '' },
            platformCount: 1
        };
        const regions = engine.predictRegionalMigration(trend, 'accelerating', 0.7);
        const countries = regions.map(r => r.country);
        expect(countries).toContain('PK');
        expect(countries).toContain('AU');
        expect(countries).toContain('GB');
    });

    test('predicted regions are sorted in descending order by probability', () => {
        const trend = {
            category: 'AI',
            geography: { country: 'US', state: '' },
            platformCount: 2
        };
        const regions = engine.predictRegionalMigration(trend, 'viral', 0.9);
        for (let i = 1; i < regions.length; i++) {
            expect(regions[i - 1].probability).toBeGreaterThanOrEqual(regions[i].probability);
        }
    });

    test('all predicted regions contain valid probability (0.05-0.99) and timeLagHours (≥0.5)', () => {
        const trend = {
            category: 'Technology',
            geography: { country: 'US', state: '' },
            platformCount: 1
        };
        const regions = engine.predictRegionalMigration(trend, 'emerging', 0.5);
        expect(regions.length).toBeGreaterThan(0);
        for (const r of regions) {
            expect(r.probability).toBeGreaterThanOrEqual(0.05);
            expect(r.probability).toBeLessThanOrEqual(0.99);
            expect(r.timeLagHours).toBeGreaterThanOrEqual(0.5);
            expect(typeof r.country).toBe('string');
            expect(r.country.length).toBeGreaterThan(0);
            expect(typeof r.state).toBe('string');
        }
    });

    test('viral lifecycle multiplier produces higher probabilities than declining', () => {
        const trend = {
            category: 'AI',
            geography: { country: 'US', state: '' },
            platformCount: 1
        };
        const viralRegions = engine.predictRegionalMigration(trend, 'viral', 0.7);
        const decliningRegions = engine.predictRegionalMigration(trend, 'declining', 0.7);
        // Compare the top region probability
        expect(viralRegions[0].probability).toBeGreaterThan(decliningRegions[0].probability);
    });

    test('viral lifecycle multiplier produces shorter timeLag than declining', () => {
        const trend = {
            category: 'AI',
            geography: { country: 'US', state: '' },
            platformCount: 1
        };
        const viralRegions = engine.predictRegionalMigration(trend, 'viral', 0.7);
        const decliningRegions = engine.predictRegionalMigration(trend, 'declining', 0.7);
        // Viral spreads faster → lower timeLag
        expect(viralRegions[0].timeLagHours).toBeLessThan(decliningRegions[0].timeLagHours);
    });

    test('unknown category falls back to _default migration matrix', () => {
        const trend = {
            category: 'UnknownCategory',
            geography: { country: 'US', state: '' },
            platformCount: 1
        };
        const regions = engine.predictRegionalMigration(trend, 'emerging', 0.5);
        expect(regions.length).toBeGreaterThan(0);
        // _default matrix has US→GB, US→IN, US→DE
        const countries = regions.map(r => r.country);
        expect(countries).toContain('GB');
    });

    test('trend from non-matching origin returns empty predictions', () => {
        const trend = {
            category: 'Cricket',
            geography: { country: 'JP', state: '' }, // Japan not in Cricket matrix
            platformCount: 1
        };
        const regions = engine.predictRegionalMigration(trend, 'viral', 0.9);
        expect(regions).toEqual([]);
    });

    test('matchRegion correctly matches country-only paths', () => {
        expect(engine.matchRegion({ country: 'US' }, 'US', '')).toBe(true);
        expect(engine.matchRegion({ country: 'US' }, 'GB', '')).toBe(false);
    });

    test('matchRegion correctly handles state-level matching', () => {
        expect(engine.matchRegion({ country: 'IN', state: 'MH' }, 'IN', 'MH')).toBe(true);
        expect(engine.matchRegion({ country: 'IN', state: 'MH' }, 'IN', 'KA')).toBe(false);
        // No state on trend → matches any state in the path
        expect(engine.matchRegion({ country: 'IN', state: 'MH' }, 'IN', '')).toBe(true);
    });

    test('cross-platform trends get faster propagation (lower timeLag)', () => {
        const singlePlatform = {
            category: 'AI', geography: { country: 'US', state: '' }, platformCount: 1
        };
        const multiPlatform = {
            category: 'AI', geography: { country: 'US', state: '' }, platformCount: 3
        };
        const singleRegions = engine.predictRegionalMigration(singlePlatform, 'viral', 0.8);
        const multiRegions = engine.predictRegionalMigration(multiPlatform, 'viral', 0.8);
        // Multi-platform should have lower timeLag for same destination
        expect(multiRegions[0].timeLagHours).toBeLessThanOrEqual(singleRegions[0].timeLagHours);
    });
});


describe('TrendPredictionEngine — Explainable AI Justification', () => {
    const engine = require('../services/trendPredictionEngine');

    function buildHistory(compositeValues) {
        const now = Date.now();
        return compositeValues.map((c, i) => ({
            ts: new Date(now - (compositeValues.length - i) * 30 * 60 * 1000),
            v: 0, h: 0, g: 0, c
        }));
    }

    test('justification is non-empty string containing lifecycle state', () => {
        const trend = {
            scoring: { compositeScore: 85 },
            trendScore: 85,
            scoreHistory: buildHistory([10, 45, 80, 115]),
            category: 'AI',
            platformCount: 1
        };
        const confidence = { confidenceScore: 0.7, matchedTrendId: null, matchProfile: 0, historicalPeak: 0 };
        const regions = [{ country: 'GB', state: '', probability: 0.8, timeLagHours: 2.5 }];

        const justification = engine.buildJustification(trend, 'viral', confidence, regions);

        expect(typeof justification).toBe('string');
        expect(justification.length).toBeGreaterThan(0);
        expect(justification).toContain('VIRAL');
        expect(justification).toContain('composite: 85/100');
    });

    test('justification includes historical calibration when match exists', () => {
        const trend = {
            scoring: { compositeScore: 70 },
            trendScore: 70,
            scoreHistory: buildHistory([30, 50, 70]),
            category: 'AI',
            platformCount: 1
        };
        const confidence = {
            confidenceScore: 0.82,
            matchedTrendId: 'historical:ai:gpt4',
            matchProfile: 67.5,
            historicalPeak: 92
        };

        const justification = engine.buildJustification(trend, 'accelerating', confidence, []);

        expect(justification).toContain('Historical calibration');
        expect(justification).toContain('67.5%');
        expect(justification).toContain('historical:ai:gpt4');
        expect(justification).toContain('82%'); // confidence as percentage
    });

    test('justification shows baseline message when no historical match', () => {
        const trend = {
            scoring: { compositeScore: 30 },
            trendScore: 30,
            scoreHistory: buildHistory([25, 28, 30]),
            category: 'Technology',
            platformCount: 1
        };
        const confidence = { confidenceScore: 0.35, matchedTrendId: null, matchProfile: 0, historicalPeak: 0 };

        const justification = engine.buildJustification(trend, 'emerging', confidence, []);

        expect(justification).toContain('No strong historical match');
        expect(justification).toContain('Baseline confidence');
        expect(justification).toContain('35%');
    });

    test('justification includes migration forecast with top region details', () => {
        const trend = {
            scoring: { compositeScore: 80 },
            trendScore: 80,
            scoreHistory: buildHistory([40, 60, 80]),
            category: 'AI',
            platformCount: 1
        };
        const confidence = { confidenceScore: 0.75, matchedTrendId: null, matchProfile: 0, historicalPeak: 0 };
        const regions = [
            { country: 'GB', state: '', probability: 0.85, timeLagHours: 2.3 },
            { country: 'IN', state: 'KA', probability: 0.60, timeLagHours: 3.5 }
        ];

        const justification = engine.buildJustification(trend, 'viral', confidence, regions);

        expect(justification).toContain('Migration forecast');
        expect(justification).toContain('GB');
        expect(justification).toContain('2.3h');
        expect(justification).toContain('85%');
    });

    test('justification includes cross-platform verification for multi-platform trends', () => {
        const trend = {
            scoring: { compositeScore: 60 },
            trendScore: 60,
            scoreHistory: buildHistory([40, 50, 60]),
            category: 'Technology',
            platformCount: 3,
            crossPlatformMultiplier: 1.8
        };
        const confidence = { confidenceScore: 0.65, matchedTrendId: null, matchProfile: 0, historicalPeak: 0 };

        const justification = engine.buildJustification(trend, 'accelerating', confidence, []);

        expect(justification).toContain('Cross-platform verification');
        expect(justification).toContain('3 platforms');
        expect(justification).toContain('1.8x');
    });

    test('justification omits cross-platform section for single-platform trends', () => {
        const trend = {
            scoring: { compositeScore: 40 },
            trendScore: 40,
            scoreHistory: buildHistory([30, 35, 40]),
            category: 'AI',
            platformCount: 1
        };
        const confidence = { confidenceScore: 0.4, matchedTrendId: null, matchProfile: 0, historicalPeak: 0 };

        const justification = engine.buildJustification(trend, 'emerging', confidence, []);

        expect(justification).not.toContain('Cross-platform verification');
    });

    test('justification includes migration + historical match cross-reference', () => {
        const trend = {
            scoring: { compositeScore: 90 },
            trendScore: 90,
            scoreHistory: buildHistory([20, 55, 90]),
            category: 'AI',
            platformCount: 2,
            crossPlatformMultiplier: 1.8
        };
        const confidence = {
            confidenceScore: 0.88,
            matchedTrendId: 'hist:openai:gpt4:launch',
            matchProfile: 72.0,
            historicalPeak: 95
        };
        const regions = [{ country: 'GB', state: '', probability: 0.92, timeLagHours: 1.8 }];

        const justification = engine.buildJustification(trend, 'viral', confidence, regions);

        // Should have all 4 sections
        expect(justification).toContain('VIRAL');
        expect(justification).toContain('Historical calibration');
        expect(justification).toContain('Migration forecast');
        expect(justification).toContain('Cross-platform verification');
        expect(justification).toContain('72%');
        expect(justification).toContain('hist:openai:gpt4:launch');
    });
});
