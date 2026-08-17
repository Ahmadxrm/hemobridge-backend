'use strict';

const express = require('express');
const router = express.Router();
const donationController = require('../controllers/donation.controller');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { requireOrganization, requireDonor } = require('../middleware/rbac');
const {
  createDonationRequestSchema,
  donorResponseSchema
} = require('../validators/donation.validators');

router.post('/', authenticate, requireOrganization, validate(createDonationRequestSchema), donationController.createDonationRequest);
router.get('/:id', authenticate, donationController.getDonationRequest);
router.get('/:id/matches', authenticate, requireOrganization, donationController.getMatches);
router.post('/:id/notify', authenticate, requireOrganization, donationController.notifyDonors);
router.post('/:id/responses', authenticate, requireDonor, validate(donorResponseSchema), donationController.submitResponse);
router.get('/:id/progress', authenticate, donationController.getProgress);
router.patch('/:id/close', authenticate, requireOrganization, donationController.close);

module.exports = router;
