const { GoogleGenerativeAI } = require('@google/generative-ai');
const Trend = require('../models/Trend');

// Initialize Gemini only if key exists to prevent crash on startup
let genAI;
let aiModel;
if (process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    aiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); // ✅ Valid model ID
}

// In-Memory Cache (Trend ID -> { data, timestamp })
const analysisCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

class AIService {
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

        // 4. Prompt Preparation
        const description = trend.content || trend.description || "No detailed description available. Analyze based on title.";
        const prompt = `Analyze this trend:

Title: ${trend.title}
Description: ${description}

Return ONLY valid JSON with no markdown formatting:
{
  "sentimentScore": number (0-100),
  "viralityScore": number (0-10),
  "keyDrivers": [{"title": "string", "desc": "string"}],
  "aiPrediction": "string",
  "confidence": number (0-100)
}

Do not include explanation. ONLY JSON.`;

        // 5. Gemini API Call
        try {
            console.log(`[AI Service] Calling Gemini (2.5-flash) for: ${trendId}`);
            const result = await aiModel.generateContent(prompt);
            const responseText = result.response.text();
            
            // Gemini sometimes returns markdown JSON formatting e.g., ```json { ... } ```
            const cleanText = responseText.replace(/```json\n?|```/g, '').trim();

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
     * AI Chat functionality (Free Conversational Model)
     */
    async chatWithAI(message, trendContext, history = []) {
        if (!aiModel) {
            return {
                reply: "I'm sorry, my AI systems are currently offline. Please check the API keys."
            };
        }

        try {
            let systemContext = `You are Shahkal AI, a highly intelligent, conversational, and friendly AI assistant built into the AITrendTracker app. CRITICAL RULE: You MUST always respond in "Hinglish" (Hindi/Urdu language written in the English alphabet, e.g., "Haan bhai, main bilkul samajh gaya!"). DO NOT use the Devanagari (हिंदी) script. Speak naturally, like a cool tech-savvy Indian friend.\n`;
            
            if (trendContext && trendContext.title) {
                systemContext += `\nThe user is currently looking at a trend called: "${trendContext.title}".\n`;
                if (trendContext.description) {
                    systemContext += `Description: "${trendContext.description}".\n`;
                }
                systemContext += `Use this context to answer questions specifically about this trend. DO NOT format your response as JSON. Reply normally as a chatbot.\n\n`;
            } else {
                systemContext += `\nThe user is asking a general question about AI trends. DO NOT format your response as JSON. Reply normally as a chatbot.\n\n`;
            }

            // Convert history to text for prompt context
            const conversationLog = history.map(msg => `${msg.role === 'model' ? 'Shahkal AI' : 'User'}: ${msg.parts[0].text}`).join('\n');
            
            const prompt = `${systemContext}\n--- Conversation History ---\n${conversationLog}\n\nUser: ${message}\nShahkal AI:`;

            console.log(`[AI Service] Chatting. Trend Context: ${trendContext?.title || 'None'}`);
            const result = await aiModel.generateContent(prompt);
            const responseText = result.response.text();
            
            return {
                reply: responseText.trim()
            };
        } catch (error) {
            console.error("[AI Service] Chat Error:", error);
            
            // Check if it's a rate limit error (429)
            if (error.status === 429 || error.message.includes('429')) {
                return {
                    reply: "Google Gemini's free tier rate limit has been reached due to background processes gathering data. Please wait about 1 minute and try asking me again!"
                };
            }

            return {
                reply: "I'm having trouble connecting to my brain right now. Please try again later."
            };
        }
    }
}

module.exports = new AIService();
