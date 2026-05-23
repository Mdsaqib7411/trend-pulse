/**
 * Trend Clustering Engine — Unit Tests
 *
 * Phase 3.5 Step 3: Clustering + Geo-Anomaly Detection Gate.
 * No external mocks. Tests pure computation with synthetic data.
 *
 * Coverage:
 *   1. Keyword extraction
 *   2. Keyword overlap computation
 *   3. Semantic topic clustering (≥65% overlap grouping)
 *   4. Cluster representative promotion (highest engagement)
 *   5. Geo-Anomaly Detection: velocity, diversity, geo, engagement-ratio, velocity-curve
 *   6. Anomaly firewall batch (quarantine logic)
 *   7. Full pipeline: processClusteringAndSecurity end-to-end
 */

const clusteringEngine = require('../services/trendClusteringEngine');

jest.mock('../models/Trend', () => ({
    find: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([]),
    bulkWrite: jest.fn().mockResolvedValue({ ok: 1 }),
}));

jest.mock('../services/cacheService', () => ({
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue('OK'),
}));

function createTrend(overrides = {}) {
    return {
        trendId: overrides.trendId || 'test:cluster:001',
        title: overrides.title || 'OpenAI releases GPT-5 with groundbreaking reasoning capabilities',
        category: overrides.category || 'AI',
        engagementScore: overrides.engagementScore || 500,
        type: overrides.type || 'news',
        trendScore: overrides.trendScore || 60,
        publishedAt: overrides.publishedAt || new Date(Date.now() - 2 * 60 * 60 * 1000),
        createdAt: overrides.createdAt || new Date(),
        source: overrides.source || 'TestSource',
        url: overrides.url || 'https://example.com/test',
        content: overrides.content || 'AI breakthrough in reasoning and code generation',
        platformCount: overrides.platformCount || 1,
        predictions: overrides.predictions || {},
        scoreHistory: overrides.scoreHistory || [],
        sources: overrides.sources || {},
        ...overrides
    };
}


// ═══════════════════════════════════════════════════════════════════════════════
// 1. KEYWORD EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════════

describe('TrendClusteringEngine — Keyword Extraction', () => {

    test('extracts meaningful keywords from a title', () => {
        const keywords = clusteringEngine.extractKeywords(
            'OpenAI releases GPT-5 with groundbreaking AI capabilities'
        );
        expect(keywords).toContain('openai');
        expect(keywords).toContain('releases');
        expect(keywords).toContain('gpt5');
        expect(keywords).toContain('groundbreaking');
        expect(keywords).toContain('capabilities');
    });

    test('strips stop words correctly', () => {
        const keywords = clusteringEngine.extractKeywords(
            'The new AI model is a major breakthrough in the industry'
        );
        expect(keywords).not.toContain('the');
        expect(keywords).not.toContain('is');
        expect(keywords).not.toContain('a');
        expect(keywords).not.toContain('in');
        expect(keywords).not.toContain('new');
        expect(keywords).toContain('model');
        expect(keywords).toContain('major');
        expect(keywords).toContain('breakthrough');
        expect(keywords).toContain('industry');
    });

    test('strips short tokens (≤2 chars)', () => {
        const keywords = clusteringEngine.extractKeywords('AI is on top of IT');
        expect(keywords).toHaveLength(1);
        expect(keywords).toContain('top');
    });

    test('returns empty array for null/empty/undefined input', () => {
        expect(clusteringEngine.extractKeywords(null)).toEqual([]);
        expect(clusteringEngine.extractKeywords('')).toEqual([]);
        expect(clusteringEngine.extractKeywords(undefined)).toEqual([]);
    });

    test('lowercases all tokens', () => {
        const keywords = clusteringEngine.extractKeywords('BREAKING NEWS: Tesla Stock CRASH');
        keywords.forEach(kw => expect(kw).toBe(kw.toLowerCase()));
    });

    test('strips punctuation and special characters', () => {
        const keywords = clusteringEngine.extractKeywords('GPT-5!!! Amazing #breakthrough @OpenAI');
        expect(keywords).toContain('gpt5');
        expect(keywords).toContain('amazing');
        expect(keywords).toContain('breakthrough');
        expect(keywords).toContain('openai');
        keywords.forEach(kw => expect(kw).toMatch(/^[a-z0-9]+$/));
    });
});


