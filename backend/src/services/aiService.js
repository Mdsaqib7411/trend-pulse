const { GoogleGenerativeAI } = require('@google/generative-ai');
const Trend = require('../models/Trend');

// Initialize Gemini only if key exists to prevent crash on startup
let genAI;
let aiModel;
const SELECTED_GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
if (process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Use gemini-2.5-flash (with fallback support via env)
    aiModel = genAI.getGenerativeModel({ model: SELECTED_GEMINI_MODEL });
}

// In-Memory Cache (Trend ID -> { data, timestamp })
const analysisCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

class AIService {
    /**
     * Sanitizes inputs to prevent prompt injection attacks and excessive token consumption.
     */
    sanitizePromptInput(input) {
        if (!input || typeof input !== 'string') return '';
        
        let clean = input.slice(0, 1000);
        
        const injectionPatterns = [
            /ignore prior instructions/gi,
            /ignore previous instructions/gi,
            /system instructions/gi,
            /you must instead/gi,
            /delete all/gi,
            /drop database/gi,
            /forget everything/gi
        ];
        
        injectionPatterns.forEach(pattern => {
            clean = clean.replace(pattern, '[REDACTED_SECURITY_THREAT]');
        });

        clean = clean.replace(/<[^>]*>/g, '');
        return clean.trim();
    }

    async generateAnalysis(trendId) {
        // 1. In-Memory Cache Check
        if (analysisCache.has(trendId)) {
            const cached = analysisCache.get(trendId);
            if (Date.now() - cached.timestamp < CACHE_TTL) {
                console.log(`[AI Cache] Serving cached analysis for: ${trendId}`);
                return cached.data;
            } else {
                analysisCache.delete(trendId); // Delete expired cache
            }
        }

        // 2. Fetch Trend from Database
        const trend = await Trend.findOne({ trendId });
        if (!trend) {
            throw new Error('Trend not found');
        }

        // 3. Graceful Fallback if no Gemini Key
        if (!aiModel) {
            console.warn("[AI Service] Missing GEMINI_API_KEY. Using safe fallback.");
            return this.getFallbackData(trend);
        }

        // 4. Prompt Preparation and Input Sanitization
        const sanitizedTitle = this.sanitizePromptInput(trend.title);
        const rawDesc = trend.content || trend.description || "No detailed description available. Analyze based on title.";
        const sanitizedDesc = this.sanitizePromptInput(rawDesc);

        const prompt = `Analyze this trend:

Title: ${sanitizedTitle}
Description: ${sanitizedDesc}

Return ONLY valid JSON with no markdown formatting:
{
  "sentimentScore": number (0-100),
  "viralityScore": number (0-10),
  "keyDrivers": [{"title": "string", "desc": "string"}],
  "aiPrediction": "string",
  "confidence": number (0-100)
}

Do not include explanation. ONLY JSON.`;

        // 5. Gemini API Call with 429 Failover
        try {
            console.log(`[AI Service] Calling Gemini for: ${trendId}`);
            let cleanText;
            try {
                const result = await aiModel.generateContent(prompt);
                const responseText = result.response.text();
                cleanText = responseText.replace(/```json\n?|```/g, '').trim();
            } catch (geminiErr) {
                if (geminiErr.message?.includes('429') || geminiErr.message?.includes('Quota') || geminiErr.status === 429) {
                    console.warn(`[AI Service] Gemini 429 Quota Exceeded. Attempting OpenRouter failover...`);
                    try {
                        cleanText = await callOpenRouterChat('google/gemini-2.5-flash:free', prompt);
                        cleanText = cleanText.replace(/```json\n?|```/g, '').trim();
                    } catch (orErr) {
                        console.warn(`[AI Service] OpenRouter failover also busy. Returning safe fallback data.`);
                        return this.getFallbackData(trend);
                    }
                } else {
                    throw geminiErr;
                }
            }

            // Parse and Validate
            let analysisData = JSON.parse(cleanText);
            analysisData = this.validateAnalysisData(analysisData);

            // 6. Update Caches
            analysisCache.set(trendId, { data: analysisData, timestamp: Date.now() });
            
            // Persist to DB
            trend.analysis = analysisData;
            await trend.save();

            return analysisData;

        } catch (error) {
            console.error("[AI Service] Gemini API Error:", error.message);
            // Return safe fallback instead of crashing the server
            return this.getFallbackData(trend);
        }
    }

