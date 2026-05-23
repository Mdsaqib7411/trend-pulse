const { z } = require('zod');

const syncUserSchema = z.object({
    body: z.object({
        email: z.string().email("Invalid email format"),
        displayName: z.string().optional(),
        photoURL: z.string().url("Invalid photoURL format").or(z.string().length(0)).optional(),
        deviceLocale: z.string().optional(),
        session: z.object({
            deviceName: z.string().optional(),
            platform: z.string().optional(),
            lastLoginAt: z.string().optional()
        }).optional()
    })
}).passthrough();

const updateProfileSchema = z.object({
    body: z.object({
        preferences: z.array(z.string()).optional(),
        fcmToken: z.string().optional(),
        displayName: z.string().optional(),
        photoURL: z.string().optional(),
        bio: z.string().max(200).optional(),
        interests: z.array(z.string()).optional(),
        preferredSources: z.array(z.string()).optional()
    })
}).passthrough();

const onboardUserSchema = z.object({
    body: z.object({
        categories: z.array(z.string()).min(1, "At least one category is required for onboarding")
    })
}).passthrough();

const saveTrendSchema = z.object({
    body: z.object({
        trendId: z.string().min(1, "trendId is required")
    })
}).passthrough();

module.exports = {
    syncUserSchema,
    updateProfileSchema,
    onboardUserSchema,
    saveTrendSchema
};
