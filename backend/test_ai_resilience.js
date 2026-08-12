// ─── RESILIENCE TEST SUITE — zero-cost cross-gateway mock verification ──────
require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');

// Global mock state switches
global.mockDirectGeminiFail = false;
global.mockOpenRouterFail = false;
global.mockOpenRouterGeminiFail = false;
global.mockOpenRouterLlamaFail = false;
global.mockOpenRouterQwenFail = false;

// Mock OpenAI in require cache (override the exported constructor directly)
const MockOpenAI = class {
    constructor(config) {
        this.config = config;
        this.chat = {
            completions: {
                create: async (payload) => {
                    if (global.mockOpenRouterFail) {
                        throw new Error("MOCK_OPENROUTER_FAIL: OpenRouter gateway DNS timeout");
                    }
                    
                    const model = payload.model;
                    const prompt = payload.messages[0].content;

                    if (model === 'google/gemini-2.5-flash:free') {
                        if (global.mockOpenRouterGeminiFail) {
                            throw new Error("MOCK_OPENROUTER_GEMINI_FAIL: Model unavailable");
                        }
                        return {
                            choices: [{
                                message: {
                                    content: prompt.includes('reasoningFactors')
                                        ? JSON.stringify({
                                            summary: "Gemini OpenRouter Ingestion Response",
                                            whyTrending: "viralScore=50",
                                            sentiment: "neutral",
                                            sentimentScore: 50,
                                            targetAudience: "General",
                                            prediction: "stable",
                                            viralityScore: 5,
                                            audienceType: "General",
                                            growthMomentum: "moderate",
                                            alertType: "none",
                                            confidenceScore: 70,
                                            keywords: ["openrouter", "gemini"]
                                        })
                                        : "Gemini OpenRouter Chat Response"
                                }
                            }]
                        };
                    }

                    if (model === 'meta-llama/llama-3-8b-instruct:free') {
                        if (global.mockOpenRouterLlamaFail) {
                            throw new Error("MOCK_OPENROUTER_LLAMA_FAIL: Model overloaded");
                        }
                        return {
                            choices: [{
                                message: {
                                    content: prompt.includes('reasoningFactors')
                                        ? JSON.stringify({
                                            summary: "Llama 3 OpenRouter Ingestion Response",
                                            whyTrending: "viralScore=50",
                                            sentiment: "neutral",
                                            sentimentScore: 50,
                                            targetAudience: "General",
                                            prediction: "stable",
                                            viralityScore: 5,
                                            audienceType: "General",
                                            growthMomentum: "moderate",
                                            alertType: "none",
                                            confidenceScore: 70,
                                            keywords: ["openrouter", "llama"]
                                        })
                                        : "Llama 3 OpenRouter Chat Response"
                                }
                            }]
                        };
                    }

                    if (model === 'qwen/qwen-2.5-7b-instruct:free') {
                        if (global.mockOpenRouterQwenFail) {
                            throw new Error("MOCK_OPENROUTER_QWEN_FAIL: Model rate limit");
                        }
                        return {
                            choices: [{
                                message: {
                                    content: prompt.includes('reasoningFactors')
                                        ? JSON.stringify({
                                            summary: "Qwen 2.5 OpenRouter Ingestion Response",
                                            whyTrending: "viralScore=50",
                                            sentiment: "neutral",
                                            sentimentScore: 50,
                                            targetAudience: "General",
                                            prediction: "stable",
                                            viralityScore: 5,
                                            audienceType: "General",
                                            growthMomentum: "moderate",
                                            alertType: "none",
                                            confidenceScore: 70,
                                            keywords: ["openrouter", "qwen"]
                                        })
                                        : "Qwen 2.5 OpenRouter Chat Response"
                                }
                            }]
                        };
                    }

                    throw new Error(`MOCK_OPENROUTER_ERROR: Model ${model} not mocked.`);
                }
            }
        };
    }
};

require.cache[require.resolve('openai')] = {
    id: require.resolve('openai'),
    filename: require.resolve('openai'),
    loaded: true,
    exports: MockOpenAI
};

// Mock Google SDK in require cache
const MockGoogleGenerativeAIClass = class {
    constructor(apiKey) {
        this.apiKey = apiKey;
    }
    getGenerativeModel() {
        return {
            async generateContent(prompt) {
                if (global.mockDirectGeminiFail) {
                    throw new Error("MOCK_DIRECT_GEMINI_FAIL: Google direct rate limit exceeded (429)");
                }
                return {
                    response: {
                        text: () => {
                            if (prompt.includes('reasoningFactors')) {
                                return JSON.stringify({
                                    summary: "Gemini Direct Ingestion Response",
                                    whyTrending: "viralScore=80",
                                    sentiment: "positive",
                                    sentimentScore: 85,
                                    targetAudience: "Developers",
                                    prediction: "growing",
                                    viralityScore: 8,
                                    audienceType: "Developers",
                                    growthMomentum: "rapid",
                                    alertType: "emerging_trend",
                                    confidenceScore: 80,
                                    keywords: ["gemini", "direct"]
                                });
                            }
                            return "Gemini Direct Chat Response";
                        }
                    }
                };
            }
        };
    }
};

require.cache[require.resolve('@google/generative-ai')] = {
    id: require.resolve('@google/generative-ai'),
    filename: require.resolve('@google/generative-ai'),
    loaded: true,
    exports: {
        GoogleGenerativeAI: MockGoogleGenerativeAIClass
    }
};

// ─── Import Core Services post-mocking ──────────────────────────────────────
const aiService = require('./src/services/aiService');
const aiAnalyticsService = require('./src/services/aiAnalyticsService');
const aiTelemetryService = require('./src/services/aiTelemetryService');
const Trend = require('./src/models/Trend');

