'use strict';

const requestRepo = require('../repositories/request.repository');
const orgRepo = require('../repositories/organization.repository');
const auditRepo = require('../repositories/audit.repository');
const notificationService = require('../integrations/notifications/notification.service');
const { AuthorizationError, BusinessRuleError, NotFoundError } = require('../utils/errors');
const { AUDIT_EVENTS, REQUEST_STATUS, REQUEST_TRANSITIONS } = require('../utils/constants');
const { parsePagination, buildPagination } = require('../utils/helpers');
const logger = require('../utils/logger');

async function createRequest(data, actorUser) {
  // Get the org for this user
  const org = await orgRepo.findByUserId(actorUser.id);
  if (!org) throw new AuthorizationError('No organization found for this user');
  if (org.status !== 'VERIFIED') {
    throw new AuthorizationError('Your organization must be verified before creating emergency requests');
  }

  const request = await requestRepo.create({
    requestingOrgId: org.id,
    bloodType: data.bloodType,
    unitsNeeded: data.unitsNeeded,
    urgency: data.urgency || 'URGENT',
    patientInfo: data.patientInfo,
    notes: data.notes,
    fulfillingOrgId: data.fulfillingOrgId || null,
  });

  await auditRepo.log({
    actorId: actorUser.id,
    actorRole: actorUser.role,
    action: AUDIT_EVENTS.REQUEST_CREATED,
    entityType: 'EMERGENCY_REQUEST',
    entityId: request.id,
    metadata: { bloodType: data.bloodType, unitsNeeded: data.unitsNeeded, urgency: data.urgency },
  });

  // Notify fulfilling org if specified
  if (data.fulfillingOrgId) {
    notificationService.notifyOrganizationOfRequest({
      orgId: data.fulfillingOrgId,
      requestId: request.id,
      bloodType: data.bloodType,
      urgency: data.urgency,
    }).catch((err) => logger.warn('Request notification failed', { error: err.message }));
  }

  return request;
}

async function getRequests(reqQuery, actorUser) {
  const { limit, offset, page } = parsePagination(reqQuery);
  const { status, bloodType } = reqQuery;

  // Org users can only see requests involving their org
  const orgId = actorUser.role !== 'ADMIN' ? actorUser.organizationId : null;

  const result = await requestRepo.findAll({
    orgId,
    role: actorUser.role,
    status,
    bloodType,
    page,
    limit,
  });

  return buildPagination(result.data, result.total, page, limit);
}

async function getRequest(requestId, actorUser) {
  const request = await requestRepo.findById(requestId);
  if (!request) throw new NotFoundError('Blood request not found');

  const canView =
    actorUser.role === 'ADMIN' ||
    request.requesting_org_id === actorUser.organizationId ||
    request.fulfilling_org_id === actorUser.organizationId;

  if (!canView) throw new AuthorizationError('Not authorized to view this request');

  return request;
}

async function respondToRequest(requestId, data, actorUser) {
  const request = await requestRepo.findById(requestId);
  if (!request) throw new NotFoundError('Blood request not found');

  // Only the fulfilling org (or admin) can respond
  if (actorUser.role !== 'ADMIN' && request.fulfilling_org_id !== actorUser.organizationId) {
    throw new AuthorizationError('Not authorized to respond to this request');
  }

  if (request.status !== REQUEST_STATUS.PENDING) {
    throw new BusinessRuleError(`Cannot respond to a request with status: ${request.status}`);
  }

  const newStatus = data.status; // APPROVED or REJECTED
  const allowed = REQUEST_TRANSITIONS[request.status] || [];
  if (!allowed.includes(newStatus)) {
    throw new BusinessRuleError(`Invalid status transition from ${request.status} to ${newStatus}`);
  }

  const updated = await requestRepo.updateStatus(requestId, newStatus, {
    respondedBy: actorUser.id,
    responseNotes: data.responseNotes,
    rejectionReason: data.rejectionReason,
  });

  await auditRepo.log({
    actorId: actorUser.id,
    actorRole: actorUser.role,
    action: AUDIT_EVENTS.REQUEST_STATUS_CHANGED,
    entityType: 'EMERGENCY_REQUEST',
    entityId: requestId,
    metadata: { previousStatus: request.status, newStatus, notes: data.responseNotes },
  });

  // Notify the requesting org
  notificationService.notifyRequestStatusChanged({
    orgId: request.requesting_org_id,
    requestId,
    newStatus,
  }).catch((err) => logger.warn('Request status notification failed', { error: err.message }));

  return updated;
}

