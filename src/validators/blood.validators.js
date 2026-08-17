'use strict';

const Joi = require('joi');

const bloodSearchQuerySchema = Joi.object({
  type: Joi.string().valid('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-').required(),
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required(),
  radius: Joi.number().min(1).max(500).default(50),
});

module.exports = {
  bloodSearchQuerySchema,
};
