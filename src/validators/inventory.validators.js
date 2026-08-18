'use strict';

const Joi = require('joi');

const createInventorySchema = Joi.object({
  bloodType: Joi.string().valid('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-').optional(),
  bloodGroup: Joi.string().valid('A', 'B', 'AB', 'O').optional(),
  rhesusFactor: Joi.string().valid('positive', 'negative', '+', '-').optional(),
  quantity: Joi.number().integer().min(1).required(),
  volumeMl: Joi.number().optional(),
  expiryDate: Joi.date().iso().greater('now').required(),
  collectionDate: Joi.date().iso().optional(),
  componentType: Joi.string().default('WHOLE_BLOOD').optional(),
  batchNumber: Joi.string().optional(),
  storageLocation: Joi.string().optional(),
  notes: Joi.string().optional(),
}).or('bloodType', 'bloodGroup');

const updateInventorySchema = Joi.object({
  bloodType: Joi.string().valid('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-').optional(),
  bloodGroup: Joi.string().valid('A', 'B', 'AB', 'O').optional(),
  rhesusFactor: Joi.string().valid('positive', 'negative', '+', '-').optional(),
  quantity: Joi.number().integer().optional(),
  volumeMl: Joi.number().optional(),
  expiryDate: Joi.date().iso().greater('now').optional(),
  collectionDate: Joi.date().iso().optional(),
  componentType: Joi.string().optional(),
  batchNumber: Joi.string().optional(),
  storageLocation: Joi.string().optional(),
  notes: Joi.string().optional(),
  expectedVersion: Joi.number().integer().optional(),
});

const inventoryQuerySchema = Joi.object({
  bloodType: Joi.string().valid('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-').optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  includeExpired: Joi.boolean().default(false),
});

module.exports = {
  createInventorySchema,
  updateInventorySchema,
  inventoryQuerySchema,
};
