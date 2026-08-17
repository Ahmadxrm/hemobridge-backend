'use strict';

const express = require('express');
const router = express.Router();
const requestController = require('../controllers/request.controller');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { requireOrganization } = require('../middleware/rbac');
const {
  createRequestSchema,
  requestQuerySchema,
  respondRequestSchema,
  updateRequestStatusSchema,
  transferDetailsSchema
} = require('../validators/request.validators');

router.post('/', authenticate, requireOrganization, validate(createRequestSchema), requestController.createRequest);
router.get('/', authenticate, validate(requestQuerySchema, 'query'), requestController.getRequests);
router.get('/:id', authenticate, requestController.getRequest);
router.patch('/:id/respond', authenticate, requireOrganization, validate(respondRequestSchema), requestController.respondToRequest);
router.patch('/:id/status', authenticate, requireOrganization, validate(updateRequestStatusSchema), requestController.updateStatus);
router.post('/:id/transfer-details', authenticate, requireOrganization, validate(transferDetailsSchema), requestController.addTransferDetails);
router.post('/:id/confirm-received', authenticate, requireOrganization, requestController.confirmReceived);

module.exports = router;
