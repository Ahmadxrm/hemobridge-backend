'use strict';

const userRepo = require('../repositories/user.repository');
const orgRepo = require('../repositories/organization.repository');
const auditRepo = require('../repositories/audit.repository');
const { query } = require('../config/database');
const notificationService = require('../integrations/notifications/notification.service');
const { NotFoundError, BusinessRuleError } = require('../utils/errors');
const { AUDIT_EVENTS, USER_STATUS, ORG_STATUS } = require('../utils/constants');
const { parsePagination, buildPagination } = require('../utils/helpers');
const logger = require('../utils/logger');

/**
 * Admin Service — all privileged platform operations.
 * All methods in this service require ADMIN role.
 */

/**
 * Verify, reject, or suspend an organisation.
 */
async function verifyOrganization(orgId, { status, notes, rejectionReason, suspendedReason }, adminUser, req) {
  const org = await orgRepo.findById(orgId);
  if (!org) throw new NotFoundError('Organisation not found');

  const allowedStatuses = [ORG_STATUS.VERIFIED, ORG_STATUS.REJECTED, ORG_STATUS.SUSPENDED];
  if (!allowedStatuses.includes(status)) {
    throw new BusinessRuleError(`Invalid status. Allowed: ${allowedStatuses.join(', ')}`);
  }

  if (status === ORG_STATUS.REJECTED && !rejectionReason) {
    throw new BusinessRuleError('A rejection reason is required when rejecting an organisation');
  }

  const updateData = {
    status,
    verifiedBy: status === ORG_STATUS.VERIFIED ? adminUser.id : null,
    verificationNotes: notes || null,
    rejectionReason: status === ORG_STATUS.REJECTED ? rejectionReason : null,
    suspendedReason: status === ORG_STATUS.SUSPENDED ? (suspendedReason || notes) : null,
  };

  await orgRepo.updateStatus(orgId, status, updateData);

  // Also update the linked user's status
  const linkedUser = org.user_id;
  if (status === ORG_STATUS.VERIFIED) {
    await userRepo.updateStatus(linkedUser, USER_STATUS.ACTIVE);
  } else if (status === ORG_STATUS.SUSPENDED) {
    await userRepo.updateStatus(linkedUser, USER_STATUS.SUSPENDED);
  }

  // Notify the organisation owner
  if (status === ORG_STATUS.VERIFIED) {
    await notificationService.notifyOrganizationVerified({
      userId: linkedUser,
      orgName: org.name,
    }).catch((err) => logger.warn('Could not send org verified notification', { error: err.message }));
  }

  const auditAction = {
    [ORG_STATUS.VERIFIED]: AUDIT_EVENTS.ORG_VERIFIED,
    [ORG_STATUS.REJECTED]: AUDIT_EVENTS.ORG_REJECTED,
    [ORG_STATUS.SUSPENDED]: AUDIT_EVENTS.ORG_SUSPENDED,
  }[status];

  await auditRepo.log({
    actorId: adminUser.id,
    actorRole: adminUser.role,
    action: auditAction,
    entityType: 'ORGANIZATION',
    entityId: orgId,
    metadata: { status, notes, rejectionReason },
    ipAddress: req?.ip,
  });

  const updatedOrg = await orgRepo.findById(orgId);
  return updatedOrg;
}

/**
 * Update a user's account status.
 */
async function updateUserStatus(userId, { status, reason }, adminUser, req) {
  const user = await userRepo.findById(userId);
  if (!user) throw new NotFoundError('User not found');

  // Prevent admin from suspending themselves
  if (userId === adminUser.id) {
    throw new BusinessRuleError('You cannot change your own account status');
  }

  await userRepo.updateStatus(userId, status);

  await auditRepo.log({
    actorId: adminUser.id,
    actorRole: adminUser.role,
    action: AUDIT_EVENTS.USER_STATUS_CHANGED,
    entityType: 'USER',
    entityId: userId,
    metadata: { previousStatus: user.status, newStatus: status, reason },
    ipAddress: req?.ip,
  });

  const updatedUser = await userRepo.findById(userId);
  const { password_hash, ...safeUser } = updatedUser;
  return safeUser;
}

