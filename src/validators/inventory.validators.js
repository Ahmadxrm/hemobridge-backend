'use strict';

const Joi = require('joi');

const createInventorySchema = Joi.object({
  bloodType: Joi.string().valid('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-').required(),
  quantity: Joi.number().integer().min(1).required(),
  expiryDate: Joi.date().iso().greater('now').required(),
  collectionDate: Joi.date().iso().optional(),
  componentType: Joi.string().default('WHOLE_BLOOD').optional(),
  batchNumber: Joi.string().optional(),
  storageLocation: Joi.string().optional(),
  notes: Joi.string().optional(),
});

const updateInventorySchema = Joi.object({
  bloodType: Joi.string().valid('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-').optional(),
  quantity: Joi.number().integer().min(1).optional(),
  expiryDate: Joi.date().iso().greater('now').optional(),
  collectionDate: Joi.date().iso().optional(),
  componentType: Joi.string().optional(),
  batchNumber: Joi.string().optional(),
  storageLocation: Joi.string().optional(),
  notes: Joi.string().optional(),
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
