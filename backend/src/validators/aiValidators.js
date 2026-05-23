const { z } = require('zod');

/**
 * Strict character and structural bounds for /api/ai/chat payload.
 * Defends against prompt injection, memory bloat, and denial-of-wallet token abuse.
 */
const aiChatSchema = z.object({
    body: z.object({
        message: z.string({
            required_error: 'message is required'
        })
        .min(1, 'message cannot be empty')
        .max(500, 'message cannot exceed 500 characters'),

        history: z.array(
            z.object({
                role: z.enum(['user', 'model', 'assistant']),
                text: z.string().max(1000, 'history text cannot exceed 1000 characters')
            })
        )
        .max(10, 'history cannot exceed 10 messages')
        .optional()
        .default([]),

        trendContext: z.object({
            title: z.string().max(200, 'trendContext.title cannot exceed 200 characters').optional(),
            description: z.string().max(1000, 'trendContext.description cannot exceed 1000 characters').optional()
        })
        .optional()
    })
});

module.exports = { aiChatSchema };
