'use strict';

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/rbac');
const {
  verifyOrganizationSchema,
  updateUserStatusSchema,
  auditLogQuerySchema
} = require('../validators/admin.validators');

router.get('/organizations', authenticate, requireAdmin, adminController.getOrganizations);
router.post('/organizations/:id/verify', authenticate, requireAdmin, validate(verifyOrganizationSchema), adminController.verifyOrganization);
router.patch('/users/:id/status', authenticate, requireAdmin, validate(updateUserStatusSchema), adminController.updateUserStatus);
router.get('/system/status', authenticate, requireAdmin, adminController.getSystemStatus);
router.get('/audit-logs', authenticate, requireAdmin, validate(auditLogQuerySchema, 'query'), adminController.getAuditLogs);

module.exports = router;
