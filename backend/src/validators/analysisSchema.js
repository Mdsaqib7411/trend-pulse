/**
 * AI Analysis Schema — Strict Zod validation for LLM output.
 * Enforces structural JSON integrity on every LLM response.
 * Catches hallucinations, broken JSON, and missing fields.
 */

const { z } = require('zod');

const analysisSchema = z.object({
    summary: z.string().min(10, 'Summary must be at least 10 characters'),
    whyTrending: z.string().min(10, 'whyTrending must be at least 10 characters'),
    sentiment: z.enum(['positive', 'negative', 'neutral', 'mixed']),
    sentimentScore: z.number().int().min(0).max(100),
    targetAudience: z.string().min(2),
    prediction: z.enum(['growing', 'stable', 'declining']),
    viralityScore: z.number().min(0).max(10),
    audienceType: z.string().min(2),
    growthMomentum: z.enum(['rapid', 'moderate', 'slow']),
    alertType: z.enum(['velocity_spike', 'emerging_trend', 'none']),
    confidenceScore: z.number().int().min(0).max(100),
    keywords: z.array(z.string()).min(1).max(10)
});

module.exports = { analysisSchema };