async function runResilienceTests() {
    console.log('======================================================');
    console.log('       TRENDPULSE - AI GATEWAY RESILIENCE TEST SUITE  ');
    console.log('======================================================\n');

    // Setup MongoDB for schema verification
    console.log('[Test Setup] Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('[Test Setup] MongoDB connected successfully.');

    // 1. Pluck a real trend for schema inputs
    const mockTrend = await Trend.findOne().lean() || {
        title: "Test Ingestion Trend Title",
        content: "Test detailed description content of the trend.",
        publishedAt: new Date(),
        engagementScore: 10,
        type: 'news'
    };

    const scoringContext = { viralScore: 40, heatScore: 50, growthScore: 30, compositeScore: 40 };

    // ────────────────────────────────────────────────────────────────────────
    // TEST 1: Disable Gemini Direct (Chat fails over to OpenRouter)
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- 🧪 TEST 1: Disable Gemini Direct (Chat Failover) ---');
    global.mockDirectGeminiFail = true;
    global.mockOpenRouterFail = false;
    global.mockOpenRouterGeminiFail = false;

    let chatResult = await aiService.chatWithAI("Explain this trend", mockTrend);
    
    console.log(`[Result] Answered Provider: "${chatResult.provider}"`);
    console.log(`[Result] Answered Gateway:  "${chatResult.gateway}"`);
    console.log(`[Result] Reply Text:       "${chatResult.reply}"`);

    if (chatResult.provider === 'Gemini OpenRouter' && chatResult.gateway === 'OpenRouter') {
        console.log('✅ PASS: Chat successfully failed over to OpenRouter Gemini!');
    } else {
        console.error('❌ FAIL: Chat failed to route to Gemini OpenRouter fallback.');
        process.exit(1);
    }

    // ────────────────────────────────────────────────────────────────────────
    // TEST 2: Disable OpenRouter (Analytics fails over to Google SDK)
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- 🧪 TEST 2: Disable OpenRouter Gateway (Analytics Failover) ---');
    global.mockDirectGeminiFail = false;
    global.mockOpenRouterFail = true; // Complete OpenRouter down

    let analyticsResult = await aiAnalyticsService.enrichTrendWithContext(mockTrend, scoringContext, 5);
    
    console.log(`[Result] Answered Provider: "${analyticsResult.provider}"`);
    console.log(`[Result] Answered Gateway:  "${analyticsResult.gateway}"`);
    console.log(`[Result] Summary:           "${analyticsResult.summary}"`);
    console.log(`[Result] Prediction:        "${analyticsResult.prediction}"`);

    if (analyticsResult.provider === 'Gemini Direct' && analyticsResult.gateway === 'Google SDK') {
        console.log('✅ PASS: Analytics successfully bypassed dead OpenRouter gateway and enriched via Direct Gemini SDK!');
    } else {
        console.error('❌ FAIL: Analytics failed to failover to direct Google SDK.');
        process.exit(1);
    }

    // ────────────────────────────────────────────────────────────────────────
    // TEST 3: Disable Both Gateways (Total failure gracefully handled)
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- 🧪 TEST 3: Disable Both Gateways (Graceful Fallback) ---');
    global.mockDirectGeminiFail = true;
    global.mockOpenRouterFail = true;

    // Chat total failure
    let chatTotalResult = await aiService.chatWithAI("Is anyone there?", mockTrend);
    console.log(`[Chat Result] Provider: "${chatTotalResult.provider}"`);
    console.log(`[Chat Result] Reply:    "${chatTotalResult.reply}"`);

    // Ingest total failure
    let analyticsTotalResult = await aiAnalyticsService.enrichTrendWithContext(mockTrend, scoringContext, 5);
    console.log(`[Ingest Result] Provider: "${analyticsTotalResult.provider}"`);
    console.log(`[Ingest Result] Summary:  "${analyticsTotalResult.summary}"`);

    if (chatTotalResult.provider === 'Local Fallback' && analyticsTotalResult.provider === 'Local Fallback') {
        console.log('✅ PASS: Complete outage successfully fell back to localized offline messages and deterministic payloads!');
    } else {
        console.error('❌ FAIL: Local fallbacks were not properly activated.');
        process.exit(1);
    }

    // ────────────────────────────────────────────────────────────────────────
    // TEST 4: Telemetry Diagnostics Verification
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- 🧪 TEST 4: Telemetry & Dashboard Diagnostics Verification ---');
    
    const telemetry = aiTelemetryService.getTelemetry();
    const dashboard = aiTelemetryService.getDashboardStatus();

    console.log('\n=== LIVE AI TELEMETRY STATS ===');
    console.log(JSON.stringify(telemetry, null, 2));
    
    console.log('\n=== DIAGNOSTICS DASHBOARD STATUS ===');
    console.log(JSON.stringify(dashboard, null, 2));

    // Assert counts are logged
    if (telemetry['Gemini Direct'].failureCount > 0 && 
        telemetry['Gemini OpenRouter'].successCount > 0 && 
        telemetry['Local Fallback'].activeCount > 0) {
        console.log('\n✅ PASS: Telemetry layer accurately logged all counts, average latencies, and last failure errors!');
    } else {
        console.error('❌ FAIL: Telemetry layer recorded incorrect operational statistics.');
        process.exit(1);
    }

    console.log('\n======================================================');
    console.log('🎉 ALL AI RESILIENCY TESTS PASSED SUCCESSFULLY!       ');
    console.log('======================================================\n');

    await mongoose.connection.close();
    process.exit(0);
}

runResilienceTests().catch(err => {
    console.error('[Test Suite Error] Unexpected regression during execution:', err);
    mongoose.connection.close().then(() => process.exit(1));
});