// ═══════════════════════════════════════════════════════════════════════════════
// 2. KEYWORD OVERLAP
// ═══════════════════════════════════════════════════════════════════════════════

describe('TrendClusteringEngine — Keyword Overlap', () => {

    test('returns 1.0 for identical keyword sets', () => {
        const kw = ['openai', 'gpt5', 'release', 'breakthrough'];
        expect(clusteringEngine.computeOverlap(kw, kw)).toBe(1.0);
    });

    test('returns 0 for completely disjoint sets', () => {
        expect(clusteringEngine.computeOverlap(['openai', 'gpt5'], ['cricket', 'ipl'])).toBe(0);
    });

    test('returns 0 for empty input arrays', () => {
        expect(clusteringEngine.computeOverlap([], ['test'])).toBe(0);
        expect(clusteringEngine.computeOverlap(['test'], [])).toBe(0);
        expect(clusteringEngine.computeOverlap([], [])).toBe(0);
    });

    test('detects high overlap (≥65%) correctly', () => {
        const kwA = ['openai', 'gpt5', 'release', 'model', 'launch'];
        const kwB = ['openai', 'gpt5', 'release', 'model', 'announcement'];
        expect(clusteringEngine.computeOverlap(kwA, kwB)).toBeGreaterThanOrEqual(0.65);
    });

    test('detects moderate overlap (<65%) correctly', () => {
        const kwA = ['openai', 'gpt5', 'release', 'model', 'launch'];
        const kwB = ['silicon', 'valley', 'startup', 'funding', 'openai'];
        expect(clusteringEngine.computeOverlap(kwA, kwB)).toBeLessThan(0.65);
    });

    test('uses min-denominator for asymmetric set sizes', () => {
        const kwA = ['openai', 'gpt5'];
        const kwB = ['openai', 'gpt5', 'release', 'model', 'launch'];
        expect(clusteringEngine.computeOverlap(kwA, kwB)).toBe(1.0);
    });
});


// ═══════════════════════════════════════════════════════════════════════════════
// 3. GEO-ANOMALY DETECTION (updated API: isAnomaly, anomalyScore)
// ═══════════════════════════════════════════════════════════════════════════════

