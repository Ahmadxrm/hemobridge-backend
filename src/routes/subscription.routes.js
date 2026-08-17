'use strict';

const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscription.controller');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { requireOrganization } = require('../middleware/rbac');
const {
  createSubscriptionSchema,
  renewSubscriptionSchema
} = require('../validators/subscription.validators');

router.get('/plans', subscriptionController.getPlans);
router.post('/subscriptions', authenticate, requireOrganization, validate(createSubscriptionSchema), subscriptionController.createSubscription);
router.patch('/subscriptions/:id/renew', authenticate, requireOrganization, validate(renewSubscriptionSchema), subscriptionController.renewSubscription);
router.get('/organizations/:id/payments', authenticate, subscriptionController.getPayments);
router.post('/payments/webhook', subscriptionController.webhook);

module.exports = router;
