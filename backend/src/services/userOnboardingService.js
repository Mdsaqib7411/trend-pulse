/**
 * User Onboarding Service — Cold start resolution.
 *
 * Processes explicit category selections from new signups to establish
 * an instant valid starter feed state in UserActivity.
 */

const { UserActivity } = require('../models/UserActivity');
const logger = require('./loggerService');

class UserOnboardingService {

    /**
     * Process onboarding category selections.
     * Creates synthetic "bookmark" interactions for chosen categories
     * so the recommendation engine has immediate signal.
     *
     * @param {string} userId
     * @param {string[]} selectedCategories — e.g. ["AI", "Cricket", "Finance"]
     */
    async processOnboarding(userId, selectedCategories) {
        if (!userId || !selectedCategories || selectedCategories.length === 0) return;

        const activities = selectedCategories.map(category => ({
            userId,
            trendId: `onboarding:${category.toLowerCase().replace(/\s+/g, '_')}`,
            interactionType: 'bookmark',
            weight: 5, // Bookmark weight
            category,
            keywords: [category.toLowerCase()]
        }));

        try {
            await UserActivity.insertMany(activities, { ordered: false });
            logger.info(`[Onboarding] Processed ${selectedCategories.length} category selections for ${userId}`);
        } catch (err) {
            // Ignore duplicate key errors from re-onboarding
            if (err.code !== 11000 && !err.message?.includes('duplicate')) {
                logger.error('[Onboarding] Error: %s', err.message);
            }
        }
    }
}

module.exports = new UserOnboardingService();
