/**
 * AI Trend Enhancer — Batch AI Insights
 * 
 * Adds AI-generated insights (summary, category, prediction) to each trend.
 * Uses Gemini API with aggressive in-memory caching to minimize API calls.
 * 
 * Output per trend:
 *   - aiSummary: string (1-2 sentence summary)
 *   - category: string (e.g., "AI Research", "Industry", "Regulation")
 *   - prediction: "growing" | "stable" | "declining"
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini
let aiModel;
if (process.env.GEMINI_API_KEY) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    aiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
}

// In-Memory Cache: title hash → { aiSummary, category, prediction, timestamp }
const insightsCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour (insights don't change fast)

class AITrendEnhancer {

    /**
     * Enhance an array of trends with AI insights.
     * Processes in a single batch Gemini call for efficiency.
     * 
     * @param {Array} trends - Array of trend objects
     * @returns {Array} - Same trends with aiSummary, category, prediction added
     */
    async enhanceTrends(trends) {
        if (!trends || trends.length === 0) return [];

        // Separate cached vs uncached trends
        const enhanced = [];
        const uncached = [];
        const uncachedIndices = [];

        for (let i = 0; i < trends.length; i++) {
            const cacheKey = this.getCacheKey(trends[i].title);
            const cached = insightsCache.get(cacheKey);

            if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
                // Use cached insights
                enhanced[i] = {
                    ...trends[i],
                    aiSummary: cached.aiSummary,
                    category: cached.category,
                    prediction: cached.prediction
                };
            } else {
                enhanced[i] = null; // placeholder
                uncached.push(trends[i]);
                uncachedIndices.push(i);
            }
        }

        // If all cached, return immediately
        if (uncached.length === 0) {
            console.log(`[AI Enhancer] All ${trends.length} trends served from cache`);
            return enhanced;
        }

        // Batch AI call for uncached trends
        let batchInsights = [];
        if (aiModel) {
            batchInsights = await this.batchAnalyze(uncached);
        }

        // Merge results back
        for (let i = 0; i < uncachedIndices.length; i++) {
            const idx = uncachedIndices[i];
            const trend = uncached[i];
            const insight = batchInsights[i] || this.getFallback(trend);

            // Cache the result
            const cacheKey = this.getCacheKey(trend.title);
            insightsCache.set(cacheKey, { ...insight, timestamp: Date.now() });

            enhanced[idx] = {
                ...trend,
                aiSummary: insight.aiSummary,
                category: insight.category,
                prediction: insight.prediction
            };
        }

        console.log(`[AI Enhancer] ${trends.length - uncached.length} cached, ${uncached.length} freshly analyzed`);
        return enhanced;
    }

    /**
     * Batch analyze multiple trends in a single Gemini call.
     * Much more efficient than individual calls.
     */
    async batchAnalyze(trends) {
        const trendList = trends.map((t, i) => 
            `${i + 1}. "${t.title}" (score: ${t.trendScore || 0}, source: ${t.source || 'unknown'})`
        ).join('\n');

        const prompt = `Analyze these trending topics and return ONLY a valid JSON array.
For each trend, provide:
- aiSummary: 1-2 sentence summary of why it's trending
- category: one of ["AI Research", "Industry", "Regulation", "Product Launch", "Open Source", "Healthcare AI", "Finance AI", "Robotics", "General Tech"]
- prediction: one of ["growing", "stable", "declining"]

Trends:
${trendList}

Return ONLY a JSON array with ${trends.length} objects, one per trend, in the SAME order. No markdown, no explanation.
Example: [{"aiSummary":"...","category":"...","prediction":"..."}]`;

        try {
            const result = await aiModel.generateContent(prompt);
            const responseText = result.response.text();
            const cleanText = responseText.replace(/```json\n?|```/g, '').trim();

            const parsed = JSON.parse(cleanText);

            if (!Array.isArray(parsed)) {
                console.warn('[AI Enhancer] Gemini returned non-array, using fallbacks');
                return trends.map(t => this.getFallback(t));
            }

            // Validate each item
            return parsed.map((item, i) => ({
                aiSummary: typeof item.aiSummary === 'string' ? item.aiSummary : this.getFallback(trends[i]).aiSummary,
                category: typeof item.category === 'string' ? item.category : 'General Tech',
                prediction: ['growing', 'stable', 'declining'].includes(item.prediction) ? item.prediction : 'stable'
            }));

        } catch (error) {
            console.error('[AI Enhancer] Batch analysis error:', error.message);
            return trends.map(t => this.getFallback(t));
        }
    }

    /**
     * Fallback when Gemini is unavailable
     */
    getFallback(trend) {
        const score = trend.trendScore || 0;
        return {
            aiSummary: `"${(trend.title || 'This topic').substring(0, 60)}" is currently trending in the AI space.`,
            category: this.guessCategory(trend.title || ''),
            prediction: score >= 110 ? 'growing' : score >= 80 ? 'stable' : 'declining'
        };
    }

    /**
     * Simple keyword-based category guess (fallback only)
     */
    guessCategory(title) {
        const t = title.toLowerCase();
        if (t.includes('gpt') || t.includes('llm') || t.includes('model') || t.includes('research')) return 'AI Research';
        if (t.includes('health') || t.includes('cancer') || t.includes('medical')) return 'Healthcare AI';
        if (t.includes('stock') || t.includes('invest') || t.includes('market')) return 'Finance AI';
        if (t.includes('robot') || t.includes('tesla')) return 'Robotics';
        if (t.includes('open source') || t.includes('github')) return 'Open Source';
        if (t.includes('launch') || t.includes('release') || t.includes('announce')) return 'Product Launch';
        if (t.includes('law') || t.includes('regul') || t.includes('ban')) return 'Regulation';
        return 'General Tech';
    }

    /**
     * Generate a stable cache key from title
     */
    getCacheKey(title) {
        return (title || '').toLowerCase().trim().replace(/\s+/g, '_').substring(0, 100);
    }

    /**
     * Get cache stats (for monitoring)
     */
    getCacheStats() {
        return {
            size: insightsCache.size,
            maxTTL: CACHE_TTL / 1000 + 's'
        };
    }
}

module.exports = new AITrendEnhancer();
