require('dotenv').config();
const mongoose = require('mongoose');
const Trend = require('./src/models/Trend');
const trendAggregator = require('./src/services/trendAggregator');

// ─── STUB OUT EXTERNAL SCALING SCRAPERS TO PREVENT RATE LIMITING & OUTAGES ───
trendAggregator.fetchFromNewsAPI = async (category) => {
    return [
        {
            title: "DeepSeek V3 releases new reasoning model",
            description: "DeepSeek announces V3 reasoning model with unprecedented price performance ratio.",
            url: "https://techcrunch.com/deepseek-v3-reasoning",
            image: "https://images.unsplash.com/photo-1677442136019-21780ecad995",
            source: "TechCrunch",
            publishedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 mins ago
            engagementScore: 50,
            type: "news"
        },
        {
            title: "Apple introduces M5 chips for MacBook Pro line",
            description: "New M5 processors promise massive performance gains in computing power.",
            url: "https://apple.com/m5-chips-macbook",
            image: "https://images.unsplash.com/photo-1677442136019-21780ecad995",
            source: "AppleNews",
            publishedAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
            engagementScore: 120,
            type: "news"
        }
    ];
};

trendAggregator.fetchFromReddit = async (category) => {
    return [
        {
            title: "Check out this crazy cricket match between India and Pakistan!",
            description: "What a spectacular final over match between India and Pakistan! Best match ever.",
            url: "https://reddit.com/r/cricket/ind-vs-pak-crazy-finish",
            image: "https://images.unsplash.com/photo-1617802690992-15d93263d3a9",
            source: "Reddit r/cricket",
            publishedAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
            engagementScore: 4500, // Very high engagement
            type: "reddit"
        }
    ];
};

trendAggregator.fetchFromGNews = async (category) => [];

trendAggregator.fetchFromYouTube = async (category) => {
    return [
        {
            title: "DeepSeek V3 releases new reasoning model review",
            description: "Hands-on review testing DeepSeek V3 reasoning capabilities on complex coding tests.",
            url: "https://youtube.com/watch?v=deepseek-v3-review",
            image: "https://images.unsplash.com/photo-1617802690992-15d93263d3a9",
            source: "YouTube TechReviews",
            publishedAt: new Date(Date.now() - 15 * 60 * 1000), // 15 mins ago
            engagementScore: 200,
            type: "video"
        }
    ];
};

