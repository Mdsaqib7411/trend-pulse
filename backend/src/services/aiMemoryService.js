const User = require('../models/User');
const { UserActivity } = require('../models/UserActivity');
const logger = require('./loggerService');

class AIMemoryService {
    /**
     * Synthesises a bounded, lightweight user memory profile.
     * Combines saved trends, recent searches, categories, and interactions.
     * 
     * @param {string} userId Unique user identifier
     * @returns {Promise<string>} Bounded, structured memory profile string
     */
    async getUserMemoryProfile(userId) {
        if (!userId) {
            return 'Guest user. Custom personalization context is unavailable.';
        }

        try {
            // 1. Fetch user manual configurations (preferences, interests, savedTrends)
            const user = await User.findOne({ uid: userId })
                .select('preferences interests savedTrends')
                .maxTimeMS(2000)
                .lean();
            
            // 2. Fetch dynamic rolling 7-day category weight map from interactions
            const weightMap = await UserActivity.getUserWeightMap(userId);
            
            const savedCount = user?.savedTrends?.length || 0;
            const manualPreferences = user?.preferences || [];
            const manualInterests = user?.interests || [];
            
            // 3. Extract top category preferences (combining dynamic click weights + manual preferences)
            const topCategories = weightMap.slice(0, 3).map(c => c._id);
            const activeCategories = [...new Set([...manualPreferences, ...topCategories])].slice(0, 4);

            // 4. Extract top keywords / core concepts
            const dynamicKeywords = [];
            weightMap.forEach(w => {
                if (Array.isArray(w.keywords)) {
                    dynamicKeywords.push(...w.keywords.filter(Boolean));
                }
            });
            const activeKeywords = [...new Set([...manualInterests, ...dynamicKeywords])].slice(0, 6);

            // 5. Construct lightweight, bounded memory paragraph (Max 100 words)
            const memoryParts = [];
            
            if (activeCategories.length > 0) {
                memoryParts.push(`User's primary focus categories: [${activeCategories.join(', ')}].`);
            }
            if (activeKeywords.length > 0) {
                memoryParts.push(`Core keywords/concepts engaged with: [${activeKeywords.join(', ')}].`);
            }
            if (savedCount > 0) {
                memoryParts.push(`Saved/Bookmarked trends: ${savedCount} entries.`);
            }

            const profileSummary = memoryParts.length > 0
                ? memoryParts.join(' ')
                : 'New user with no historical preference profile. Tailor responses to broad emerging technology interests.';

            logger.info(`[AIMemoryService] Generated memory profile for user: ${userId}`);
            return profileSummary;
        } catch (error) {
            logger.error('[AIMemoryService] Memory retrieval failed: %s', error.message);
            return 'User profile offline. Provide default general insights.';
        }
    }
}

module.exports = new AIMemoryService();
