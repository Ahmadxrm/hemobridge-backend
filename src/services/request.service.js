'use strict';

const requestRepo = require('../repositories/request.repository');
const orgRepo = require('../repositories/organization.repository');
const auditRepo = require('../repositories/audit.repository');
const notificationService = require('../integrations/notifications/notification.service');
const { AuthorizationError, BusinessRuleError, NotFoundError } = require('../utils/errors');
const { AUDIT_EVENTS, REQUEST_STATUS, REQUEST_TRANSITIONS } = require('../utils/constants');
const { parsePagination, buildPagination } = require('../utils/helpers');

async function createRequest(data, actorUser) {
    const org = await orgRepo.findById(actorUser.organizationId);
    if (org.status !== 'VERIFIED') throw new AuthorizationError('Organization not verified');

    const request = await requestRepo.create({ ...data, requestingOrgId: org.id });
    
    await auditRepo.logEvent(AUDIT_EVENTS.REQUEST_CREATED, {
        actorId: actorUser.id,
        targetId: request.id,
        details: { bloodType: data.bloodType, unitsNeeded: data.unitsNeeded }
    });

    return request;
}

async function getRequests(reqQuery, actorUser) {
    const { limit, offset, page } = parsePagination(reqQuery);
    
    let filter = {};
    if (actorUser.role === 'HOSPITAL' || actorUser.role === 'BLOOD_BANK') {
        filter = { orgId: actorUser.organizationId };
    } else if (actorUser.role !== 'ADMIN') {
        throw new AuthorizationError('Unauthorized access');
    }

    const { data, count } = await requestRepo.find(filter, { limit, offset });
    return buildPagination(data, count, page, limit);
}

async function getRequest(requestId, actorUser) {
    const request = await requestRepo.findById(requestId);
    if (!request) throw new NotFoundError('Request not found');

    const canView = actorUser.role === 'ADMIN' || 
                    request.requestingOrgId === actorUser.organizationId || 
                    request.fulfillingOrgId === actorUser.organizationId;
                    
    if (!canView) throw new AuthorizationError('Not authorized');

    return request;
}

async function respondToRequest(requestId, data, actorUser) {
    const request = await requestRepo.findById(requestId);
    if (!request) throw new NotFoundError('Request not found');
    if (request.status !== REQUEST_STATUS.PENDING) throw new BusinessRuleError('Request not pending');
    
    if (['HOSPITAL', 'BLOOD_BANK'].indexOf(actorUser.role) === -1) throw new AuthorizationError('Not authorized to respond');
    if (request.requestingOrgId === actorUser.organizationId) throw new BusinessRuleError('Cannot respond to own request');
    
    if (data.status !== REQUEST_STATUS.APPROVED && data.status !== REQUEST_STATUS.REJECTED) {
        throw new BusinessRuleError('Invalid response status');
    }

    const updateData = { status: data.status, notes: data.responseNotes };
    if (data.status === REQUEST_STATUS.APPROVED) {
        updateData.fulfillingOrgId = actorUser.organizationId;
    } else {
        updateData.rejectionReason = data.rejectionReason;
    }

    const updated = await requestRepo.updateStatus(requestId, updateData);
    
    await notificationService.notifyRequestStatusChanged(request.requestingOrgId, requestId, data.status);
    
    await auditRepo.logEvent(AUDIT_EVENTS.REQUEST_STATUS_CHANGED, {
        actorId: actorUser.id,
        targetId: requestId,
        details: { status: data.status }
    });

    return updated;
}

async function updateRequestStatus(requestId, data, actorUser) {
    const request = await requestRepo.findById(requestId);
    if (!request) throw new NotFoundError('Request not found');

    const isRequesting = request.requestingOrgId === actorUser.organizationId;
    const isFulfilling = request.fulfillingOrgId === actorUser.organizationId;

    if (!isRequesting && !isFulfilling) throw new AuthorizationError('Not authorized');

    const allowedTransitions = REQUEST_TRANSITIONS[request.status] || [];
    if (!allowedTransitions.includes(data.status)) {
        throw new BusinessRuleError('Invalid status transition');
    }

    if (data.status === REQUEST_STATUS.IN_TRANSIT && !request.transferDetailsId) {
        throw new BusinessRuleError('Transfer details required before in transit');
    }

    const updated = await requestRepo.updateStatus(requestId, { status: data.status, notes: data.notes });
    
    if (data.status === REQUEST_STATUS.COMPLETED) {
        await requestRepo.completeLifecycle(requestId);
    }

    const targetOrgId = isRequesting ? request.fulfillingOrgId : request.requestingOrgId;
    if (targetOrgId) await notificationService.notifyRequestStatusChanged(targetOrgId, requestId, data.status);

    await auditRepo.logEvent(AUDIT_EVENTS.REQUEST_STATUS_CHANGED, { actorId: actorUser.id, targetId: requestId, details: { status: data.status } });

    return updated;
}

async function addTransferDetails(requestId, data, actorUser) {
    const request = await requestRepo.findById(requestId);
    if (!request) throw new NotFoundError('Request not found');
    if (request.status !== REQUEST_STATUS.APPROVED) throw new BusinessRuleError('Request must be approved');
    if (request.fulfillingOrgId !== actorUser.organizationId) throw new AuthorizationError('Not authorized');

    const details = await requestRepo.addTransferDetails(requestId, data);
    await requestRepo.updateStatus(requestId, { status: REQUEST_STATUS.IN_TRANSIT });

    await notificationService.notifyRequestStatusChanged(request.requestingOrgId, requestId, REQUEST_STATUS.IN_TRANSIT);
    await auditRepo.logEvent(AUDIT_EVENTS.REQUEST_STATUS_CHANGED, { actorId: actorUser.id, targetId: requestId, details: { status: REQUEST_STATUS.IN_TRANSIT } });

    return details;
}

async function confirmReceived(requestId, actorUser) {
    const request = await requestRepo.findById(requestId);
    if (!request) throw new NotFoundError('Request not found');
    if (request.status !== REQUEST_STATUS.IN_TRANSIT) throw new BusinessRuleError('Request must be in transit');
    if (request.requestingOrgId !== actorUser.organizationId) throw new AuthorizationError('Not authorized');

    const updated = await requestRepo.confirmReceived(requestId);
    await notificationService.notifyRequestStatusChanged(request.fulfillingOrgId, requestId, REQUEST_STATUS.COMPLETED);
    
    await auditRepo.logEvent(AUDIT_EVENTS.REQUEST_STATUS_CHANGED, { actorId: actorUser.id, targetId: requestId, details: { status: REQUEST_STATUS.COMPLETED } });
    
    return updated;
}

module.exports = {
    createRequest,
    getRequests,
    getRequest,
    respondToRequest,
    updateRequestStatus,
    addTransferDetails,
    confirmReceived
};
