'use strict';

const donorRepo = require('../repositories/donor.repository');
const auditRepo = require('../repositories/audit.repository');
const { AuthorizationError, NotFoundError } = require('../utils/errors');
const { sanitizeDonor, parsePagination, buildPagination } = require('../utils/helpers');

async function getDonorProfile(donorUserId, requestingUser) {
  // donorUserId here is the donor's user_id (from URL params like /donors/:id)
  // We look up the donor profile by user_id
  const donor = await donorRepo.findByUserId(donorUserId);
  if (!donor) throw new NotFoundError('Donor profile not found');

  // Donor themselves or admin can see full profile
  if (requestingUser.id === donorUserId || requestingUser.role === 'ADMIN') {
    return donor;
  }

  // Organisations can see a sanitized version (no private details)
  if (['HOSPITAL', 'BLOOD_BANK'].includes(requestingUser.role)) {
    return sanitizeDonor(donor);
  }

  throw new AuthorizationError('Not authorized to view this donor profile');
}

async function updateDonorProfile(donorUserId, data, actorUser) {
  if (actorUser.id !== donorUserId && actorUser.role !== 'ADMIN') {
    throw new AuthorizationError('Not authorized to update this profile');
  }

  const donor = await donorRepo.findByUserId(donorUserId);
  if (!donor) throw new NotFoundError('Donor profile not found');

  const updated = await donorRepo.update(donor.id, data);
  return updated;
}

async function updateAvailability(donorUserId, { isAvailable }, actorUser) {
  if (actorUser.id !== donorUserId && actorUser.role !== 'ADMIN') {
    throw new AuthorizationError('Not authorized to update this donor\'s availability');
  }

  const donor = await donorRepo.findByUserId(donorUserId);
  if (!donor) throw new NotFoundError('Donor profile not found');

  const updated = await donorRepo.updateAvailability(donor.id, isAvailable);
  return { id: donor.id, isAvailable: updated.is_available };
}

async function getDonorHistory(donorUserId, reqQuery, actorUser) {
  if (actorUser.id !== donorUserId && actorUser.role !== 'ADMIN') {
    throw new AuthorizationError('Not authorized to view this donor\'s history');
  }

  const donor = await donorRepo.findByUserId(donorUserId);
  if (!donor) throw new NotFoundError('Donor profile not found');

  const { limit, offset, page } = parsePagination(reqQuery);
  const result = await donorRepo.getDonationHistory(donor.id, { page, limit });

  return buildPagination(result.data, result.total, page, limit);
}

module.exports = {
  getDonorProfile,
  updateDonorProfile,
  updateAvailability,
  getDonorHistory,
};