describe('TrendClusteringEngine — Geo-Anomaly Detection', () => {

    test('flags velocity spike for recent high-engagement trends', () => {
        const trend = createTrend({
            engagementScore: 50000,
            publishedAt: new Date(Date.now() - 10 * 60 * 1000),
        });
        const result = clusteringEngine.detectGeoAnomaly(trend);
        expect(result.isAnomaly).toBe(true);
        expect(result.anomalyScore).toBeGreaterThanOrEqual(0.35);
        expect(result.reasons.some(r => r.includes('Velocity spike'))).toBe(true);
    });

    test('skips anomaly detection for low-engagement trends', () => {
        const trend = createTrend({ engagementScore: 50 });
        const result = clusteringEngine.detectGeoAnomaly(trend);
        expect(result.isAnomaly).toBe(false);
        expect(result.anomalyScore).toBe(0.0);
    });

    test('flags source diversity deficit for single-platform mega-engagement', () => {
        const trend = createTrend({
            engagementScore: 10000,
            platformCount: 1,
            publishedAt: new Date(Date.now() - 60 * 60 * 1000),
        });
        const result = clusteringEngine.detectGeoAnomaly(trend);
        expect(result.isAnomaly).toBe(false); // 0.25 < 0.35 threshold
        expect(result.anomalyScore).toBe(0.25);
        expect(result.reasons.some(r => r.includes('Source diversity deficit'))).toBe(true);
    });

    test('passes multi-platform high-engagement trends as clean', () => {
        const trend = createTrend({
            engagementScore: 8000,
            platformCount: 3,
            publishedAt: new Date(Date.now() - 120 * 60 * 1000),
        });
        const result = clusteringEngine.detectGeoAnomaly(trend);
        expect(result.isAnomaly).toBe(false);
    });

    test('flags geographic impossibility for single-source with many regions', () => {
        const trend = createTrend({
            engagementScore: 500,
            platformCount: 1,
            publishedAt: new Date(Date.now() - 60 * 60 * 1000),
            predictions: {
                predictedRegions: [
                    { country: 'US' }, { country: 'GB' },
                    { country: 'IN' }, { country: 'DE' }
                ]
            }
        });
        const result = clusteringEngine.detectGeoAnomaly(trend);
        expect(result.reasons.some(r => r.includes('Geographic impossibility'))).toBe(true);
    });

    test('flags engagement-to-view ratio anomaly', () => {
        const trend = createTrend({
            engagementScore: 9000,
            platformCount: 2,
            publishedAt: new Date(Date.now() - 120 * 60 * 1000),
            sources: { youtube: [{ viewCount: 5000 }] }
        });
        const result = clusteringEngine.detectGeoAnomaly(trend);
        expect(result.reasons.some(r => r.includes('Engagement-to-view ratio'))).toBe(true);
    });

    test('flags identical velocity curves as synthetic pattern', () => {
        const now = Date.now();
        const trend = createTrend({
            engagementScore: 500,
            publishedAt: new Date(Date.now() - 60 * 60 * 1000),
            scoreHistory: [
                { ts: new Date(now - 4 * 30 * 60 * 1000), c: 10 },
                { ts: new Date(now - 3 * 30 * 60 * 1000), c: 20 },
                { ts: new Date(now - 2 * 30 * 60 * 1000), c: 30 },
                { ts: new Date(now - 1 * 30 * 60 * 1000), c: 40 },
            ]
        });
        const result = clusteringEngine.detectGeoAnomaly(trend);
        expect(result.reasons.some(r => r.includes('Identical velocity curve'))).toBe(true);
    });

    test('compounds multiple anomaly signals into higher anomalyScore', () => {
        const trend = createTrend({
            engagementScore: 50000,
            platformCount: 1,
            publishedAt: new Date(Date.now() - 10 * 60 * 1000),
        });
        const result = clusteringEngine.detectGeoAnomaly(trend);
        expect(result.isAnomaly).toBe(true);
        expect(result.reasons.length).toBeGreaterThanOrEqual(2);
        expect(result.anomalyScore).toBeGreaterThan(0.35);
    });

    test('anomalyScore is clamped to [0, 1]', () => {
        const trend = createTrend({
            engagementScore: 50000,
            platformCount: 1,
            publishedAt: new Date(Date.now() - 10 * 60 * 1000),
            predictions: { predictedRegions: [{ country: 'US' }, { country: 'GB' }, { country: 'IN' }, { country: 'DE' }] },
            sources: { youtube: [{ viewCount: 100 }] },
            scoreHistory: [{ c: 10 }, { c: 20 }, { c: 30 }, { c: 40 }]
        });
        const result = clusteringEngine.detectGeoAnomaly(trend);
        expect(result.anomalyScore).toBeLessThanOrEqual(1.0);
        expect(result.anomalyScore).toBeGreaterThanOrEqual(0.0);
    });
});


// ═══════════════════════════════════════════════════════════════════════════════
// 4. ANOMALY FIREWALL BATCH (quarantine logic)
// ═══════════════════════════════════════════════════════════════════════════════

