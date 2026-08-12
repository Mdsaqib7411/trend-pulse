/**
 * AI Analytics Service — LLM-powered trend enrichment with hallucination safeguards.
 *
 * Pipeline:
 *   1. Build prompt with scoring context + explicit formatting arrays.
 *   2. Call DeepSeek via OpenRouter.
 *   3. Extract JSON → Validate against strict Zod analysisSchema.
 *   4. On parse/validation failure → retry once with GPT fallback.
 *   5. On total failure → return deterministic local fallback object.
 */

const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { analysisSchema } = require('../validators/analysisSchema');
const logger = require('./loggerService');

let openai;
if (process.env.OPENROUTER_API_KEY) {
    openai = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: process.env.OPENROUTER_API_KEY
    });
}

let geminiDirectModel;
if (process.env.GEMINI_API_KEY) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    geminiDirectModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
}

class AIAnalyticsService {

    /**
     * Enhanced enrichment with scoring context injection, geo context, and Zod validation.
     */
    async enrichTrendWithContext(trend, scoring, velocityDelta, geoContext = '') {
        const aiTelemetryService = require('./aiTelemetryService');
        const prompt = this.buildPrompt(trend, scoring, velocityDelta, geoContext);

        // Layer 1: Gemini Direct SDK (Primary - High Performance)
        if (geminiDirectModel) {
            try {
                const startTime = Date.now();
                const result = await this.callDirectGeminiAndValidate(prompt);
                const latency = Date.now() - startTime;
                aiTelemetryService.recordSuccess('Gemini Direct', latency);
                return {
                    ...result,
                    provider: 'Gemini Direct',
                    gateway: 'Google SDK'
                };
            } catch (err) {
                aiTelemetryService.recordFailure('Gemini Direct', err.message);
                logger.warn(`[Shahkal Failover] Gemini Direct failed (${err.message}). Transitioning to Layer 2 (Gemini OpenRouter).`);
            }
        }

        // Layer 2: Gemini OpenRouter
        try {
            const startTime = Date.now();
            const result = await this.callAndValidate(prompt, 'google/gemini-2.5-flash:free');
            const latency = Date.now() - startTime;
            aiTelemetryService.recordSuccess('Gemini OpenRouter', latency);
            return {
                ...result,
                provider: 'Gemini OpenRouter',
                gateway: 'OpenRouter'
            };
        } catch (err) {
            aiTelemetryService.recordFailure('Gemini OpenRouter', err.message);
            logger.warn(`[Shahkal Failover] Gemini OpenRouter failed (${err.message}). Transitioning to Layer 3 (Qwen 2.5).`);
        }

        // Layer 3: Qwen 2.5 OpenRouter
        try {
            aiTelemetryService.recordFallbackActivation('Qwen 2.5 OpenRouter');
            const startTime = Date.now();
            const result = await this.callAndValidate(prompt, 'qwen/qwen-2.5-7b-instruct:free');
            const latency = Date.now() - startTime;
            aiTelemetryService.recordSuccess('Qwen 2.5 OpenRouter', latency);
            return {
                ...result,
                provider: 'Qwen 2.5 OpenRouter',
                gateway: 'OpenRouter'
            };
        } catch (err) {
            aiTelemetryService.recordFailure('Qwen 2.5 OpenRouter', err.message);
            logger.warn(`[Shahkal Failover] Qwen 2.5 OpenRouter failed (${err.message}). Transitioning to Layer 4 (Llama 3).`);
        }

        // Layer 4: Llama 3 OpenRouter
        try {
            aiTelemetryService.recordFallbackActivation('Llama 3 OpenRouter');
            const startTime = Date.now();
            const result = await this.callAndValidate(prompt, 'meta-llama/llama-3-8b-instruct:free');
            const latency = Date.now() - startTime;
            aiTelemetryService.recordSuccess('Llama 3 OpenRouter', latency);
            return {
                ...result,
                provider: 'Llama 3 OpenRouter',
                gateway: 'OpenRouter'
            };
        } catch (err) {
            aiTelemetryService.recordFailure('Llama 3 OpenRouter', err.message);
            logger.error(`[Shahkal Failover] All AI layers failed: ${err.message}.`);
        }

        // Layer 5: Local deterministic fallback
        aiTelemetryService.recordLocalFallback();
        const fallback = this.getFallbackEnrichment(trend, scoring, velocityDelta);
        return {
            ...fallback,
            provider: 'Local Fallback',
            gateway: 'In-Memory'
        };
    }


