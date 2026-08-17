'use strict';

const Joi = require('joi');

const createDonationRequestSchema = Joi.object({
  bloodType: Joi.string().valid('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-').required(),
  unitsNeeded: Joi.number().integer().min(1).required(),
  urgency: Joi.string().valid('ROUTINE', 'URGENT', 'CRITICAL').default('URGENT'),
  message: Joi.string().optional(),
  searchRadiusKm: Joi.number().default(25),
  latitude: Joi.number().min(-90).max(90).optional(),
  longitude: Joi.number().min(-180).max(180).optional(),
  expiresAt: Joi.date().iso().optional(),
});

const donorResponseSchema = Joi.object({
  status: Joi.string().valid('ACCEPTED', 'DECLINED').required(),
  message: Joi.string().optional(),
  declineReason: Joi.string().optional(),
  availableDate: Joi.date().iso().optional(),
  availableTime: Joi.string().optional(),
});

module.exports = {
  createDonationRequestSchema,
  donorResponseSchema,
};
