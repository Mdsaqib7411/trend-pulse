/**
 * Phase 4 Integration Test Suite — Tests 1, 2, 3, 4, 9, 10
 *
 * Requires live MongoDB + optionally Redis.
 * Run from backend/ directory:
 *   node src/tests/phase4_integration.js
 *
 * Will clean up all test documents it creates.
 */

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const http = require('http');

// ─── Result Tracker ───────────────────────────────────────────────────────────
const results = [];
let testIndex = 0;

function pass(name, evidence) {
    results.push({ index: ++testIndex, name, status: '✅ PASS', evidence });
    console.log(`\n✅ PASS — ${name}`);
    if (evidence) console.log('   Evidence:', JSON.stringify(evidence, null, 2).split('\n').join('\n   '));
}

function fail(name, reason, evidence) {
    results.push({ index: ++testIndex, name, status: '❌ FAIL', reason, evidence });
    console.error(`\n❌ FAIL — ${name}`);
    console.error('   Reason:', reason);
    if (evidence) console.error('   Evidence:', JSON.stringify(evidence, null, 2).split('\n').join('\n   '));
}

function section(title) {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`  ${title}`);
    console.log('═'.repeat(70));
}

// ─── Connect ──────────────────────────────────────────────────────────────────
async function connect() {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/trendpulse';
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
    console.log(`[DB] Connected to MongoDB: ${mongoose.connection.host}/${mongoose.connection.name}`);
}

// ─── Models ───────────────────────────────────────────────────────────────────
const PredictionHistory = require('../models/PredictionHistory');
const Trend = require('../models/Trend');
const predictionValidationWorker = require('../services/predictionValidationWorker');
const trendPredictionEngine = require('../services/trendPredictionEngine');

// ─── Test Cleanup Registry ────────────────────────────────────────────────────
const CLEANUP_TAG = `phase4_test_${Date.now()}`;
const insertedIds = [];  // PredictionHistory ObjectIds to clean up