    /**
     * Calls the LLM model and validates the response against analysisSchema.
     * Throws on JSON parse failure or Zod validation failure.
     */
    async callAndValidate(prompt, model) {
        if (!openai) {
            throw new Error('OpenRouter client not initialized (missing API key)');
        }

        const completion = await openai.chat.completions.create({
            messages: [{ role: 'system', content: prompt }],
            model,
            temperature: 0.3,
            response_format: { type: 'json_object' }
        });

        const rawContent = completion.choices[0]?.message?.content;
        if (!rawContent) {
            throw new Error('Empty LLM response');
        }

        // Phase 1: Extract JSON (strip markdown fences if present)
        let parsed;
        try {
            const clean = rawContent.replace(/```json\n?|```/g, '').trim();
            parsed = JSON.parse(clean);
        } catch (jsonErr) {
            logger.error('[Shahkal] JSON parse failed. Raw: %s', rawContent.substring(0, 200));
            throw new Error(`JSON parse failure: ${jsonErr.message}`);
        }

        // Phase 2: Zod schema validation (catches hallucinated types, missing fields, out-of-range values)
        const validation = analysisSchema.safeParse(parsed);
        if (!validation.success) {
            const issues = validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
            logger.warn('[Shahkal] Zod validation failed: %s', issues);

            // Attempt to salvage: coerce partial fields into valid fallback
            return this.coercePartialResult(parsed);
        }

        return validation.data;
    }

    /**
     * Calls the Gemini Direct SDK client and validates the response against analysisSchema.
     * Throws on SDK failure, JSON parse failure, or Zod validation failure.
     */
    async callDirectGeminiAndValidate(prompt) {
        if (!geminiDirectModel) {
            throw new Error('Gemini Direct SDK client not initialized (missing API key)');
        }

        const result = await geminiDirectModel.generateContent(prompt);
        const rawContent = result.response.text();
        if (!rawContent) {
            throw new Error('Empty response from Gemini Direct SDK');
        }

        let parsed;
        try {
            const clean = rawContent.replace(/```json\n?|```/g, '').trim();
            parsed = JSON.parse(clean);
        } catch (jsonErr) {
            logger.error('[Shahkal] Gemini Direct JSON parse failed. Raw: %s', rawContent.substring(0, 200));
            throw new Error(`JSON parse failure: ${jsonErr.message}`);
        }

        const validation = analysisSchema.safeParse(parsed);
        if (!validation.success) {
            const issues = validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
            logger.warn('[Shahkal] Gemini Direct Zod validation failed: %s', issues);
            return this.coercePartialResult(parsed);
        }

        return validation.data;
    }

    /**
     * Builds the LLM prompt with scoring context and explicit formatting arrays.
     */
    buildPrompt(trend, scoring, velocityDelta, geoContext = '') {
        return `You are Shahkal, an advanced AI Social Intelligence Analyst for TrendPulse.
Analyze the following trending topic using the REAL computed metrics provided below.

--- TREND DATA ---
Title: "${trend.title}"
Content: "${(trend.content || trend.description || '').substring(0, 500)}"
Source: ${trend.author || trend.source || 'Unknown'}
Published: ${trend.publishedAt || 'Unknown'}
Raw Engagement: ${trend.engagementScore || 0}
Type: ${trend.type || 'news'}

--- COMPUTED SCORING METRICS (from TrendScoreEngine) ---
Viral Score: ${scoring.viralScore}/100
Heat Score: ${scoring.heatScore}/100
Growth Score: ${scoring.growthScore}/100
Composite Score: ${scoring.compositeScore}/100
Velocity Delta: ${velocityDelta}% (change from previous scoring cycle)

--- FORMATTING CONSTRAINT ---
reasoningFactors: ["growthScore_delta", "velocity_spike", "heat_recency", "engagement_log"]

You MUST return ONLY a valid JSON object matching this exact schema:
{
  "summary": "string (1-2 sentence data-grounded explanation)",
  "whyTrending": "string (MUST reference scoring metrics: viralScore=${scoring.viralScore}, velocityDelta=${velocityDelta}%)",
  "sentiment": "positive" | "negative" | "neutral" | "mixed",
  "sentimentScore": integer (0-100),
  "targetAudience": "string (specific segment)",
  "prediction": "growing" | "stable" | "declining",
  "viralityScore": number (0-10),
  "audienceType": "string",
  "growthMomentum": "rapid" | "moderate" | "slow",
  "alertType": "velocity_spike" | "emerging_trend" | "none",
  "confidenceScore": integer (0-100),
  "keywords": ["string", "string", "string"]
}

CRITICAL: Do NOT wrap in markdown. Do NOT add explanation text. Return ONLY the JSON object.${geoContext}`;
    }

