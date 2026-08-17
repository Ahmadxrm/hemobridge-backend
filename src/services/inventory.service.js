'use strict';

const inventoryRepo = require('../repositories/inventory.repository');
const auditRepo = require('../repositories/audit.repository');
const notificationService = require('../integrations/notifications/notification.service');
const { AuthorizationError, BusinessRuleError, ValidationError, NotFoundError } = require('../utils/errors');
const { AUDIT_EVENTS } = require('../utils/constants');
const { parsePagination, buildPagination } = require('../utils/helpers');
const { query } = require('../config/database');
const logger = require('../utils/logger');

async function createInventoryUnit(orgId, data, actorUser) {
    if (actorUser.organizationId !== orgId) {
        throw new AuthorizationError('Organization mismatch');
    }

    if (new Date(data.expiryDate) <= new Date()) {
        throw new BusinessRuleError('Expiry date must be in the future');
    }

    data.unitsAvailable = data.quantity;
    const unit = await inventoryRepo.create({ ...data, organizationId: orgId });
    
    await auditRepo.logEvent(AUDIT_EVENTS.INVENTORY_CREATED, {
        actorId: actorUser.id,
        targetId: unit.id,
        details: { bloodType: unit.bloodType, quantity: unit.quantity }
    });

    await checkAndAlertLowStock(orgId).catch(err => logger.error('Low stock alert error:', err));
    return unit;
}

async function getInventoryUnits(orgId, reqQuery) {
    const { limit, offset, page } = parsePagination(reqQuery);
    const { data, count } = await inventoryRepo.findByOrganization(orgId, { limit, offset });
    return buildPagination(data, count, page, limit);
}

async function updateInventoryUnit(unitId, orgId, data, actorUser) {
    if (actorUser.organizationId !== orgId) {
        throw new AuthorizationError('Organization mismatch');
    }
    const unit = await inventoryRepo.findById(unitId);
    if (!unit) throw new NotFoundError('Inventory unit not found');
    if (unit.organizationId !== orgId) throw new AuthorizationError('Not authorized');

    if (data.quantity !== undefined && data.quantity < 0) {
        throw new ValidationError('Quantity cannot be negative');
    }

    const version = data.expectedVersion || unit.version;
    const updated = await inventoryRepo.update(unitId, orgId, data, version);

    await auditRepo.logEvent(AUDIT_EVENTS.INVENTORY_UPDATED, {
        actorId: actorUser.id,
        targetId: unitId,
        details: data
    });

    await checkAndAlertLowStock(orgId).catch(err => logger.error('Low stock alert error:', err));
    return updated;
}

async function deleteInventoryUnit(unitId, orgId, actorUser) {
    if (actorUser.organizationId !== orgId) throw new AuthorizationError('Organization mismatch');
    
    const unit = await inventoryRepo.findById(unitId);
    if (!unit) throw new NotFoundError('Inventory unit not found');
    if (unit.organizationId !== orgId) throw new AuthorizationError('Not authorized');

    await inventoryRepo.delete(unitId, orgId);

    await auditRepo.logEvent(AUDIT_EVENTS.INVENTORY_DELETED, {
        actorId: actorUser.id,
        targetId: unitId
    });

    return { message: 'Inventory unit deleted' };
}

async function getDashboard(orgId) {
    const dashboard = await inventoryRepo.getDashboard(orgId);
    return dashboard;
}

async function checkAndAlertLowStock(orgId) {
    const dashboard = await inventoryRepo.getDashboard(orgId);
    const THRESHOLD = 10; // Simple fallback threshold
    
    for (const bt of dashboard.bloodTypes || []) {
        if (bt.totalAvailable < THRESHOLD) {
            const hasAlert = await query('SELECT id FROM low_stock_alerts WHERE organization_id = $1 AND blood_type = $2 AND resolved = false LIMIT 1', [orgId, bt.bloodType]);
            if (hasAlert.rows.length === 0) {
                await query('INSERT INTO low_stock_alerts (organization_id, blood_type, threshold, current_stock) VALUES ($1, $2, $3, $4)', [orgId, bt.bloodType, THRESHOLD, bt.totalAvailable]);
                await notificationService.notifyLowStock(orgId, bt.bloodType, bt.totalAvailable);
            }
        }
    }
}

module.exports = {
    createInventoryUnit,
    getInventoryUnits,
    updateInventoryUnit,
    deleteInventoryUnit,
    getDashboard,
    checkAndAlertLowStock
};