async function updateRequestStatus(requestId, data, actorUser) {
  const request = await requestRepo.findById(requestId);
  if (!request) throw new NotFoundError('Blood request not found');

  const canUpdate =
    actorUser.role === 'ADMIN' ||
    request.requesting_org_id === actorUser.organizationId ||
    request.fulfilling_org_id === actorUser.organizationId;

  if (!canUpdate) throw new AuthorizationError('Not authorized to update this request');

  const newStatus = data.status;
  const allowed = REQUEST_TRANSITIONS[request.status] || [];
  if (!allowed.includes(newStatus)) {
    throw new BusinessRuleError(`Invalid status transition from ${request.status} to ${newStatus}`);
  }

  const updated = await requestRepo.updateStatus(requestId, newStatus, {});

  await auditRepo.log({
    actorId: actorUser.id,
    actorRole: actorUser.role,
    action: AUDIT_EVENTS.REQUEST_STATUS_CHANGED,
    entityType: 'EMERGENCY_REQUEST',
    entityId: requestId,
    metadata: { previousStatus: request.status, newStatus, notes: data.notes },
  });

  return updated;
}

async function addTransferDetails(requestId, data, actorUser) {
  const request = await requestRepo.findById(requestId);
  if (!request) throw new NotFoundError('Blood request not found');

  if (request.status !== REQUEST_STATUS.APPROVED) {
    throw new BusinessRuleError('Can only add transfer details to an approved request');
  }

  const canAdd =
    actorUser.role === 'ADMIN' ||
    request.fulfilling_org_id === actorUser.organizationId;

  if (!canAdd) throw new AuthorizationError('Not authorized to add transfer details');

  const transfer = await requestRepo.addTransferDetails(requestId, {
    courierName: data.courierName,
    courierPhone: data.courierPhone,
    vehicleNumber: data.vehicleNumber,
    trackingReference: data.trackingReference,
    dispatchedBy: actorUser.id,
    estimatedArrival: data.estimatedArrival,
    notes: data.notes,
  });

  // Move request to IN_TRANSIT
  await requestRepo.updateStatus(requestId, REQUEST_STATUS.IN_TRANSIT, {});

  return transfer;
}

async function confirmReceived(requestId, actorUser) {
  const request = await requestRepo.findById(requestId);
  if (!request) throw new NotFoundError('Blood request not found');

  if (request.status !== REQUEST_STATUS.IN_TRANSIT) {
    throw new BusinessRuleError('Can only confirm receipt for an in-transit request');
  }

  if (actorUser.role !== 'ADMIN' && request.requesting_org_id !== actorUser.organizationId) {
    throw new AuthorizationError('Only the requesting organization can confirm receipt');
  }

  const updated = await requestRepo.confirmReceived(requestId, actorUser.id, null);

  await auditRepo.log({
    actorId: actorUser.id,
    actorRole: actorUser.role,
    action: AUDIT_EVENTS.REQUEST_STATUS_CHANGED,
    entityType: 'EMERGENCY_REQUEST',
    entityId: requestId,
    metadata: { newStatus: 'COMPLETED' },
  });

  return updated;
}

module.exports = {
  createRequest,
  getRequests,
  getRequest,
  respondToRequest,
  updateRequestStatus,
  addTransferDetails,
  confirmReceived,
};
