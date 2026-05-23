const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { verifyToken } = require('../middlewares/authMiddleware');

// All routes require authentication
router.get('/', verifyToken, notificationController.getNotifications);
router.get('/unread-count', verifyToken, notificationController.getUnreadCount);
router.put('/read-all', verifyToken, notificationController.markAllAsRead);
router.delete('/clear-all', verifyToken, notificationController.clearAll);
router.put('/:id/read', verifyToken, notificationController.markAsRead);

module.exports = router;
