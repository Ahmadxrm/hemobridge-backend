'use strict';

const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventory.controller');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { requireOrganization } = require('../middleware/rbac');
const {
  createInventorySchema,
  inventoryQuerySchema,
  updateInventorySchema
} = require('../validators/inventory.validators');

router.post('/units', authenticate, requireOrganization, validate(createInventorySchema), inventoryController.createUnit);
router.get('/units', authenticate, requireOrganization, validate(inventoryQuerySchema, 'query'), inventoryController.getUnits);
router.patch('/units/:id', authenticate, requireOrganization, validate(updateInventorySchema), inventoryController.updateUnit);
router.delete('/units/:id', authenticate, requireOrganization, inventoryController.deleteUnit);
router.get('/dashboard', authenticate, requireOrganization, inventoryController.getDashboard);

module.exports = router;
