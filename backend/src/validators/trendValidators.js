const { z } = require('zod');

const trendCategorySchema = z.object({
    query: z.object({
        type: z.string().min(1, "Type query param is required")
    }).passthrough()
}).passthrough();

const trendSearchSchema = z.object({
    query: z.object({
        q: z.string().min(1, "Query param 'q' is required")
    }).passthrough()
}).passthrough();

const trendLocationSchema = z.object({
    query: z.object({
        country: z.string().min(1, "Country query param is required")
    }).passthrough()
}).passthrough();

const trendCompareSchema = z.object({
    query: z.object({
        id1: z.string().min(1, "id1 is required"),
        id2: z.string().min(1, "id2 is required")
    }).passthrough()
}).passthrough();

const idParamSchema = z.object({
    params: z.object({
        id: z.string().min(1, "ID param is required")
    }).passthrough()
}).passthrough();

// New standard validation schemas for Phase 1 stabilization
const trendForYouSchema = z.object({
    query: z.object({
        limit: z.preprocess((val) => (val ? parseInt(val, 10) : undefined), z.number().int().positive().optional()),
        scope: z.enum(['local', 'national', 'global', 'auto']).optional(),
        locale: z.string().optional()
    }).passthrough()
}).passthrough();

const trendEmergingSchema = z.object({
    query: z.object({
        limit: z.preprocess((val) => (val ? parseInt(val, 10) : undefined), z.number().int().positive().optional())
    }).passthrough()
}).passthrough();

const trendHeatmapSchema = z.object({
    query: z.object({
        limit: z.preprocess((val) => (val ? parseInt(val, 10) : undefined), z.number().int().positive().optional())
    }).optional().default({})
}).passthrough();

const trendInteractSchema = z.object({
    body: z.object({
        trendId: z.string().min(1, "trendId is required"),
        interactionType: z.enum(['click', 'like', 'bookmark', 'share', 'skip'], {
            errorMap: () => ({ message: "Invalid interactionType. Must be one of: click, like, bookmark, share, skip" })
        }),
        trendScope: z.string().optional()
    })
}).passthrough();

const trendBookmarkSchema = z.object({
    body: z.object({
        trendId: z.string().min(1, "trendId is required")
    })
}).passthrough();

module.exports = {
    trendCategorySchema,
    trendSearchSchema,
    trendLocationSchema,
    trendCompareSchema,
    idParamSchema,
    trendForYouSchema,
    trendEmergingSchema,
    trendHeatmapSchema,
    trendInteractSchema,
    trendBookmarkSchema
};
