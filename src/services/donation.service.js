'use strict';

const donationRepo = require('../repositories/donation.repository');
const orgRepo = require('../repositories/organization.repository');
const donorRepo = require('../repositories/donor.repository');
const auditRepo = require('../repositories/audit.repository');
const notificationService = require('../integrations/notifications/notification.service');
const { AuthorizationError, BusinessRuleError, NotFoundError } = require('../utils/errors');
const { AUDIT_EVENTS, DONATION_REQUEST_STATUS } = require('../utils/constants');
const { parsePagination, buildPagination, sanitizeDonor } = require('../utils/helpers');
const logger = require('../utils/logger');

async function createDonationRequest(data, actorUser) {
  const org = await orgRepo.findByUserId(actorUser.id);
  if (!org) throw new NotFoundError('Organization not found');
  if (org.status !== 'VERIFIED') {
    throw new AuthorizationError('Your organization must be verified to create donation requests');
  }

  const request = await donationRepo.create({
    organizationId: org.id,
    bloodType: data.bloodType,
    unitsNeeded: data.unitsNeeded,
    urgency: data.urgency || 'URGENT',
    message: data.message,
    searchRadiusKm: data.searchRadiusKm || 25,
    latitude: data.latitude,
    longitude: data.longitude,
    expiresAt: data.expiresAt,
  });

  await auditRepo.log({
    actorId: actorUser.id,
    actorRole: actorUser.role,
    action: AUDIT_EVENTS.DONATION_REQUEST_CREATED,
    entityType: 'DONATION_REQUEST',
    entityId: request.id,
    metadata: { bloodType: data.bloodType, unitsNeeded: data.unitsNeeded },
  });

  return request;
}

async function getDonationRequest(id, actorUser) {
  const request = await donationRepo.findById(id);
  if (!request) throw new NotFoundError('Donation request not found');

  const canView =
    actorUser.role === 'ADMIN' ||
    request.organization_id === actorUser.organizationId ||
    actorUser.role === 'DONOR'; // donors can see requests they've been notified about

  if (!canView) throw new AuthorizationError('Not authorized to view this donation request');

  return request;
}

async function findMatches(id, actorUser) {
  const request = await donationRepo.findById(id);
  if (!request) throw new NotFoundError('Donation request not found');

  if (actorUser.role !== 'ADMIN' && request.organization_id !== actorUser.organizationId) {
    throw new AuthorizationError('Not authorized');
  }

  const matches = await donationRepo.findMatches(id);

  // Sanitize donor data — only expose safe fields
  return matches.map((m) => ({
    donorId: m.id,
    bloodType: m.blood_type,
    distanceKm: m.distance_meters ? Math.round(m.distance_meters / 100) / 10 : null,
    isAvailable: m.is_available,
  }));
}

async function notifyMatchedDonors(id, actorUser) {
  const request = await donationRepo.findById(id);
  if (!request) throw new NotFoundError('Donation request not found');

  if (actorUser.role !== 'ADMIN' && request.organization_id !== actorUser.organizationId) {
    throw new AuthorizationError('Not authorized');
  }

  // Find already-notified donors (those with existing responses)
  const alreadyNotified = await donationRepo.getNotifiedDonors(id);
  const alreadyNotifiedSet = new Set(alreadyNotified);

  const matches = await donationRepo.findMatches(id);
  let notified = 0;

  for (const match of matches) {
    if (!alreadyNotifiedSet.has(match.id)) {
      // Create a PENDING response record to track notification
      await donationRepo.createResponse({
        donationRequestId: id,
        donorId: match.id,
        status: 'PENDING',
        message: null,
        declineReason: null,
        availableDate: null,
        availableTime: null,
      });

      // Send notification
      notificationService.notifyDonorOfDonationRequest({
        donorId: match.id,
        donationRequestId: id,
        bloodType: request.blood_type,
        urgency: request.urgency,
        message: request.message,
      }).catch((err) => logger.warn('Donor notification failed', { donorId: match.id, error: err.message }));

      notified++;
    }
  }

  return { notified, total: matches.length };
}

async function submitDonorResponse(donationRequestId, data, actorUser) {
  // Donor must look up their own donor profile by user_id
  const donor = await donorRepo.findByUserId(actorUser.id);
  if (!donor) throw new NotFoundError('Donor profile not found');

  const request = await donationRepo.findById(donationRequestId);
  if (!request) throw new NotFoundError('Donation request not found');

  if (request.status !== DONATION_REQUEST_STATUS.OPEN) {
    throw new BusinessRuleError('This donation request is no longer accepting responses');
  }

  // Check existing response
  const existingResponse = await donationRepo.getResponse(donationRequestId, donor.id);

  if (existingResponse && existingResponse.status !== 'PENDING') {
    throw new BusinessRuleError('You have already responded to this donation request');
  }

  let response;
  if (existingResponse) {
    // Update the existing PENDING record
    response = await donationRepo.updateResponse(existingResponse.id, {
      status: data.status,
      message: data.message,
      decline_reason: data.declineReason,
      available_date: data.availableDate,
      available_time: data.availableTime,
    });
  } else {
    response = await donationRepo.createResponse({
      donationRequestId,
      donorId: donor.id,
      status: data.status,
      message: data.message,
      declineReason: data.declineReason,
      availableDate: data.availableDate,
      availableTime: data.availableTime,
    });
  }

  // If accepted, check if we've hit target
  if (data.status === 'ACCEPTED') {
    const progress = await donationRepo.getProgress(donationRequestId);
    const acceptedCount = progress.find((p) => p.status === 'ACCEPTED');
    if (acceptedCount && parseInt(acceptedCount.count) >= request.units_needed) {
      await donationRepo.close(donationRequestId, actorUser.id);
    }
  }

  await auditRepo.log({
    actorId: actorUser.id,
    actorRole: actorUser.role,
    action: AUDIT_EVENTS.DONOR_RESPONDED,
    entityType: 'DONATION_REQUEST',
    entityId: donationRequestId,
    metadata: { status: data.status },
  });

  return response;
}

async function getProgress(id, actorUser) {
  const request = await donationRepo.findById(id);
  if (!request) throw new NotFoundError('Donation request not found');

  if (actorUser.role !== 'ADMIN' && request.organization_id !== actorUser.organizationId) {
    throw new AuthorizationError('Not authorized');
  }

  const progress = await donationRepo.getProgress(id);

  return {
    requestId: id,
    unitsNeeded: request.units_needed,
    status: request.status,
    responses: progress,
  };
}

async function closeDonationRequest(id, actorUser) {
  const request = await donationRepo.findById(id);
  if (!request) throw new NotFoundError('Donation request not found');

  if (actorUser.role !== 'ADMIN' && request.organization_id !== actorUser.organizationId) {
    throw new AuthorizationError('Not authorized to close this request');
  }

  if (request.status === DONATION_REQUEST_STATUS.CLOSED) {
    throw new BusinessRuleError('This donation request is already closed');
  }

  const updated = await donationRepo.close(id, actorUser.id);

  await auditRepo.log({
    actorId: actorUser.id,
    actorRole: actorUser.role,
    action: AUDIT_EVENTS.DONATION_REQUEST_CLOSED,
    entityType: 'DONATION_REQUEST',
    entityId: id,
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
  closeDonationRequest,
};
