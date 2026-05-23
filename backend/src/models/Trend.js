const mongoose = require('mongoose');

const chartDataSchema = new mongoose.Schema({
    month: { type: String, required: true },
    value: { type: Number, required: true }
}, { _id: false });

const metricsSchema = new mongoose.Schema({
    peakVolume: { type: String },
    dailyEngagers: { type: String },
    topRegion: { type: String },
    shareRate: { type: String }
}, { _id: false });

const keyDriverSchema = new mongoose.Schema({
    title: { type: String },
    desc: { type: String }
}, { _id: false });

// Compact scoring snapshot for scoreHistory timeline
const scoreSnapshotSchema = new mongoose.Schema({
    ts: { type: Date, required: true },
    v: { type: Number, default: 0 },  // viralScore
    h: { type: Number, default: 0 },  // heatScore
    g: { type: Number, default: 0 },  // growthScore
    c: { type: Number, default: 0 }   // compositeScore
}, { _id: false });

// Discrete scoring metrics computed by trendScoreEngine
const scoringSchema = new mongoose.Schema({
    viralScore: { type: Number, default: 0, min: 0, max: 100 },
    heatScore: { type: Number, default: 0, min: 0, max: 100 },
    growthScore: { type: Number, default: 0, min: 0, max: 100 },
    compositeScore: { type: Number, default: 0, min: 0, max: 100 }
}, { _id: false });

// AI Confidence sub-object (Task 7: LLM Confidence System)
const aiConfidenceSchema = new mongoose.Schema({
    score: { type: Number, default: 0, min: 0, max: 100 },
    sourceConsistency: { type: Number, default: 0, min: 0, max: 100 },
    dataCompleteness: { type: Number, default: 0, min: 0, max: 100 },
    evaluatedAt: { type: Date }
}, { _id: false });

const trendSchema = new mongoose.Schema({
    trendId: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    category: { type: String, required: true },
    time: { type: String },
    readTime: { type: String },
    author: { type: String },
    growth: { type: String },
    image: { type: String },
    content: { type: String },
    sourceUrl: { type: String },

    // Raw ingestion metadata
    engagementScore: { type: Number, default: 0 },
    type: { type: String, enum: ['news', 'reddit', 'video', 'social'], default: 'news' },
    publishedAt: { type: Date },

    // Core composite score (weighted blend of viral + heat + growth)
    trendScore: { type: Number, default: 0, index: true },
    location: { type: String, default: 'Global' },
    language: { type: String, default: 'en' },

    // Geo-Intelligence Layer
    geography: {
        country: { type: String, default: '' },
        state: { type: String, default: '' },
        city: { type: String, default: '' },
        coordinates: {
            lat: { type: Number },
            lng: { type: Number }
        }
    },
    isEmerging: { type: Boolean, default: false },
    emergingDetectedAt: { type: Date },

    // Phase 3.5: Cross-Platform Fusion Engine
    sources: {
        reddit: [{
            url: String,
            subreddit: String,
            score: Number,
            comments: Number,
            fetchedAt: { type: Date, default: Date.now }
        }],
        youtube: [{
            url: String,
            channelTitle: String,
            viewCount: Number,
            fetchedAt: { type: Date, default: Date.now }
        }],
        googleNews: [{
            url: String,
            sourceName: String,
            fetchedAt: { type: Date, default: Date.now }
        }]
    },
    platformCount: { type: Number, default: 1 },
    crossPlatformMultiplier: { type: Number, default: 1.0 },

    // Phase 3.5: Trend Relationship Graph
    relatedTrendIds: [{ type: String }],

    // Task 1: Discrete scoring metrics
    scoring: scoringSchema,

    // Task 1: Rolling score history for frontend charts (capped at 48 entries)
    scoreHistory: [scoreSnapshotSchema],

    // Shahkal AI Analytics Object
    analysis: {
        status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
        summary: { type: String },
        whyTrending: { type: String },         // Task 2: data-driven explanation
        sentiment: { type: String },            // Task 2: "positive", "negative", "neutral"
        sentimentScore: { type: Number, default: 0 }, // 0-100 numeric sentiment
        targetAudience: { type: String },       // Task 2: e.g. "Tech Enthusiasts, Developers"
        prediction: { type: String },
        viralityScore: { type: Number, default: 0 },
        audienceType: { type: String },
        growthMomentum: { type: String },
        alertType: { type: String },
        confidenceScore: { type: Number, default: 0 },
        keywords: [String],
        processedAt: { type: Date }
    },

    // Task 7: Isolated AI Confidence sub-object
    aiConfidence: aiConfidenceSchema,

    // Graph Object embedded
    graph: {
        chartData: [chartDataSchema],
        metrics: metricsSchema
    },

    // Phase 3.5 Step 2: Viral Spread Prediction Engine
    predictions: {
        lifecycleState: {
            type: String,
            enum: ['emerging', 'accelerating', 'viral', 'declining', 'dead'],
            default: 'emerging'
        },
        confidenceScore: { type: Number, default: 0, min: 0, max: 1 },
        matchedTrendId: { type: String, default: null },
        matchProfile: { type: Number, default: 0 },
        historicalPeak: { type: Number, default: 0 },
        predictedRegions: [{
            country: { type: String },
            state: { type: String, default: '' },
            probability: { type: Number, min: 0, max: 1 },
            timeLagHours: { type: Number }
        }],
        predictionJustification: { type: String, default: '' },
        computedAt: { type: Date }
    },

    // Phase 3.5 Step 3: Semantic Clustering & Geo-Anomaly Detection
    parentClusterId: { type: String, default: null, index: true },
    clusterSize: { type: Number, default: 1 },
    isAnomaly: { type: Boolean, default: false },
    anomalyScore: { type: Number, default: 0.0, min: 0, max: 1 },
    moderationStatus: {
        type: String,
        enum: ['approved', 'quarantined'],
        default: 'approved'
    }

}, { timestamps: true });

// Performance indexes
trendSchema.index({ category: 1, trendScore: -1 });
trendSchema.index({ publishedAt: -1 });
trendSchema.index({ 'analysis.status': 1 });
trendSchema.index({ 'scoring.viralScore': -1 });
// Geo-Intelligence indexes (Layer 1)
trendSchema.index({ 'geography.country': 1, 'geography.state': 1, 'scoring.compositeScore': -1 });
trendSchema.index({ isEmerging: 1, 'geography.state': 1 });
trendSchema.index({ 'geography.country': 1, trendScore: -1 });
// Phase 3.5 Step 3: Clustering & Anomaly indexes
trendSchema.index({ moderationStatus: 1, trendScore: -1 });
trendSchema.index({ isAnomaly: 1, createdAt: -1 });

module.exports = mongoose.model('Trend', trendSchema);
