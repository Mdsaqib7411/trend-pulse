const alertService = require('../services/alertService');

/**
 * GET /api/notifications
 * Returns all notifications for the authenticated user
 */
exports.getNotifications = async (req, res, next) => {
    try {
        const userId = req.user.uid;
        const notifications = await alertService.getUserNotifications(userId);
        const unreadCount = await alertService.getUnreadCount(userId);
        
        res.status(200).json({ 
            success: true, 
            unreadCount,
            data: notifications 
        });
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /api/notifications/:id/read
 * Marks a single notification as read
 */
exports.markAsRead = async (req, res, next) => {
    try {
        const userId = req.user.uid;
        const { id } = req.params;
        
        const updated = await alertService.markAsRead(id, userId);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }
        
        res.status(200).json({ success: true, data: updated });
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /api/notifications/read-all
 * Marks all notifications as read for the user
 */
exports.markAllAsRead = async (req, res, next) => {
    try {
        const userId = req.user.uid;
        const result = await alertService.markAllAsRead(userId);
        
        res.status(200).json({ 
            success: true, 
            message: `${result.modifiedCount} notifications marked as read` 
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/notifications/unread-count
 * Returns just the unread count (for badge display)
 */
exports.getUnreadCount = async (req, res, next) => {
    try {
        const userId = req.user.uid;
        const count = await alertService.getUnreadCount(userId);
        
        res.status(200).json({ success: true, unreadCount: count });
    } catch (error) {
        next(error);
    }
};

/**
 * DELETE /api/notifications/clear-all
 * Deletes ALL notifications for the user
 */
exports.clearAll = async (req, res, next) => {
    try {
        const userId = req.user.uid;
        const result = await alertService.deleteAll(userId);
        
        res.status(200).json({ 
            success: true, 
            message: `${result.deletedCount} notifications cleared` 
        });
    } catch (error) {
        next(error);
    }
};
