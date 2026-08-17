'use strict';

const donationRepo = require('../repositories/donation.repository');
const orgRepo = require('../repositories/organization.repository');
const donorRepo = require('../repositories/donor.repository');
const auditRepo = require('../repositories/audit.repository');
const notificationService = require('../integrations/notifications/notification.service');
const { AuthorizationError, BusinessRuleError, NotFoundError } = require('../utils/errors');
const { AUDIT_EVENTS, DONATION_REQUEST_STATUS } = require('../utils/constants');

async function createDonationRequest(data, actorUser) {
    const org = await orgRepo.findById(actorUser.organizationId);
    if (org.status !== 'VERIFIED') throw new AuthorizationError('Organization not verified');

    const request = await donationRepo.create({ ...data, organizationId: org.id });
    
    await auditRepo.logEvent(AUDIT_EVENTS.DONATION_REQUEST_CREATED, {
        actorId: actorUser.id,
        targetId: request.id,
        details: { bloodType: data.bloodType, unitsNeeded: data.unitsNeeded }
    });

    return request;
}

async function getDonationRequest(id, actorUser) {
    const request = await donationRepo.findById(id);
    if (!request) throw new NotFoundError('Donation request not found');

    if (actorUser.role !== 'ADMIN' && request.organizationId !== actorUser.organizationId) {
        throw new AuthorizationError('Not authorized');
    }
    return request;
}

async function findMatches(id, actorUser) {
    const request = await donationRepo.findById(id);
    if (!request) throw new NotFoundError('Donation request not found');
    if (request.organizationId !== actorUser.organizationId) throw new AuthorizationError('Not authorized');

    const matches = await donationRepo.findMatches(id);
    return matches.map(m => ({
        donorId: m.donorId,
        bloodType: m.bloodType,
        distanceKm: m.distanceKm,
        isAvailable: m.isAvailable
    }));
}

async function notifyMatchedDonors(id, actorUser) {
    const request = await donationRepo.findById(id);
    if (!request) throw new NotFoundError('Donation request not found');

    const matches = await donationRepo.findMatches(id);
    let notified = 0;

    for (const match of matches) {
        if (!match.notified) {
            await notificationService.notifyDonorOfRequest(match.donorId, id);
            await donationRepo.logNotification(id, match.donorId);
            notified++;
        }
    }
    return { notified };
}

async function submitDonorResponse(donationRequestId, data, actorUser) {
    const donor = await donorRepo.findById(actorUser.id);
    if (!donor) throw new NotFoundError('Donor profile not found');

    const request = await donationRepo.findById(donationRequestId);
    if (!request) throw new NotFoundError('Donation request not found');
    if (request.status !== DONATION_REQUEST_STATUS.OPEN) throw new BusinessRuleError('Request is not open');
    
    if (donor.bloodType !== request.bloodType && request.bloodType !== 'ANY') {
        throw new BusinessRuleError('Blood type mismatch');
    }

    const existingResponse = await donationRepo.findResponse(donationRequestId, donor.id);
    if (existingResponse) throw new BusinessRuleError('Already responded');

    const response = await donationRepo.createResponse(donationRequestId, donor.id, data);

    if (data.status === 'ACCEPTED') {
        const unitsCommitted = (request.unitsCommitted || 0) + 1;
        await donationRepo.updateCommitted(donationRequestId, unitsCommitted);
        if (unitsCommitted >= request.unitsNeeded) {
            await donationRepo.updateStatus(donationRequestId, DONATION_REQUEST_STATUS.CLOSED);
        }
    }

    await auditRepo.logEvent(AUDIT_EVENTS.DONOR_RESPONDED, {
        actorId: actorUser.id,
        targetId: donationRequestId,
        details: { status: data.status }
    });

    return response;
}

async function getProgress(id, actorUser) {
    const request = await donationRepo.findById(id);
    if (!request) throw new NotFoundError('Donation request not found');
    if (actorUser.role !== 'ADMIN' && request.organizationId !== actorUser.organizationId) {
        throw new AuthorizationError('Not authorized');
    }

    return await donationRepo.getProgress(id);
}

async function closeDonationRequest(id, actorUser) {
    const request = await donationRepo.findById(id);
    if (!request) throw new NotFoundError('Donation request not found');
    if (request.organizationId !== actorUser.organizationId) throw new AuthorizationError('Not authorized');

    const updated = await donationRepo.updateStatus(id, DONATION_REQUEST_STATUS.CLOSED);
    
    await auditRepo.logEvent(AUDIT_EVENTS.DONATION_REQUEST_CLOSED, {
        actorId: actorUser.id,
        targetId: id
    });

    return updated;
}

module.exports = {
    createDonationRequest,
    getDonationRequest,
    findMatches,
    notifyMatchedDonors,
    submitDonorResponse,
    getProgress,
    closeDonationRequest
};
