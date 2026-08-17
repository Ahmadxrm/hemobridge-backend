'use strict';

const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/rbac');

router.get('/', authenticate, notificationController.getNotifications);
router.post('/send', authenticate, requireAdmin, notificationController.sendNotification);
router.patch('/users/:id/notification-preferences', authenticate, notificationController.updatePreferences);

module.exports = router;
