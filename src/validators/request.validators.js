'use strict';

const Joi = require('joi');

const createRequestSchema = Joi.object({
  bloodType: Joi.string().valid('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-').optional(),
  bloodGroup: Joi.string().valid('A', 'B', 'AB', 'O').optional(),
  rhesusFactor: Joi.string().valid('positive', 'negative', '+', '-').optional(),
  unitsNeeded: Joi.number().integer().min(1).optional(),
  unitsRequired: Joi.number().integer().min(1).optional(),
  urgency: Joi.string().valid('ROUTINE', 'URGENT', 'CRITICAL').optional(),
  urgencyLevel: Joi.string().valid('ROUTINE', 'URGENT', 'CRITICAL', 'HIGH', 'NORMAL').optional(),
  patientInfo: Joi.string().optional(),
  notes: Joi.string().optional(),
  fulfillingOrgId: Joi.string().uuid().optional().allow(null),
  targetBloodBankId: Joi.string().uuid().optional().allow(null),
  componentType: Joi.string().optional(),
}).or('bloodType', 'bloodGroup');

const respondRequestSchema = Joi.object({
  status: Joi.string().valid('APPROVED', 'REJECTED').required(),
  responseNotes: Joi.string().optional(),
  rejectionReason: Joi.string().when('status', {
    is: 'REJECTED',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
});

const updateRequestStatusSchema = Joi.object({
  status: Joi.string().valid('PENDING', 'APPROVED', 'REJECTED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED').required(),
  notes: Joi.string().optional(),
  responseNotes: Joi.string().optional(),
  rejectionReason: Joi.string().optional(),
});

const transferDetailsSchema = Joi.object({
  courierName: Joi.string().optional(),
  courierPhone: Joi.string().optional(),
  vehicleNumber: Joi.string().optional(),
  trackingReference: Joi.string().optional(),
  estimatedArrival: Joi.date().iso().optional(),
  notes: Joi.string().optional(),
});

const requestQuerySchema = Joi.object({
  status: Joi.string().optional(),
  bloodType: Joi.string().valid('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-').optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

module.exports = {
  createRequestSchema,
  respondRequestSchema,
  updateRequestStatusSchema,
  transferDetailsSchema,
  requestQuerySchema,
};