/**
 * Get audit logs with filtering and pagination.
 */
async function getAuditLogs(queryParams) {
  const { page, limit, offset } = parsePagination(queryParams);
  const { action, actorId, entityType, from, to } = queryParams;

  const conditions = [];
  const values = [];
  let idx = 1;

  if (action) {
    conditions.push(`action = $${idx++}`);
    values.push(action);
  }
  if (actorId) {
    conditions.push(`actor_id = $${idx++}`);
    values.push(actorId);
  }
  if (entityType) {
    conditions.push(`entity_type = $${idx++}`);
    values.push(entityType);
  }
  if (from) {
    conditions.push(`created_at >= $${idx++}`);
    values.push(from);
  }
  if (to) {
    conditions.push(`created_at <= $${idx++}`);
    values.push(to);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query(
    `SELECT COUNT(*) FROM audit_logs ${where}`,
    values
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const rows = await query(
    `SELECT al.*, u.email as actor_email
     FROM audit_logs al
     LEFT JOIN users u ON u.id = al.actor_id
     ${where}
     ORDER BY al.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...values, limit, offset]
  );

  return {
    logs: rows.rows,
    pagination: buildPagination({ page, limit, total }),
  };
}

/**
 * Get system status overview.
 */
async function getSystemStatus() {
  const [
    userCount,
    orgCount,
    pendingOrgs,
    donorCount,
    requestCount,
    inventoryCount,
  ] = await Promise.all([
    query('SELECT COUNT(*) FROM users'),
    query('SELECT COUNT(*) FROM organizations'),
    query("SELECT COUNT(*) FROM organizations WHERE status = 'PENDING_VERIFICATION'"),
    query('SELECT COUNT(*) FROM donors'),
    query('SELECT COUNT(*) FROM emergency_requests'),
    query('SELECT SUM(units_available) FROM blood_inventory WHERE is_expired = false'),
  ]);

  const bloodByType = await query(`
    SELECT blood_type, SUM(units_available) as total
    FROM blood_inventory
    WHERE is_expired = false AND is_available = true
    GROUP BY blood_type
    ORDER BY blood_type
  `);

  return {
    system: {
      status: 'OPERATIONAL',
      timestamp: new Date().toISOString(),
    },
    counts: {
      users: parseInt(userCount.rows[0].count, 10),
      organizations: parseInt(orgCount.rows[0].count, 10),
      pendingVerification: parseInt(pendingOrgs.rows[0].count, 10),
      donors: parseInt(donorCount.rows[0].count, 10),
      emergencyRequests: parseInt(requestCount.rows[0].count, 10),
      totalBloodUnitsAvailable: parseInt(inventoryCount.rows[0].sum || 0, 10),
    },
    bloodInventoryByType: bloodByType.rows,
  };
}

/**
 * Get organisations with optional status filter.
 */
async function getOrganizations(queryParams) {
  const { page, limit, offset } = parsePagination(queryParams);
  const { status, search } = queryParams;

  const conditions = [];
  const values = [];
  let idx = 1;

  if (status) {
    conditions.push(`o.status = $${idx++}`);
    values.push(status);
  }
  if (search) {
    conditions.push(`(o.name ILIKE $${idx} OR o.email ILIKE $${idx})`);
    values.push(`%${search}%`);
    idx++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query(
    `SELECT COUNT(*) FROM organizations o ${where}`,
    values
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const rows = await query(
    `SELECT o.*, u.email as user_email, u.status as user_status
     FROM organizations o
     JOIN users u ON u.id = o.user_id
     ${where}
     ORDER BY o.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...values, limit, offset]
  );

  return {
    organizations: rows.rows,
    pagination: buildPagination({ page, limit, total }),
  };
}

module.exports = {
  verifyOrganization,
  updateUserStatus,
  getAuditLogs,
  getSystemStatus,
  getOrganizations,
};