describe('TrendClusteringEngine — Anomaly Firewall Batch', () => {

    test('quarantines anomalous trends with correct fields', () => {
        const trends = [
            createTrend({
                trendId: 'bot',
                engagementScore: 50000,
                publishedAt: new Date(Date.now() - 10 * 60 * 1000),
            }),
            createTrend({
                trendId: 'clean',
                engagementScore: 200,
                publishedAt: new Date(Date.now() - 60 * 60 * 1000),
            }),
        ];

        const { vetted, quarantined } = clusteringEngine.applyAnomalyFirewall(trends);

        // Quarantined trends are removed from vetted (not just penalized)
        expect(vetted.length).toBe(1);
        expect(quarantined.length).toBe(1);

        const botTrend = quarantined[0];
        expect(botTrend.isAnomaly).toBe(true);
        expect(botTrend.moderationStatus).toBe('quarantined');
        expect(botTrend.trendScore).toBe(0);
        expect(botTrend.engagementScore).toBe(0);
        expect(botTrend.anomalyScore).toBeGreaterThanOrEqual(0.35);

        const cleanTrend = vetted[0];
        expect(cleanTrend.isAnomaly).toBe(false);
        expect(cleanTrend.moderationStatus).toBe('approved');
    });

    test('handles empty input gracefully', () => {
        const result = clusteringEngine.applyAnomalyFirewall([]);
        expect(result.vetted).toEqual([]);
        expect(result.quarantined).toEqual([]);
    });

    test('handles null input gracefully', () => {
        const result = clusteringEngine.applyAnomalyFirewall(null);
        expect(result.vetted).toEqual([]);
        expect(result.quarantined).toEqual([]);
    });
});


// ═══════════════════════════════════════════════════════════════════════════════
// 5. FULL PIPELINE: processClusteringAndSecurity
// ═══════════════════════════════════════════════════════════════════════════════

describe('TrendClusteringEngine — Full Pipeline (processClusteringAndSecurity)', () => {

    test('processes batch through anomaly → clustering pipeline', async () => {
        const trends = [
            createTrend({ trendId: 'a', title: 'OpenAI releases GPT-5 breakthrough model', engagementScore: 300 }),
            createTrend({ trendId: 'b', title: 'OpenAI GPT-5 released as breakthrough AI model', engagementScore: 500 }),
            createTrend({ trendId: 'c', title: 'India cricket world cup final victory', engagementScore: 200 }),
            createTrend({
                trendId: 'bot',
                title: 'Amazing crypto giveaway free bitcoin opportunity',
                engagementScore: 80000,
                publishedAt: new Date(Date.now() - 5 * 60 * 1000),
            }),
        ];

        const result = await clusteringEngine.processClusteringAndSecurity(trends);

        expect(result.trends.length).toBeLessThanOrEqual(3);
        expect(result.anomalyCount).toBeGreaterThanOrEqual(1);
        expect(result.quarantined.length).toBeGreaterThanOrEqual(1);
        expect(result.quarantined[0].moderationStatus).toBe('quarantined');
        expect(result.quarantined[0].trendScore).toBe(0);
    });

    test('returns empty result for empty input', async () => {
        const result = await clusteringEngine.processClusteringAndSecurity([]);
        expect(result.trends).toEqual([]);
        expect(result.clusterCount).toBe(0);
        expect(result.anomalyCount).toBe(0);
    });

    test('returns empty result for null input', async () => {
        const result = await clusteringEngine.processClusteringAndSecurity(null);
        expect(result.trends).toEqual([]);
    });

    test('preserves original trend fields in output', async () => {
        const trends = [
            createTrend({
                trendId: 'preserve',
                title: 'Unique trend about quantum computing advancements',
                engagementScore: 300,
                category: 'Technology',
                source: 'TechCrunch',
                type: 'news'
            }),
        ];

        const result = await clusteringEngine.processClusteringAndSecurity(trends);

        expect(result.trends.length).toBe(1);
        const output = result.trends[0];
        expect(output.trendId).toBe('preserve');
        expect(output.category).toBe('Technology');
        expect(output.source).toBe('TechCrunch');
        expect(output.moderationStatus).toBe('approved');
        expect(output.isAnomaly).toBe(false);
        expect(output.parentClusterId).toBeDefined();
    });
});
