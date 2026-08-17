'use strict';

const Joi = require('joi');

const createSubscriptionSchema = Joi.object({
  planId: Joi.string().uuid().required(),
});

const renewSubscriptionSchema = Joi.object({
  planId: Joi.string().uuid().optional(),
});

module.exports = {
  createSubscriptionSchema,
  renewSubscriptionSchema,
};