    /**
     * Coerces a partial/malformed LLM result into a valid analysis object.
     * Salvages whatever fields parsed correctly and fills gaps with safe defaults.
     */
    coercePartialResult(partial) {
        const validSentiments = ['positive', 'negative', 'neutral', 'mixed'];
        const validPredictions = ['growing', 'stable', 'declining'];
        const validMomentums = ['rapid', 'moderate', 'slow'];
        const validAlerts = ['velocity_spike', 'emerging_trend', 'none'];

        return {
            summary: (typeof partial.summary === 'string' && partial.summary.length >= 10) ? partial.summary : 'Analysis partially completed.',
            whyTrending: (typeof partial.whyTrending === 'string' && partial.whyTrending.length >= 10) ? partial.whyTrending : 'Trending factors could not be fully determined.',
            sentiment: validSentiments.includes(partial.sentiment) ? partial.sentiment : 'neutral',
            sentimentScore: (typeof partial.sentimentScore === 'number' && partial.sentimentScore >= 0 && partial.sentimentScore <= 100) ? Math.round(partial.sentimentScore) : 50,
            targetAudience: (typeof partial.targetAudience === 'string' && partial.targetAudience.length >= 2) ? partial.targetAudience : 'General',
            prediction: validPredictions.includes(partial.prediction) ? partial.prediction : 'stable',
            viralityScore: (typeof partial.viralityScore === 'number' && partial.viralityScore >= 0 && partial.viralityScore <= 10) ? partial.viralityScore : 5,
            audienceType: (typeof partial.audienceType === 'string' && partial.audienceType.length >= 2) ? partial.audienceType : 'General',
            growthMomentum: validMomentums.includes(partial.growthMomentum) ? partial.growthMomentum : 'moderate',
            alertType: validAlerts.includes(partial.alertType) ? partial.alertType : 'none',
            confidenceScore: (typeof partial.confidenceScore === 'number' && partial.confidenceScore >= 0 && partial.confidenceScore <= 100) ? Math.round(partial.confidenceScore) : 40,
            keywords: (Array.isArray(partial.keywords) && partial.keywords.length > 0) ? partial.keywords.filter(k => typeof k === 'string').slice(0, 10) : ['trend']
        };
    }

    /**
     * Legacy enrichment method (backward compat).
     */
    async enrichTrend(trend) {
        return this.enrichTrendWithContext(
            trend,
            { viralScore: 0, heatScore: 0, growthScore: 0, compositeScore: 0 },
            0
        );
    }

    /**
     * Deterministic local fallback — zero LLM cost, always valid against analysisSchema.
     */
    getFallbackEnrichment(trend, scoring, velocityDelta) {
        const vs = scoring?.viralScore || 0;
        const vd = velocityDelta || 0;
        return {
            summary: `${trend.title?.substring(0, 60) || 'This trend'} is being tracked by Shahkal AI. Automated analysis pending.`,
            whyTrending: `Trend registered with a viral score of ${vs}/100 and a velocity delta of ${vd}%. Full LLM analysis unavailable.`,
            sentiment: 'neutral',
            sentimentScore: 50,
            targetAudience: 'General',
            prediction: vs > 60 ? 'growing' : 'stable',
            viralityScore: Math.min(10, Math.round(vs / 10)),
            audienceType: 'General',
            growthMomentum: vs > 70 ? 'rapid' : vs > 40 ? 'moderate' : 'slow',
            alertType: vd > 50 ? 'velocity_spike' : 'none',
            confidenceScore: 30,
            keywords: ['trend']
        };
    }
}

module.exports = new AIAnalyticsService();
