/**
 * Trend Clustering Engine — Semantic Topic Clustering & Geo-Anomaly Detection.
 *
 * Phase 3.5 Step 3:
 *   1. Semantic Clustering: Compares incoming trends against active DB trends
 *      from the last 24 hours using keyword overlap (≥65%). Groups duplicates
 *      under a `parentClusterId` to prevent feed clutter.
 *   2. Geo-Anomaly Detection Gate: Inspects regional velocity spikes, engagement
 *      velocity curves, cross-platform source distribution, and engagement-to-view
 *      ratios to detect bot attacks or coordinated reposting. Quarantines flagged
 *      trends by zeroing composite score and setting moderationStatus: 'quarantined'.
 *
 * Pipeline position: AFTER platformFusionEngine (Step 3.6), BEFORE applyRanking.
 * Entry point: processClusteringAndSecurity(batch)
 */

const Trend = require('../models/Trend');
const cacheService = require('./cacheService');
const logger = require('./loggerService');

// ─── Configuration ──────────────────────────────────────────────────────────
const CLUSTER_OVERLAP_THRESHOLD = 0.65;
const CLUSTER_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const CLUSTER_CACHE_TTL = 180; // 3 min cache for active cluster index

// ─── Anomaly Detection Thresholds ───────────────────────────────────────────
const ANOMALY = {
    MAX_VELOCITY_PER_MINUTE: 500,
    MIN_AGE_MINUTES: 5,
    MIN_ENGAGEMENT_FOR_CHECK: 100,
    MIN_PLATFORMS_FOR_HIGH_ENG: 2,
    HIGH_ENGAGEMENT_THRESHOLD: 5000,
    MAX_REGIONS_SINGLE_SOURCE: 3,
    ENGAGEMENT_VIEW_RATIO_CEILING: 0.85,
    QUARANTINE_SCORE: 0
};

// ─── Stop Words ─────────────────────────────────────────────────────────────
const STOP_WORDS = new Set([
    'the','a','an','is','are','was','were','be','been','being','have','has',
    'had','do','does','did','will','would','could','should','may','might',
    'shall','can','need','dare','ought','used','to','of','in','for','on',
    'with','at','by','from','up','about','into','through','during','before',
    'after','above','below','between','out','off','over','under','again',
    'further','then','once','here','there','when','where','why','how','all',
    'each','every','both','few','more','most','other','some','such','no',
    'nor','not','only','own','same','so','than','too','very','just','and',
    'but','or','if','while','as','that','this','it','its','what','which',
    'who','whom','these','those','am','he','she','we','they','me','him',
    'her','us','them','my','his','your','our','their','new','says','said','also'
]);


class TrendClusteringEngine {

    // ─── 1. KEYWORD EXTRACTION ──────────────────────────────────────────────

    extractKeywords(text) {
        if (!text) return [];
        return text
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .split(/\s+/)
            .filter(w => w.length > 2 && !STOP_WORDS.has(w));
    }

    computeOverlap(kwA, kwB) {
        if (kwA.length === 0 || kwB.length === 0) return 0;
        const setA = new Set(kwA);
        const setB = new Set(kwB);
        let intersection = 0;
        for (const w of setA) {
            if (setB.has(w)) intersection++;
        }
        return intersection / Math.min(setA.size, setB.size);
    }


    // ─── 2. DB-BACKED SEMANTIC CLUSTERING (24-HOUR WINDOW) ──────────────────

    /**
     * Fetch active trends from the last 24 hours to use as the cluster index.
     * Results are cached in Redis for 3 minutes to avoid repeated DB hits.
     */
    async getActiveClusterIndex() {
        const cacheKey = 'trendpulse:cluster_index';
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached;

        const windowStart = new Date(Date.now() - CLUSTER_WINDOW_MS);
        const activeTrends = await Trend.find(
            { createdAt: { $gte: windowStart }, moderationStatus: { $ne: 'quarantined' } },
            { trendId: 1, title: 1, engagementScore: 1, trendScore: 1, parentClusterId: 1 }
        ).sort({ trendScore: -1 }).limit(200).lean();

        // Pre-compute keywords for each active trend
        const index = activeTrends.map(t => ({
            trendId: t.trendId,
            title: t.title,
            keywords: this.extractKeywords(t.title),
            engagementScore: t.engagementScore || 0,
            trendScore: t.trendScore || 0,
            parentClusterId: t.parentClusterId || null
        }));

        await cacheService.setex(cacheKey, CLUSTER_CACHE_TTL, index);
        return index;
    }

