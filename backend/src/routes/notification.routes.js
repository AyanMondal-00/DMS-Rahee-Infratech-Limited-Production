const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

router.use(authenticateToken);

// Notifications
router.get('/', notificationController.getNotifications);
router.patch('/:id/read', notificationController.markAsRead);
router.patch('/read-all', notificationController.markAllAsRead);
router.delete('/clear-all', notificationController.clearAllNotifications);
router.delete('/:id', notificationController.deleteNotification);

// Email Logs & Trash / Restore
router.get('/emails', notificationController.getEmailLogs);
router.get('/emails/deleted', notificationController.getDeletedEmailLogs);
router.patch('/emails/restore-all', notificationController.restoreAllEmailLogs);
router.patch('/emails/:id/restore', notificationController.restoreEmailLog);
router.delete('/emails/clear-all', notificationController.clearAllEmailLogs);
router.delete('/emails/empty-trash', notificationController.emptyEmailTrash);
router.delete('/emails/:id/permanent', notificationController.permanentDeleteEmailLog);
router.delete('/emails/:id', notificationController.deleteEmailLog);

module.exports = router;
