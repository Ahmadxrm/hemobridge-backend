'use strict';

const Joi = require('joi');

const updateDonorProfileSchema = Joi.object({
  fullName: Joi.string().optional(),
  dateOfBirth: Joi.date().iso().optional(),
  gender: Joi.string().valid('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY').optional(),
  address: Joi.string().optional(),
  lga: Joi.string().optional(),
  state: Joi.string().optional(),
  preferredChannel: Joi.string().valid('SMS', 'WHATSAPP', 'EMAIL', 'VOICE', 'IN_APP').optional(),
  healthInformation: Joi.string().optional(),
  latitude: Joi.number().min(-90).max(90).optional(),
  longitude: Joi.number().min(-180).max(180).optional(),
});

const updateAvailabilitySchema = Joi.object({
  isAvailable: Joi.boolean().required(),
});

module.exports = {
  updateDonorProfileSchema,
  updateAvailabilitySchema,
};