    /**
     * Cluster a batch of incoming trends against:
     *   1. Active DB trends from the 24-hour window
     *   2. Other trends within the same incoming batch
     *
     * If ≥65% keyword overlap is found, the incoming trend gets:
     *   - parentClusterId set to the existing trend's trendId
     *   - Marked as a cluster member (filtered from main feed)
     *
     * Only cluster representatives (highest engagement) pass through.
     */
    async clusterByTopic(trends) {
        if (!trends || trends.length === 0) {
            return { representatives: [], clustered: [], clusterMap: new Map() };
        }

        let activeIndex = [];
        try {
            activeIndex = await this.getActiveClusterIndex();
        } catch (err) {
            logger.error('[ClusteringEngine] Failed to load cluster index: %s', err.message);
        }

        // Build a combined comparison pool: DB trends + batch-internal
        const clusters = [];
        const clusterMap = new Map();
        const trendKeywords = trends.map(t => this.extractKeywords(t.title));

        for (let i = 0; i < trends.length; i++) {
            const trend = trends[i];
            const keywords = trendKeywords[i];

            if (keywords.length === 0) {
                const clusterId = trend.trendId || trend.url || `cluster_${i}`;
                clusters.push({ repIndex: i, repId: clusterId, keywords, members: [] });
                continue;
            }

            let matchedCluster = null;
            let bestOverlap = 0;

            // Phase A: Check against existing DB trends (24h window)
            for (const active of activeIndex) {
                if (active.keywords.length === 0) continue;
                const overlap = this.computeOverlap(keywords, active.keywords);
                if (overlap >= CLUSTER_OVERLAP_THRESHOLD && overlap > bestOverlap) {
                    bestOverlap = overlap;
                    // Assign to the existing DB trend as parent
                    trend.parentClusterId = active.parentClusterId || active.trendId;
                    matchedCluster = 'db_match';
                }
            }

            // Phase B: Check against earlier trends in this batch
            if (!matchedCluster) {
                for (const cluster of clusters) {
                    const overlap = this.computeOverlap(keywords, cluster.keywords);
                    if (overlap >= CLUSTER_OVERLAP_THRESHOLD && overlap > bestOverlap) {
                        bestOverlap = overlap;
                        matchedCluster = cluster;
                    }
                }
            }

            if (matchedCluster === 'db_match') {
                // Trend matched a DB parent — still include but tagged
                clusters.push({ repIndex: i, repId: trend.parentClusterId, keywords, members: [], isDbChild: true });
            } else if (matchedCluster && matchedCluster !== 'db_match') {
                matchedCluster.members.push(i);
                // Promote higher-engagement trend as representative
                const currentRep = trends[matchedCluster.repIndex];
                if ((trend.engagementScore || 0) > (currentRep.engagementScore || 0)) {
                    matchedCluster.members.push(matchedCluster.repIndex);
                    matchedCluster.members = matchedCluster.members.filter(idx => idx !== i);
                    matchedCluster.repIndex = i;
                    matchedCluster.repId = trend.trendId || trend.url || `cluster_${i}`;
                    matchedCluster.keywords = keywords;
                }
            } else {
                const clusterId = trend.trendId || trend.url || `cluster_${i}`;
                clusters.push({ repIndex: i, repId: clusterId, keywords, members: [] });
            }
        }

        // Build output
        const representatives = [];
        const clustered = [];

        for (const cluster of clusters) {
            const rep = { ...trends[cluster.repIndex] };
            rep.parentClusterId = rep.parentClusterId || cluster.repId;
            rep.clusterSize = 1 + cluster.members.length;
            rep.moderationStatus = rep.moderationStatus || 'approved';
            representatives.push(rep);

            for (const memberIdx of cluster.members) {
                const member = { ...trends[memberIdx] };
                member.parentClusterId = cluster.repId;
                member.moderationStatus = member.moderationStatus || 'approved';
                clustered.push(member);
            }

            clusterMap.set(cluster.repId, {
                representative: rep,
                members: cluster.members.map(idx => trends[idx])
            });
        }

        if (clustered.length > 0) {
            logger.info(`[ClusteringEngine] Clustered ${trends.length} trends → ${representatives.length} clusters (${clustered.length} duplicates absorbed).`);
        }

        return { representatives, clustered, clusterMap };
    }


