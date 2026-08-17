'use strict';

const express = require('express');
const router = express.Router();
const donorController = require('../controllers/donor.controller');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const {
  updateDonorProfileSchema,
  updateAvailabilitySchema
} = require('../validators/donor.validators');

router.get('/:id', authenticate, donorController.getProfile);
router.patch('/:id/profile', authenticate, validate(updateDonorProfileSchema), donorController.updateProfile);
router.patch('/:id/availability', authenticate, validate(updateAvailabilitySchema), donorController.updateAvailability);
router.get('/:id/history', authenticate, donorController.getHistory);

module.exports = router;
