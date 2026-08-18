'use strict';

const inventoryRepo = require('../repositories/inventory.repository');
const auditRepo = require('../repositories/audit.repository');
const notificationService = require('../integrations/notifications/notification.service');
const { AuthorizationError, BusinessRuleError, ValidationError, NotFoundError } = require('../utils/errors');
const { AUDIT_EVENTS } = require('../utils/constants');
const { parsePagination, buildPagination, combineBloodType } = require('../utils/helpers');
const { query } = require('../config/database');
const logger = require('../utils/logger');

async function createInventoryUnit(orgId, data, actorUser) {
  // Org ownership check — org users can only add to their own org
  if (actorUser.organizationId && actorUser.organizationId !== orgId) {
    throw new AuthorizationError('Organization mismatch');
  }

  if (new Date(data.expiryDate) <= new Date()) {
    throw new BusinessRuleError('Expiry date must be in the future');
  }

  const bloodType = data.bloodType || (data.bloodGroup && data.rhesusFactor ? combineBloodType(data.bloodGroup, data.rhesusFactor) : null);
  if (!bloodType) {
    throw new ValidationError('Blood type is required');
  }

  const unitData = {
    bloodType,
    quantity: data.quantity,
    unitsAvailable: data.quantity,
    expiryDate: data.expiryDate,
    collectionDate: data.collectionDate,
    componentType: data.componentType || 'WHOLE_BLOOD',
    batchNumber: data.batchNumber,
    storageLocation: data.storageLocation,
    notes: data.notes,
  };

  const unit = await inventoryRepo.create(orgId, unitData);

  await auditRepo.log({
    actorId: actorUser.id,
    actorRole: actorUser.role,
    action: AUDIT_EVENTS.INVENTORY_CREATED,
    entityType: 'INVENTORY',
    entityId: unit.id,
    metadata: { bloodType: unit.blood_type, quantity: unit.quantity },
  });

  checkAndAlertLowStock(orgId).catch((err) => logger.error('Low stock check error', { error: err.message }));

  return unit;
}

async function getInventoryUnits(orgId, reqQuery) {
  const { limit, offset, page } = parsePagination(reqQuery);
  const { bloodType, includeExpired } = reqQuery;

  const result = await inventoryRepo.findByOrganization(orgId, {
    bloodType,
    includeExpired: includeExpired === 'true',
    page,
    limit,
  });

  return buildPagination(result.data, result.total, page, limit);
}

async function updateInventoryUnit(unitId, orgId, data, actorUser) {
  if (actorUser.organizationId && actorUser.organizationId !== orgId) {
    throw new AuthorizationError('Organization mismatch');
  }

  const unit = await inventoryRepo.findById(unitId);
  if (!unit) throw new NotFoundError('Inventory unit not found');
  if (unit.organization_id !== orgId) throw new AuthorizationError('You do not own this inventory unit');

  if (data.quantity !== undefined && data.quantity < 0) {
    throw new ValidationError('Quantity cannot be negative');
  }

  if (data.expiryDate && new Date(data.expiryDate) <= new Date()) {
    throw new BusinessRuleError('Expiry date must be in the future');
  }

  const expectedVersion = data.expectedVersion !== undefined ? data.expectedVersion : unit.version;
  const updated = await inventoryRepo.update(unitId, orgId, data, expectedVersion);

  await auditRepo.log({
    actorId: actorUser.id,
    actorRole: actorUser.role,
    action: AUDIT_EVENTS.INVENTORY_UPDATED,
    entityType: 'INVENTORY',
    entityId: unitId,
    metadata: data,
  });

  checkAndAlertLowStock(orgId).catch((err) => logger.error('Low stock check error', { error: err.message }));

  return updated;
}

async function deleteInventoryUnit(unitId, orgId, actorUser) {
  if (actorUser.organizationId && actorUser.organizationId !== orgId) {
    throw new AuthorizationError('Organization mismatch');
  }

  const unit = await inventoryRepo.findById(unitId);
  if (!unit) throw new NotFoundError('Inventory unit not found');
  if (unit.organization_id !== orgId) throw new AuthorizationError('You do not own this inventory unit');

  await inventoryRepo.delete(unitId, orgId);

  await auditRepo.log({
    actorId: actorUser.id,
    actorRole: actorUser.role,
    action: AUDIT_EVENTS.INVENTORY_DELETED,
    entityType: 'INVENTORY',
    entityId: unitId,
    metadata: { bloodType: unit.blood_type, quantity: unit.quantity },
  });

  return { deleted: true, id: unitId };
}

async function getDashboard(orgId) {
  return inventoryRepo.getDashboard(orgId);
}

/**
 * Check for low stock and create alerts if needed.
 * Called after inventory create/update — fire and forget.
 */
async function checkAndAlertLowStock(orgId) {
  try {
    const orgResult = await query(
      'SELECT low_stock_threshold FROM organizations WHERE id = $1',
      [orgId]
    );
    const threshold = orgResult.rows[0]?.low_stock_threshold || 5;

    const lowResult = await query(`
      SELECT blood_type, SUM(units_available) as total_available
      FROM blood_inventory
      WHERE organization_id = $1 AND is_expired = false AND is_available = true
      GROUP BY blood_type
      HAVING SUM(units_available) <= $2
    `, [orgId, threshold]);

    for (const row of lowResult.rows) {
      // Check for existing unresolved alert
      const existing = await query(
        `SELECT id FROM low_stock_alerts WHERE organization_id = $1 AND blood_type = $2 AND resolved_at IS NULL LIMIT 1`,
        [orgId, row.blood_type]
      );

      if (existing.rows.length === 0) {
        await query(
          `INSERT INTO low_stock_alerts (organization_id, blood_type, threshold, current_stock) VALUES ($1, $2, $3, $4)`,
          [orgId, row.blood_type, threshold, row.total_available]
        );

        // Trigger notification (fire and forget)
        notificationService.notifyLowStockAlert({
          orgId,
          bloodType: row.blood_type,
          currentStock: row.total_available,
          threshold,
        }).catch((err) => logger.warn('Low stock notification failed', { error: err.message }));

        logger.info('Low stock alert created', { orgId, bloodType: row.blood_type, stock: row.total_available });
      }
    }
  } catch (err) {
    logger.error('checkAndAlertLowStock failed', { error: err.message, orgId });
  }
}

module.exports = {
  createInventoryUnit,
  getInventoryUnits,
  updateInventoryUnit,
  deleteInventoryUnit,
  getDashboard,
  checkAndAlertLowStock,
};