    // ─── 3. GEO-ANOMALY DETECTION GATE ──────────────────────────────────────

    /**
     * Inspect a single trend for structural signs of bot attacks,
     * automated syndication, or coordinated reposting patterns.
     *
     * Signals checked:
     *   1. Velocity Spike — engagement/minute exceeds ceiling
     *   2. Source Diversity Deficit — mega-engagement from single platform
     *   3. Geographic Impossibility — too many regions for single-source trend
     *   4. Engagement-to-View Ratio — abnormally high ratio (synthetic likes)
     *   5. Identical Velocity Curves — zero variance in scoreHistory deltas
     *
     * @returns {{ isAnomaly: boolean, anomalyScore: number, reasons: string[] }}
     */
    detectGeoAnomaly(trend) {
        const reasons = [];
        let anomalyScore = 0.0; // 0.0 = clean, 1.0 = confirmed bot

        const engagement = trend.engagementScore || 0;
        const publishedAt = trend.publishedAt ? new Date(trend.publishedAt) : new Date();
        const ageMinutes = Math.max(1, (Date.now() - publishedAt.getTime()) / (1000 * 60));
        const platformCount = trend.platformCount || 1;

        // Skip low-engagement trends
        if (engagement < ANOMALY.MIN_ENGAGEMENT_FOR_CHECK) {
            return { isAnomaly: false, anomalyScore: 0.0, reasons: [] };
        }

        // ── Signal 1: Velocity Spike ──────────────────────────────────────
        if (ageMinutes >= ANOMALY.MIN_AGE_MINUTES) {
            const velocity = engagement / ageMinutes;
            if (velocity > ANOMALY.MAX_VELOCITY_PER_MINUTE) {
                reasons.push(`Velocity spike: ${Math.round(velocity)} eng/min (ceiling: ${ANOMALY.MAX_VELOCITY_PER_MINUTE})`);
                anomalyScore += 0.35;
            }
        }

        // ── Signal 2: Source Diversity Deficit ────────────────────────────
        if (engagement >= ANOMALY.HIGH_ENGAGEMENT_THRESHOLD &&
            platformCount < ANOMALY.MIN_PLATFORMS_FOR_HIGH_ENG) {
            reasons.push(`Source diversity deficit: ${engagement} engagement from ${platformCount} platform(s)`);
            anomalyScore += 0.25;
        }

        // ── Signal 3: Geographic Impossibility ───────────────────────────
        const predictedRegions = trend.predictions?.predictedRegions || [];
        if (platformCount <= 1 && predictedRegions.length > ANOMALY.MAX_REGIONS_SINGLE_SOURCE) {
            reasons.push(`Geographic impossibility: ${predictedRegions.length} regions from single source`);
            anomalyScore += 0.15;
        }

        // ── Signal 4: Engagement-to-View Ratio Anomaly ───────────────────
        const viewCount = trend.sources?.youtube?.[0]?.viewCount || 0;
        if (viewCount > 0 && engagement > 0) {
            const ratio = engagement / viewCount;
            if (ratio > ANOMALY.ENGAGEMENT_VIEW_RATIO_CEILING) {
                reasons.push(`Engagement-to-view ratio anomaly: ${ratio.toFixed(2)} (ceiling: ${ANOMALY.ENGAGEMENT_VIEW_RATIO_CEILING})`);
                anomalyScore += 0.15;
            }
        }

        // ── Signal 5: Identical Velocity Curves (zero variance) ──────────
        const history = trend.scoreHistory || [];
        if (history.length >= 4) {
            const deltas = [];
            for (let i = 1; i < history.length; i++) {
                deltas.push((history[i].c || 0) - (history[i - 1].c || 0));
            }
            const allIdentical = deltas.length > 2 && deltas.every(d => d === deltas[0]);
            if (allIdentical && deltas[0] !== 0) {
                reasons.push(`Identical velocity curve: all ${deltas.length} deltas = ${deltas[0]} (synthetic pattern)`);
                anomalyScore += 0.10;
            }
        }

        // Clamp to [0, 1]
        anomalyScore = parseFloat(Math.min(1.0, anomalyScore).toFixed(2));
        const isAnomaly = anomalyScore >= 0.35;

        if (isAnomaly) {
            logger.warn(`[ClusteringEngine] 🚨 ANOMALY DETECTED in "${(trend.title || '').substring(0, 45)}..." | score: ${anomalyScore} | ${reasons.join('; ')}`);
        }

        return { isAnomaly, anomalyScore, reasons };
    }