function makeTestTrendId() {
    return `${CLEANUP_TAG}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Insert a minimal synthetic Trend document so predictForTrend() can find it.
 */
async function upsertTestTrend(trendId, overrides = {}) {
    const now = new Date();
    await Trend.findOneAndUpdate(
        { trendId },
        {
            $setOnInsert: {
                trendId,
                title: overrides.title || `Phase4 Test Trend ${trendId}`,
                category: overrides.category || 'AI',
                engagementScore: overrides.engagementScore || 800,
                trendScore: overrides.trendScore || 65,
                publishedAt: overrides.publishedAt || new Date(now - 2 * 60 * 60 * 1000),
                createdAt: now,
                type: 'news',
                source: 'TestSource',
                content: 'Synthetic test trend for Phase 4 verification',
                scoring: { compositeScore: overrides.compositeScore || 65, viralScore: 70, heatScore: 60, growthScore: 55 },
                scoreHistory: overrides.scoreHistory || [
                    { ts: new Date(now - 90 * 60 * 1000), v: 55, h: 50, g: 45, c: 50 },
                    { ts: new Date(now - 60 * 60 * 1000), v: 60, h: 55, g: 50, c: 55 },
                    { ts: new Date(now - 30 * 60 * 1000), v: 68, h: 62, g: 58, c: 63 },
                    { ts: new Date(now),                   v: 75, h: 70, g: 65, c: 70 }
                ],
                geography: { country: 'US', state: 'CA', city: 'San Francisco' },
                isEmerging: true,
                analysis: {
                    status: 'completed',
                    summary: 'Synthetic AI trend for Phase 4 testing.',
                    keywords: ['openai', 'gpt5', 'ai', 'test'],
                    sentiment: 'positive',
                    sentimentScore: 78,
                    confidenceScore: 85
                },
                platformCount: 2
            }
        },
        { upsert: true, new: false }
    ).lean();
}


// ═════════════════════════════════════════════════════════════════════════════
// TEST 1 — PredictionHistory Creation
// ═════════════════════════════════════════════════════════════════════════════

async function test1_predictionHistoryCreation() {
    section('TEST 1 — PredictionHistory Creation');

    const trendId = makeTestTrendId();

    try {
        // 1. Insert synthetic Trend
        await upsertTestTrend(trendId);
        console.log(`   [1] Synthetic trend upserted: ${trendId}`);

        // 2. Count PredictionHistory docs for this trendId BEFORE
        const countBefore = await PredictionHistory.countDocuments({ trendId });

        // 3. Trigger prediction engine
        const t0 = Date.now();
        const prediction = await trendPredictionEngine.predictForTrend(trendId);
        const engineMs = Date.now() - t0;

        if (!prediction) {
            fail('TEST 1 — PredictionHistory Creation', 'predictForTrend() returned null');
            return;
        }

        // 4. Wait for the setImmediate fire-and-forget to complete
        await new Promise(r => setTimeout(r, 500));

        // 5. Query PredictionHistory
        const doc = await PredictionHistory.findOne({ trendId }).sort({ computedAt: -1 }).lean();

        if (!doc) {
            fail('TEST 1 — PredictionHistory Creation',
                `No PredictionHistory document found after predictForTrend(). countBefore=${countBefore}`,
                { prediction }
            );
            return;
        }

        insertedIds.push(doc._id);

        // 6. Validate required fields
        const missing = [];
        if (!doc.trendId)          missing.push('trendId');
        if (!doc.predictedState)   missing.push('predictedState');
        if (typeof doc.confidenceScore !== 'number') missing.push('confidenceScore');
        if (!doc.computedAt)       missing.push('computedAt');
        if (!doc.trendCategory)    missing.push('trendCategory');
        if (!Array.isArray(doc.predictedRegions)) missing.push('predictedRegions');
        if (doc.evaluated24h !== false) missing.push('evaluated24h should be false');
        if (doc.lifecycleAccuracy !== null) missing.push('lifecycleAccuracy should be null');

        if (missing.length > 0) {
            fail('TEST 1 — PredictionHistory Creation',
                `Missing or invalid fields: ${missing.join(', ')}`,
                doc
            );
            return;
        }

        pass('TEST 1 — PredictionHistory Creation', {
            engineRuntimeMs: engineMs,
            documentCreated: {
                _id:             doc._id,
                trendId:         doc.trendId,
                trendTitle:      doc.trendTitle,
                trendCategory:   doc.trendCategory,
                predictedState:  doc.predictedState,
                confidenceScore: doc.confidenceScore,
                computedAt:      doc.computedAt,
                regionsCount:    doc.predictedRegions.length,
                predictedRegions: doc.predictedRegions.slice(0, 2),
                evaluated24h:    doc.evaluated24h,
                lifecycleAccuracy: doc.lifecycleAccuracy,
                engineVersion:   doc.engineVersion
            }
        });

    } catch (err) {
        fail('TEST 1 — PredictionHistory Creation', err.message, { stack: err.stack });
    } finally {
        // Clean up Trend document
        await Trend.deleteOne({ trendId });
    }
}


// ═════════════════════════════════════════════════════════════════════════════
// TEST 2 — 24h Validation Worker
// ═════════════════════════════════════════════════════════════════════════════

async function test2_validation24h() {
    section('TEST 2 — 24h Validation Worker');

    const trendId = makeTestTrendId();

    try {
        // 1. Upsert a trend with 'emerging' prediction so we have something to look up
        await upsertTestTrend(trendId, {
            predictions: { lifecycleState: 'accelerating' }
        });

        // Manually set predictions on the trend (used by worker to fetch actualState)
        await Trend.updateOne(
            { trendId },
            { $set: { 'predictions.lifecycleState': 'accelerating' } }
        );

        // 2. Insert a PredictionHistory record backdated 25 hours ago
        const computedAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
        const testDoc = await PredictionHistory.create({
            trendId,
            trendTitle: `Phase4 Test Trend ${trendId}`,
            trendCategory: 'AI',
            predictedState: 'emerging',
            confidenceScore: 0.72,
            computedAt,
            compositScoreAtPrediction: 52,
            velocityAtPrediction: 18,
            predictedRegions: [
                { country: 'GB', state: '', probability: 0.75, timeLagHours: 3 }
            ],
            predictionJustification: 'Integration test record',
            evaluated24h: false, evaluated72h: false, evaluated7d: false
        });
        insertedIds.push(testDoc._id);

        console.log(`   [1] Test record inserted: ${testDoc._id} (computedAt: ${computedAt.toISOString()})`);
        console.log(`   [2] Before state: evaluated24h=${testDoc.evaluated24h}, actualState24h=${testDoc.actualState24h}`);

        // 3. Run validation worker
        const t0 = Date.now();
        const runResults = await predictionValidationWorker.run();
        const workerMs = Date.now() - t0;

        // 4. Fetch updated document
        const afterDoc = await PredictionHistory.findById(testDoc._id).lean();

        const failReasons = [];
        if (!afterDoc.evaluated24h)               failReasons.push('evaluated24h is still false');
        if (afterDoc.actualState24h === null)      failReasons.push('actualState24h is still null');
        if (afterDoc.lifecycleAccuracy === null)   failReasons.push('lifecycleAccuracy is still null');
        if (afterDoc.brierScore === null)          failReasons.push('brierScore is still null');
        if (!afterDoc.evaluatedAt)                 failReasons.push('evaluatedAt not set');

        if (failReasons.length > 0) {
            fail('TEST 2 — 24h Validation Worker', failReasons.join(', '), {
                workerResults: runResults,
                afterDoc
            });
            return;
        }

        pass('TEST 2 — 24h Validation Worker', {
            workerRuntimeMs: workerMs,
            workerResults: runResults,
            before: {
                evaluated24h: false,
                actualState24h: null,
                lifecycleAccuracy: null,
                brierScore: null
            },
            after: {
                evaluated24h:    afterDoc.evaluated24h,
                actualState24h:  afterDoc.actualState24h,
                lifecycleAccuracy: afterDoc.lifecycleAccuracy,
                brierScore:      afterDoc.brierScore,
                evaluatedAt:     afterDoc.evaluatedAt
            }
        });

    } catch (err) {
        fail('TEST 2 — 24h Validation Worker', err.message, { stack: err.stack });
    } finally {
        await Trend.deleteOne({ trendId });
    }
}


// ═════════════════════════════════════════════════════════════════════════════
// TEST 3 — 72h Validation Worker
// ═════════════════════════════════════════════════════════════════════════════

async function test3_validation72h() {
    section('TEST 3 — 72h Validation Worker');

    const trendId = makeTestTrendId();

    try {
        await upsertTestTrend(trendId);
        await Trend.updateOne({ trendId }, { $set: { 'predictions.lifecycleState': 'viral' } });

        const computedAt = new Date(Date.now() - 73 * 60 * 60 * 1000);
        const testDoc = await PredictionHistory.create({
            trendId,
            trendTitle: `Phase4 72h Test ${trendId}`,
            trendCategory: 'Technology',
            predictedState: 'accelerating',
            confidenceScore: 0.65,
            computedAt,
            compositScoreAtPrediction: 48,
            velocityAtPrediction: 22,
            predictedRegions: [],
            predictionJustification: '72h integration test',
            evaluated24h: true,   // 24h already done
            actualState24h: 'viral',
            lifecycleAccuracy: 0.75,
            brierScore: 0.1225,
            evaluated72h: false,
            evaluated7d: false
        });
        insertedIds.push(testDoc._id);

        console.log(`   [1] Test record inserted: ${testDoc._id} (computedAt: ${computedAt.toISOString()})`);

        const t0 = Date.now();
        const runResults = await predictionValidationWorker.run();
        const workerMs = Date.now() - t0;

        const afterDoc = await PredictionHistory.findById(testDoc._id).lean();

        const failReasons = [];
        if (!afterDoc.evaluated72h)            failReasons.push('evaluated72h is still false');
        if (afterDoc.actualState72h === null)  failReasons.push('actualState72h is still null');

        if (failReasons.length > 0) {
            fail('TEST 3 — 72h Validation Worker', failReasons.join(', '), {
                workerResults: runResults, afterDoc
            });
            return;
        }

        pass('TEST 3 — 72h Validation Worker', {
            workerRuntimeMs: workerMs,
            workerResults: runResults,
            after: {
                evaluated72h:   afterDoc.evaluated72h,
                actualState72h: afterDoc.actualState72h,
                evaluatedAt:    afterDoc.evaluatedAt
            }
        });

    } catch (err) {
        fail('TEST 3 — 72h Validation Worker', err.message);
    } finally {
        await Trend.deleteOne({ trendId });
    }
}


// ═════════════════════════════════════════════════════════════════════════════
// TEST 4 — 7d Validation Worker
// ═════════════════════════════════════════════════════════════════════════════

async function test4_validation7d() {
    section('TEST 4 — 7d Validation Worker');

    const trendId = makeTestTrendId();

    try {
        await upsertTestTrend(trendId, { trendScore: 20, compositeScore: 12 });
        await Trend.updateOne({ trendId }, { $set: { 'predictions.lifecycleState': 'declining' } });

        const computedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
        const testDoc = await PredictionHistory.create({
            trendId,
            trendTitle: `Phase4 7d Test ${trendId}`,
            trendCategory: 'Entertainment',
            predictedState: 'viral',
            confidenceScore: 0.55,
            computedAt,
            compositScoreAtPrediction: 70,
            velocityAtPrediction: 40,
            predictedRegions: [],
            predictionJustification: '7d integration test',
            evaluated24h: true,
            evaluated72h: true,
            evaluated7d: false,
            actualState24h: 'declining',
            actualState72h: 'declining'
        });
        insertedIds.push(testDoc._id);

        console.log(`   [1] Test record inserted: ${testDoc._id} (computedAt: ${computedAt.toISOString()})`);

        const t0 = Date.now();
        const runResults = await predictionValidationWorker.run();
        const workerMs = Date.now() - t0;

        const afterDoc = await PredictionHistory.findById(testDoc._id).lean();

        const failReasons = [];
        if (!afterDoc.evaluated7d)           failReasons.push('evaluated7d is still false');
        if (afterDoc.actualState7d === null) failReasons.push('actualState7d is still null');

        if (failReasons.length > 0) {
            fail('TEST 4 — 7d Validation Worker', failReasons.join(', '), {
                workerResults: runResults, afterDoc
            });
            return;
        }

        pass('TEST 4 — 7d Validation Worker', {
            workerRuntimeMs: workerMs,
            workerResults: runResults,
            after: {
                evaluated7d:   afterDoc.evaluated7d,
                actualState7d: afterDoc.actualState7d,
                evaluatedAt:   afterDoc.evaluatedAt
            }
        });

    } catch (err) {
        fail('TEST 4 — 7d Validation Worker', err.message);
    } finally {
        await Trend.deleteOne({ trendId });
    }
}


// ═════════════════════════════════════════════════════════════════════════════
// TEST 9 — Prediction Accuracy API via getAccuracyStats()
// (Tests the aggregation pipeline directly, not HTTP)
// ═════════════════════════════════════════════════════════════════════════════

async function test9_accuracyAPI() {
    section('TEST 9 — Prediction Accuracy API (getAccuracyStats)');

    try {
        // Seed 3 controlled evaluated records
        const trendId = makeTestTrendId();
        const records = [
            // Correct prediction (emerging→emerging)
            {
                trendId, trendTitle: 'Test API A', trendCategory: 'AI',
                predictedState: 'emerging', confidenceScore: 0.80,
                computedAt: new Date(Date.now() - 26 * 60 * 60 * 1000),
                actualState24h: 'emerging',
                lifecycleAccuracy: 1.00, brierScore: 0.04,
                geoF1Score: 0.80, temporalMAE: 1.5,
                evaluated24h: true, evaluated72h: false, evaluated7d: false,
                evaluatedAt: new Date(), predictedRegions: [], compositScoreAtPrediction: 45
            },
            // Wrong prediction (viral→declining)
            {
                trendId, trendTitle: 'Test API B', trendCategory: 'AI',
                predictedState: 'viral', confidenceScore: 0.90,
                computedAt: new Date(Date.now() - 30 * 60 * 60 * 1000),
                actualState24h: 'declining',
                lifecycleAccuracy: 0.75, brierScore: 0.81,
                geoF1Score: null, temporalMAE: null,
                evaluated24h: true, evaluated72h: false, evaluated7d: false,
                evaluatedAt: new Date(), predictedRegions: [], compositScoreAtPrediction: 65
            },
            // Exact match (accelerating→accelerating)
            {
                trendId, trendTitle: 'Test API C', trendCategory: 'Technology',
                predictedState: 'accelerating', confidenceScore: 0.70,
                computedAt: new Date(Date.now() - 28 * 60 * 60 * 1000),
                actualState24h: 'accelerating',
                lifecycleAccuracy: 1.00, brierScore: 0.09,
                geoF1Score: 0.60, temporalMAE: 2.0,
                evaluated24h: true, evaluated72h: false, evaluated7d: false,
                evaluatedAt: new Date(), predictedRegions: [], compositScoreAtPrediction: 55
            }
        ];

        const inserted = await PredictionHistory.insertMany(records);
        inserted.forEach(d => insertedIds.push(d._id));

        const t0 = Date.now();
        const stats = await predictionValidationWorker.getAccuracyStats({ days: 30 });
        const apiMs = Date.now() - t0;

        console.log(`   API response time: ${apiMs}ms`);
        console.log(`   Stats:`, JSON.stringify(stats, null, 2).split('\n').map(l => '   ' + l).join('\n'));

        const failReasons = [];
        if (typeof stats.totalEvaluated !== 'number')            failReasons.push('totalEvaluated not a number');
        if (isNaN(stats.meanLifecycleAccuracy))                  failReasons.push('meanLifecycleAccuracy is NaN');
        if (isNaN(stats.meanBrierScore))                         failReasons.push('meanBrierScore is NaN');
        if (isNaN(stats.exactMatchRate))                         failReasons.push('exactMatchRate is NaN');
        if (!Array.isArray(stats.byState))                       failReasons.push('byState is not an array');
        if (stats.totalEvaluated < 3)                            failReasons.push(`totalEvaluated=${stats.totalEvaluated}, expected ≥3`);
        if (stats.meanLifecycleAccuracy === null)                 failReasons.push('meanLifecycleAccuracy is null');
        if (apiMs > 2000)                                        failReasons.push(`API response ${apiMs}ms > 2000ms target`);

        // Verify exactMatchRate: 2 out of 3 were exact matches
        // (but there may be other records in the DB — just check it's a valid number)
        if (typeof stats.exactMatchRate !== 'number' || stats.exactMatchRate < 0 || stats.exactMatchRate > 100) {
            failReasons.push(`exactMatchRate=${stats.exactMatchRate} out of valid range [0,100]`);
        }

        if (failReasons.length > 0) {
            fail('TEST 9 — Prediction Accuracy API', failReasons.join('; '), stats);
            return;
        }

        pass('TEST 9 — Prediction Accuracy API', {
            responseTimeMs: apiMs,
            stats
        });

    } catch (err) {
        fail('TEST 9 — Prediction Accuracy API', err.message, { stack: err.stack });
    }
}


// ═════════════════════════════════════════════════════════════════════════════
// TEST 10 — TTL Index Verification + Load Test (500 records)
// ═════════════════════════════════════════════════════════════════════════════

async function test10_ttlAndLoad() {
    section('TEST 10 — TTL Index Verification + Load Test (500 records)');

    // ── 10A: TTL Index ───────────────────────────────────────────────────────
    try {
        const indexes = await PredictionHistory.collection.indexes();
        const ttlIndex = indexes.find(idx =>
            idx.expireAfterSeconds !== undefined &&
            idx.key && idx.key.createdAt === 1
        );

        if (!ttlIndex) {
            fail('TEST 10A — TTL Index', 'No TTL index found on PredictionHistory.createdAt');
        } else {
            pass('TEST 10A — TTL Index', {
                indexName:          ttlIndex.name,
                key:                ttlIndex.key,
                expireAfterSeconds: ttlIndex.expireAfterSeconds,
                expectedDays:       ttlIndex.expireAfterSeconds / 86400
            });
        }

        // Also verify all 8 other indexes exist
        const expectedIndexKeys = [
            'trendId_1_computedAt_-1',
            'evaluated24h_1_computedAt_1',
            'evaluated72h_1_computedAt_1',
            'evaluated7d_1_computedAt_1',
            'predictedState_1_computedAt_-1',
            'trendCategory_1_computedAt_-1'
        ];

        const indexNames = indexes.map(idx => idx.name);
        const missingIndexes = expectedIndexKeys.filter(k => !indexNames.includes(k));

        if (missingIndexes.length > 0) {
            fail('TEST 10A — Index Completeness',
                `Missing indexes: ${missingIndexes.join(', ')}`,
                { existingIndexes: indexNames }
            );
        } else {
            pass('TEST 10A — Index Completeness', {
                totalIndexes: indexes.length,
                verified: expectedIndexKeys
            });
        }

    } catch (err) {
        fail('TEST 10A — TTL/Index Verification', err.message);
    }

    // ── 10B: Load Test — 500 documents ──────────────────────────────────────
    const LOAD_COUNT = 500;
    const loadTrendId = makeTestTrendId();
    const loadInsertedIds = [];

    try {
        console.log(`\n   [Load Test] Inserting ${LOAD_COUNT} PredictionHistory records...`);

        const tInsert0 = Date.now();

        // Build batch
        const batch = [];
        for (let i = 0; i < LOAD_COUNT; i++) {
            const hoursAgo = 25 + Math.floor(Math.random() * 70); // 25–95 hours ago
            const state = ['emerging', 'accelerating', 'viral', 'declining', 'dead'][i % 5];
            const confidence = parseFloat((0.3 + Math.random() * 0.6).toFixed(3));

            batch.push({
                trendId:         `${loadTrendId}_${i}`,
                trendTitle:      `Load Test Trend ${i}`,
                trendCategory:   ['AI', 'Technology', 'Cricket', 'Finance', 'Entertainment'][i % 5],
                predictedState:  state,
                confidenceScore: confidence,
                computedAt:      new Date(Date.now() - hoursAgo * 60 * 60 * 1000),
                compositScoreAtPrediction: 30 + Math.floor(Math.random() * 60),
                velocityAtPrediction: -20 + Math.random() * 60,
                predictedRegions: i % 3 === 0 ? [
                    { country: 'GB', state: '', probability: 0.75, timeLagHours: 3 },
                    { country: 'IN', state: 'KA', probability: 0.65, timeLagHours: 4 }
                ] : [],
                predictionJustification: `Load test record ${i}`,
                evaluated24h: false,
                evaluated72h: false,
                evaluated7d: false
            });
        }

        const inserted = await PredictionHistory.insertMany(batch, { ordered: false });
        const insertMs = Date.now() - tInsert0;
        inserted.forEach(d => loadInsertedIds.push(d._id));
        insertedIds.push(...loadInsertedIds);

        console.log(`   [Load Test] ${LOAD_COUNT} records inserted in ${insertMs}ms`);

        // Run validation worker — should process up to BATCH_SIZE=50 per window
        const tWorker0 = Date.now();
        const workerResults = await predictionValidationWorker.run();
        const workerMs = Date.now() - tWorker0;

        console.log(`   [Load Test] Worker ran in ${workerMs}ms`);
        console.log(`   [Load Test] Worker results:`, workerResults);

        // Run accuracy API
        const tApi0 = Date.now();
        const stats = await predictionValidationWorker.getAccuracyStats({ days: 30 });
        const apiMs = Date.now() - tApi0;

        console.log(`   [Load Test] Accuracy API responded in ${apiMs}ms — totalEvaluated: ${stats.totalEvaluated}`);

        const failReasons = [];
        if (workerMs > 30000) failReasons.push(`Worker took ${workerMs}ms > 30s`);
        if (apiMs > 2000)     failReasons.push(`API took ${apiMs}ms > 2s target`);
        if (stats.totalEvaluated === 0 && LOAD_COUNT > 0) failReasons.push('No records evaluated after load');

        if (failReasons.length > 0) {
            fail('TEST 10B — Load Test', failReasons.join('; '), {
                insertMs, workerMs, apiMs, workerResults,
                totalEvaluated: stats.totalEvaluated
            });
            return;
        }

        pass('TEST 10B — Load Test', {
            recordsInserted:      LOAD_COUNT,
            insertTimeMs:         insertMs,
            workerRuntimeMs:      workerMs,
            workerResults,
            apiResponseTimeMs:    apiMs,
            totalEvaluatedAfter:  stats.totalEvaluated,
            exactMatchRate:       stats.exactMatchRate,
            meanLifecycleAccuracy: stats.meanLifecycleAccuracy
        });

    } catch (err) {
        fail('TEST 10B — Load Test', err.message, { stack: err.stack });
    } finally {
        // Clean up load test documents in batches
        if (loadInsertedIds.length > 0) {
            await PredictionHistory.deleteMany({ _id: { $in: loadInsertedIds } });
            console.log(`   [Cleanup] Removed ${loadInsertedIds.length} load test documents`);
        }
    }
}


// ─── Cleanup & Summary ────────────────────────────────────────────────────────

async function cleanup() {
    if (insertedIds.length > 0) {
        await PredictionHistory.deleteMany({ _id: { $in: insertedIds } });
        console.log(`\n[Cleanup] Removed ${insertedIds.length} test PredictionHistory documents`);
    }
}

function printSummary() {
    console.log(`\n${'═'.repeat(70)}`);
    console.log('  PHASE 4 INTEGRATION TEST RESULTS');
    console.log('═'.repeat(70));

    let passed = 0, failed = 0;
    for (const r of results) {
        console.log(`  ${r.status}  [${r.index}] ${r.name}`);
        if (r.reason) console.log(`         Reason: ${r.reason}`);
        if (r.status.includes('PASS')) passed++;
        else failed++;
    }

    const score = Math.round((passed / (passed + failed)) * 100);
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`  Tests:  ${passed + failed} total | ${passed} passed | ${failed} failed`);
    console.log(`  Phase 4 Readiness Score: ${score}%`);
    console.log(`${'═'.repeat(70)}\n`);

    return { passed, failed, score };
}


// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    const startTime = Date.now();

    try {
        await connect();
    } catch (err) {
        console.error('[FATAL] Cannot connect to MongoDB:', err.message);
        process.exit(1);
    }

    try {
        await test1_predictionHistoryCreation();
        await test2_validation24h();
        await test3_validation72h();
        await test4_validation7d();
        await test9_accuracyAPI();
        await test10_ttlAndLoad();
    } finally {
        await cleanup();
        const summary = printSummary();
        const totalMs = Date.now() - startTime;
        console.log(`  Total suite runtime: ${(totalMs / 1000).toFixed(1)}s`);
        await mongoose.disconnect();
        process.exit(summary.failed > 0 ? 1 : 0);
    }
}

main();