async function runTest() {
    console.log('[Test] Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('[Test] MongoDB connected successfully.');

    // Clean up any existing records for test consistency
    const cleanupUrls = [
        "https://techcrunch.com/deepseek-v3-reasoning",
        "https://apple.com/m5-chips-macbook",
        "https://reddit.com/r/cricket/ind-vs-pak-crazy-finish",
        "https://youtube.com/watch?v=deepseek-v3-review"
    ];
    await Trend.deleteMany({
        $or: [
            { sourceUrl: { $in: cleanupUrls } },
            { trendId: { $in: cleanupUrls } }
        ]
    });
    console.log('[Test] Cleaned up conflicting test database records.');

    console.log('\n[Test] Triggering live getAggregatedTrends feed generation...');
    const result = await trendAggregator.getAggregatedTrends('AI', true);

    console.log('\n=================== TEST ASSERTIONS ===================');
    
    if (!result || !result.data || result.data.length === 0) {
        console.error('❌ FAIL: Result is empty or malformed!');
        process.exit(1);
    }
    
    const trends = result.data;
    console.log(`Successfully generated ${trends.length} ranked active feed trends.`);
    
    // Assert 1: Absolute score ordering
    let isSorted = true;
    for (let i = 0; i < trends.length - 1; i++) {
        if (trends[i].trendScore < trends[i + 1].trendScore) {
            isSorted = false;
            console.error(`❌ SORT VIOLATION: Trend at index ${i} score (${trends[i].trendScore}) is less than index ${i+1} score (${trends[i+1].trendScore})`);
        }
    }
    if (isSorted) {
        console.log('✅ PASS: Feed is strictly ordered by trendScore descending.');
    } else {
        process.exit(1);
    }

    // Assert 2: Authoritative compositeScore identity mapping
    let allMatched = true;
    for (const t of trends) {
        if (!t.scoring || typeof t.scoring.compositeScore !== 'number') {
            allMatched = false;
            console.error(`❌ COMPOSITE MATCH FAIL: Trend "${t.title}" is missing compositeScore!`);
        } else if (t.trendScore !== t.scoring.compositeScore) {
            allMatched = false;
            console.error(`❌ COMPOSITE MATCH FAIL: Trend "${t.title}" trendScore (${t.trendScore}) !== compositeScore (${t.scoring.compositeScore})`);
        }
    }
    if (allMatched) {
        console.log('✅ PASS: trendScore is mathematically identical to trendScoreEngine.compositeScore globally.');
    } else {
        process.exit(1);
    }

    // Assert 3: UI Backward Compatibility Hydration
    let allHydrated = true;
    const requiredUIFields = ['id', 'trendId', 'category', 'time', 'readTime', 'author', 'growth', 'label', 'content'];
    
    for (const t of trends) {
        for (const field of requiredUIFields) {
            if (t[field] === undefined || t[field] === null || t[field] === '') {
                allHydrated = false;
                console.error(`❌ HYDRATION FAIL: Trend "${t.title}" is missing UI field: "${field}"`);
            }
        }
    }
    
    if (allHydrated) {
        console.log('✅ PASS: All perfect backward-compatible mobile UI fields are successfully hydrated.');
    } else {
        process.exit(1);
    }

    // Assert 4: Cross-platform fusion logic detection
    // Our video and news items both contain "DeepSeek V3 releases new reasoning model" so they should merge!
    const fusedDeepSeekTrend = trends.find(t => t.title.toLowerCase().includes('deepseek'));
    if (!fusedDeepSeekTrend) {
        console.error('❌ FAIL: DeepSeek trend not found in aggregated trends!');
        process.exit(1);
    }

    console.log(`\nFused DeepSeek Trend Detail:`);
    console.log(`- Title:      "${fusedDeepSeekTrend.title}"`);
    console.log(`- Score:      ${fusedDeepSeekTrend.trendScore}`);
    console.log(`- Platforms:  ${fusedDeepSeekTrend.platformCount}`);
    console.log(`- Multiplier: ${fusedDeepSeekTrend.crossPlatformMultiplier}`);

    if (fusedDeepSeekTrend.platformCount > 1 && fusedDeepSeekTrend.crossPlatformMultiplier === 1.8) {
        console.log('✅ PASS: Cross-platform fusion merged video + news into a single verified trend with 1.8x multiplier.');
    } else {
        console.error(`❌ FAIL: Fusion failed. Platforms: ${fusedDeepSeekTrend.platformCount}, Multiplier: ${fusedDeepSeekTrend.crossPlatformMultiplier}`);
        process.exit(1);
    }

    // Check DB writes
    console.log('\n[Test] Checking MongoDB document persistence...');
    const dbDoc = await Trend.findOne({ trendId: fusedDeepSeekTrend.trendId }).lean();
    if (!dbDoc) {
        console.error('❌ DB FAIL: Document was not successfully written to database!');
        process.exit(1);
    }
    
    if (dbDoc.trendScore === fusedDeepSeekTrend.trendScore && dbDoc.scoring.compositeScore === fusedDeepSeekTrend.scoring.compositeScore) {
        console.log('✅ PASS: MongoDB document reflects identical scored variables synchronously.');
    } else {
        console.error(`❌ DB FAIL: Document mismatch! DB trendScore: ${dbDoc.trendScore}, Scoring: ${dbDoc.scoring?.compositeScore}`);
        process.exit(1);
    }

    console.log('=======================================================\n');
    console.log('🎉 Verification successful! Phase 3 Ranking Authority & Integrity is 100% compliant!');
    
    // Cleanup test records
    await Trend.deleteMany({
        $or: [
            { sourceUrl: { $in: cleanupUrls } },
            { trendId: { $in: cleanupUrls } }
        ]
    });
    console.log('[Test] Cleaned up test database records.');

    await mongoose.connection.close();
    process.exit(0);
}

runTest().catch(err => {
    console.error('[Test Error] Unexpected error during verification:', err);
    mongoose.connection.close().then(() => process.exit(1));
});