    /**
     * Apply the anomaly firewall to a batch. Quarantined trends get:
     *   - isAnomaly: true
     *   - anomalyScore: 0.0–1.0
     *   - moderationStatus: 'quarantined'
     *   - trendScore: 0 (zeroed composite)
     *   - engagementScore: 0
     */
    applyAnomalyFirewall(trends) {
        if (!trends || trends.length === 0) {
            return { vetted: [], quarantined: [] };
        }

        const vetted = [];
        const quarantined = [];

        for (const trend of trends) {
            const result = this.detectGeoAnomaly(trend);

            if (result.isAnomaly) {
                const flagged = { ...trend };
                flagged.isAnomaly = true;
                flagged.anomalyScore = result.anomalyScore;
                flagged.moderationStatus = 'quarantined';
                flagged.trendScore = ANOMALY.QUARANTINE_SCORE;
                flagged.engagementScore = 0;
                flagged._anomalyReasons = result.reasons;

                quarantined.push(flagged);
                logger.error(`[ClusteringEngine] QUARANTINED: "${(flagged.title || '').substring(0, 40)}..." | anomalyScore: ${result.anomalyScore} | Reasons: ${result.reasons.join('; ')}`);
            } else {
                const clean = { ...trend };
                clean.isAnomaly = false;
                clean.anomalyScore = result.anomalyScore;
                clean.moderationStatus = 'approved';
                vetted.push(clean);
            }
        }

        if (quarantined.length > 0) {
            logger.warn(`[ClusteringEngine] Anomaly firewall: ${quarantined.length}/${trends.length} trends quarantined.`);
        }

        return { vetted, quarantined };
    }


    // ─── 4. MAIN ENTRY: processClusteringAndSecurity ────────────────────────

    /**
     * Full pipeline entry point — called from trendAggregator after fusion.
     *
     *   1. Geo-Anomaly Detection → quarantine suspicious trends
     *   2. Semantic Clustering → deduplicate via 24h DB + batch comparison
     *   3. Return clean, clustered representatives
     *
     * @param {Array} trends — Post-fusion trend array
     * @returns {{ trends: Array, clusterCount: number, anomalyCount: number, quarantined: Array, clusterMap: Map }}
     */
    async processClusteringAndSecurity(trends) {
        if (!trends || trends.length === 0) {
            return { trends: [], clusterCount: 0, anomalyCount: 0, quarantined: [], clusterMap: new Map() };
        }

        // Step 1: Anomaly firewall — quarantine bot/synthetic trends
        const { vetted, quarantined } = this.applyAnomalyFirewall(trends);

        // Persist quarantined trends to DB for audit trail (fire-and-forget)
        if (quarantined.length > 0) {
            this.persistQuarantined(quarantined).catch(err =>
                logger.error('[ClusteringEngine] Failed to persist quarantined trends: %s', err.message)
            );
        }

        // Step 2: Semantic clustering on vetted (non-quarantined) trends
        const { representatives, clustered, clusterMap } = await this.clusterByTopic(vetted);

        logger.info(`[ClusteringEngine] Pipeline complete: ${trends.length} input → ${representatives.length} output (${clustered.length} clustered, ${quarantined.length} quarantined).`);

        return {
            trends: representatives,
            clusterCount: clusterMap.size,
            anomalyCount: quarantined.length,
            quarantined,
            clusterMap
        };
    }

    /**
     * Persist quarantined trends to MongoDB for security audit trail.
     */
    async persistQuarantined(quarantined) {
        const bulkOps = quarantined.map(trend => ({
            updateOne: {
                filter: { trendId: trend.trendId },
                update: {
                    $set: {
                        isAnomaly: true,
                        anomalyScore: trend.anomalyScore,
                        moderationStatus: 'quarantined',
                        trendScore: 0,
                        engagementScore: 0
                    }
                },
                upsert: false
            }
        }));
        if (bulkOps.length > 0) {
            await Trend.bulkWrite(bulkOps);
            logger.info(`[ClusteringEngine] Persisted ${bulkOps.length} quarantined trends to DB.`);
        }
    }
}

module.exports = new TrendClusteringEngine();
