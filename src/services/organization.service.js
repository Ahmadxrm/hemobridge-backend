'use strict';

const orgRepo = require('../repositories/organization.repository');
const auditRepo = require('../repositories/audit.repository');
const { AUDIT_EVENTS } = require('../utils/constants');
const { NotFoundError, ValidationError } = require('../utils/errors');
const notificationService = require('../integrations/notifications/notification.service');

const getOrganization = async (orgId, requestingUser) => {
  const org = await orgRepo.findById(orgId);
  if (!org) {
    throw new NotFoundError('Organization not found');
  }

  // Potential data sanitization based on role could go here
  return org;
};

const updateOrganizationStatus = async (orgId, data, adminUser, req) => {
  const { status, notes, rejectionReason, suspendedReason } = data;
  
  const validStatuses = ['VERIFIED', 'REJECTED', 'SUSPENDED'];
  if (!validStatuses.includes(status)) {
    throw new ValidationError(`Status must be one of: ${validStatuses.join(', ')}`);
  }

  const org = await orgRepo.findById(orgId);
  if (!org) {
    throw new NotFoundError('Organization not found');
  }

  const updatedOrg = await orgRepo.updateStatus(orgId, {
    status,
    notes,
    rejectionReason,
    suspendedReason
  });

  if (status === 'VERIFIED') {
    await notificationService.notifyOrganizationVerified({
      userId: org.user_id,
      organizationName: org.name
    });
  }

  await auditRepo.logEvent({
    user_id: adminUser.id,
    event_type: AUDIT_EVENTS.ORG_STATUS_UPDATED,
    details: { 
      org_id: orgId, 
      previous_status: org.operating_status,
      new_status: status,
      notes 
    },
    ip_address: req ? req.ip : null,
    user_agent: req ? req.get('User-Agent') : null,
  });

  return updatedOrg;
};

const getAdminOrganizations = async ({ status, page, limit }) => {
  const result = await orgRepo.findAll({ status, page, limit });
  return result;
};

module.exports = {
  getOrganization,
  updateOrganizationStatus,
  getAdminOrganizations
};