    /**
     * Validates that all fields exist and have correct types.
     * Prevents frontend crashes if AI hallucinates.
     */
    validateAnalysisData(data) {
        return {
            sentimentScore: typeof data.sentimentScore === 'number' ? data.sentimentScore : 50,
            viralityScore: typeof data.viralityScore === 'number' ? data.viralityScore : 5,
            keyDrivers: Array.isArray(data.keyDrivers) ? data.keyDrivers.slice(0, 3) : [],
            aiPrediction: typeof data.aiPrediction === 'string' ? data.aiPrediction : "Trend is still developing.",
            confidence: typeof data.confidence === 'number' ? data.confidence : 50
        };
    }

    /**
     * Safe Fallback Generator
     */
    getFallbackData(trend) {
        return {
            sentimentScore: 50,
            viralityScore: 5,
            keyDrivers: [],
            aiPrediction: "Analysis not available at the moment.",
            confidence: 50
        };
    }

    /**
     * AI Chat functionality (Free Conversational Model with Zero-Cost Gateway Failover)
     */
    async chatWithAI(message, trendContext, history = [], userId = null) {
        const aiTelemetryService = require('./aiTelemetryService');
        const aiMemoryService = require('./aiMemoryService');
        const memoryProfile = await aiMemoryService.getUserMemoryProfile(userId);

        let systemContext = `You are Shahkal AI, a highly intelligent, conversational, and friendly AI assistant built into the AITrendTracker app. CRITICAL RULE: You MUST always respond in "Hinglish" (Hindi/Urdu language written in the English alphabet, e.g., "Haan bhai, main bilkul samajh gaya!"). DO NOT use the Devanagari (हिंदी) script. Speak naturally, like a cool tech-savvy Indian friend.\n`;
        
        systemContext += `\nCRITICAL EXPLAINABILITY REQUIREMENT: When explaining predictions, recommendations, viral spikes, or alerts, you MUST provide clear, human-readable, and concise "explainable AI reasoning". Do not just state a prediction or recommendation; explain the "why" (e.g., category affinity match, search term overlap, positive velocity slope, sentiment shift polarity, or high engagement density) in a conversational, friendly Hinglish manner. Keep it simple and human-readable!\n`;

        if (memoryProfile) {
            systemContext += `\n[User Personalization Memory Profile]: ${memoryProfile}\nUse this profile to explain trends in ways that match their background, suggest categories aligned with their history, and personalize summaries/recommendations when requested.\n`;
        }

        if (trendContext && trendContext.title) {
            systemContext += `\nThe user is currently looking at a trend called: "${trendContext.title}".\n`;
            if (trendContext.description) {
                systemContext += `Description: "${trendContext.description}".\n`;
            }
            systemContext += `Use this context to answer questions specifically about this trend. DO NOT format your response as JSON. Reply normally as a chatbot.\n\n`;
        } else {
            systemContext += `\nThe user is asking a general question about AI trends. DO NOT format your response as JSON. Reply normally as a chatbot.\n\n`;
        }

        // ─── Realtime Data Orchestration Layer ─────────────────────────
        let extraDataPrompt = '';
        const lowerMsg = message.toLowerCase();

        // 1. Prediction lifecycle checks
        if (lowerMsg.includes('predict') || lowerMsg.includes('lifecycle') || lowerMsg.includes('peaking') || lowerMsg.includes('emerging') || lowerMsg.includes('declining') || lowerMsg.includes('dead')) {
            const queryState = lowerMsg.includes('peaking') ? 'peaking' 
                : lowerMsg.includes('emerging') ? 'emerging' 
                : lowerMsg.includes('declining') ? 'declining'
                : lowerMsg.includes('dead') ? 'dead' : null;

            const filter = queryState ? { 'predictions.lifecycleState': queryState } : { 'predictions.lifecycleState': { $exists: true } };
            const predictedTrends = await Trend.find(filter)
                .sort({ trendScore: -1 })
                .limit(3)
                .select('title category predictions.lifecycleState predictions.predictionJustification')
                .lean();

            if (predictedTrends.length > 0) {
                extraDataPrompt += `\n[Realtime Predictions]:\n`;
                predictedTrends.forEach(t => {
                    extraDataPrompt += `- "${t.title}" predicted as "${t.predictions.lifecycleState}". Reason: ${t.predictions.predictionJustification}\n`;
                });
            }
        }

        // 2. Viral Trend analysis checks
        if (lowerMsg.includes('viral') || lowerMsg.includes('highest') || lowerMsg.includes('trending') || lowerMsg.includes('top')) {
            const viralTrends = await Trend.find({ trendScore: { $gte: 75 } })
                .sort({ trendScore: -1 })
                .limit(3)
                .select('title category trendScore analysis.summary')
                .lean();

            if (viralTrends.length > 0) {
                extraDataPrompt += `\n[Realtime Viral Trends]:\n`;
                viralTrends.forEach(t => {
                    extraDataPrompt += `- "${t.title}" (#${t.category}) score ${t.trendScore}%. Summary: ${t.analysis?.summary || 'N/A'}\n`;
                });
            }
        }

        // 3. Category insights
        if (lowerMsg.includes('category') || lowerMsg.includes('categories') || lowerMsg.includes('tech') || lowerMsg.includes('cricket') || lowerMsg.includes('finance')) {
            const categories = await Trend.distinct('category');
            extraDataPrompt += `\n[Subscribed Categories]: ${categories.join(', ')}\n`;
        }

        // 4. Recommendation explanations
        if (lowerMsg.includes('recommend') || lowerMsg.includes('for you') || lowerMsg.includes('suggest')) {
            extraDataPrompt += `\n[Recommendation Strategy]: Interleaving ratio: 70% Local, 20% National, 10% Global. Matching user preferences, dynamic keyword density mapping.\n`;
        }

        // 5. Intelligent alerts & viral spikes explanation
        if (lowerMsg.includes('alert') || lowerMsg.includes('notification') || lowerMsg.includes('spike')) {
            extraDataPrompt += `\n[Intelligent Alert & Spike Heuristics]:
- Viral Spike Alert: Triggered when composite engagement score jumps significantly, crossing the high-importance threshold of 90%.
- Sentiment Shift Alert: Triggered due to an ecosystem polarity flip (e.g., changing to positive or negative indicating a dynamic change in developer opinion).
- Area Surge Alert: Indicates a sudden engagement jump/volume saturation in a user's saved/bookmarked categories.\n`;
        }

        if (extraDataPrompt) {
            systemContext += `\nRealtime context from database:\n${extraDataPrompt}\nAnswer accurately using this data context.\n`;
        }

        // Convert history to text for prompt context
        const conversationLog = history.map(msg => `${msg.role === 'model' ? 'Shahkal AI' : 'User'}: ${msg.parts[0].text}`).join('\n');
        
        const prompt = `${systemContext}\n--- Conversation History ---\n${conversationLog}\n\nUser: ${message}\nShahkal AI:`;

        console.log(`[AI Service] Chatting. Trend Context: ${trendContext?.title || 'None'}`);

        // --- EXECUTE FALLBACK CHAIN ---
        const startTime = Date.now();

        // Layer 1: Gemini Direct SDK
        try {
            if (!aiModel) {
                throw new Error('Google Generative AI SDK client not initialized (missing API key)');
            }
            const result = await aiModel.generateContent(prompt);
            const reply = result.response.text();
            if (!reply) {
                throw new Error('Empty response from Google Generative AI direct SDK');
            }
            const latency = Date.now() - startTime;
            aiTelemetryService.recordSuccess('Gemini Direct', latency);
            return {
                reply: reply.trim(),
                provider: 'Gemini Direct',
                gateway: 'Google SDK'
            };
        } catch (err) {
            aiTelemetryService.recordFailure('Gemini Direct', err.message);
            console.warn(`[AI Service Failover] Gemini Direct failed: ${err.message}. Transitioning to Layer 2.`);
        }

        // Layer 2: Gemini OpenRouter
        try {
            aiTelemetryService.recordFallbackActivation('Gemini OpenRouter');
            const layer2StartTime = Date.now();
            const reply = await callOpenRouterChat('google/gemini-2.5-flash:free', prompt);
            const latency = Date.now() - layer2StartTime;
            aiTelemetryService.recordSuccess('Gemini OpenRouter', latency);
            return {
                reply: reply.trim(),
                provider: 'Gemini OpenRouter',
                gateway: 'OpenRouter'
            };
        } catch (err) {
            aiTelemetryService.recordFailure('Gemini OpenRouter', err.message);
            console.warn(`[AI Service Failover] Gemini OpenRouter failed: ${err.message}. Transitioning to Layer 3.`);
        }

        // Layer 3: Llama 3 OpenRouter
        try {
            aiTelemetryService.recordFallbackActivation('Llama 3 OpenRouter');
            const layer3StartTime = Date.now();
            const reply = await callOpenRouterChat('meta-llama/llama-3-8b-instruct:free', prompt);
            const latency = Date.now() - layer3StartTime;
            aiTelemetryService.recordSuccess('Llama 3 OpenRouter', latency);
            return {
                reply: reply.trim(),
                provider: 'Llama 3 OpenRouter',
                gateway: 'OpenRouter'
            };
        } catch (err) {
            aiTelemetryService.recordFailure('Llama 3 OpenRouter', err.message);
            console.warn(`[AI Service Failover] Llama 3 OpenRouter failed: ${err.message}. Transitioning to Layer 4.`);
        }

        // Layer 4: Qwen 2.5 OpenRouter
        try {
            aiTelemetryService.recordFallbackActivation('Qwen 2.5 OpenRouter');
            const layer4StartTime = Date.now();
            const reply = await callOpenRouterChat('qwen/qwen-2.5-7b-instruct:free', prompt);
            const latency = Date.now() - layer4StartTime;
            aiTelemetryService.recordSuccess('Qwen 2.5 OpenRouter', latency);
            return {
                reply: reply.trim(),
                provider: 'Qwen 2.5 OpenRouter',
                gateway: 'OpenRouter'
            };
        } catch (err) {
            aiTelemetryService.recordFailure('Qwen 2.5 OpenRouter', err.message);
            console.warn(`[AI Service Failover] All AI open weight layers failed: ${err.message}. Falling back to offline fallback.`);
        }

        // Layer 5: Graceful offline message
        aiTelemetryService.recordLocalFallback();
        return {
            reply: "Main and fallback AI services are currently undergoing maintenance. Please try again in a few moments!",
            provider: 'Local Fallback',
            gateway: 'In-Memory'
        };
    }
}

// Initialize OpenRouter client for fallback routes
const OpenAI = require('openai');
let openrouterClient;
if (process.env.OPENROUTER_API_KEY) {
    openrouterClient = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: process.env.OPENROUTER_API_KEY
    });
}

/**
 * Helper to execute chat completions through OpenRouter's free-tier gateway.
 */
async function callOpenRouterChat(model, prompt) {
    if (!openrouterClient) {
        throw new Error('OpenRouter client not initialized (missing API key)');
    }
    const completion = await openrouterClient.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
    });
    const reply = completion.choices[0]?.message?.content;
    if (!reply) {
        throw new Error(`Empty response from OpenRouter model: ${model}`);
    }
    return reply;
}

module.exports = new AIService();

