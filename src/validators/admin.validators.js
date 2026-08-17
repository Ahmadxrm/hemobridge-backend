'use strict';

const Joi = require('joi');

const verifyOrganizationSchema = Joi.object({
  status: Joi.string().valid('VERIFIED', 'REJECTED', 'SUSPENDED').required(),
  notes: Joi.string().optional(),
  rejectionReason: Joi.string().when('status', {
    is: 'REJECTED',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
});

const updateUserStatusSchema = Joi.object({
  status: Joi.string().valid('ACTIVE', 'INACTIVE', 'SUSPENDED').required(),
  reason: Joi.string().optional(),
});

const auditLogQuerySchema = Joi.object({
  action: Joi.string().optional(),
  actorId: Joi.string().uuid().optional(),
  entityType: Joi.string().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  from: Joi.date().iso().optional(),
  to: Joi.date().iso().optional(),
});

module.exports = {
  verifyOrganizationSchema,
  updateUserStatusSchema,
  auditLogQuerySchema,
};
