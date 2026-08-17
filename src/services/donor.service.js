'use strict';

const donorRepo = require('../repositories/donor.repository');
const { AuthorizationError, NotFoundError } = require('../utils/errors');
const { sanitizeDonor, parsePagination, buildPagination } = require('../utils/helpers');

async function getDonorProfile(donorId, requestingUser) {
    const donor = await donorRepo.findById(donorId);
    if (!donor) throw new NotFoundError('Donor not found');

    if (requestingUser.id === donorId || requestingUser.role === 'ADMIN') {
        return donor;
    } else if (['HOSPITAL', 'BLOOD_BANK'].includes(requestingUser.role)) {
        return sanitizeDonor(donor);
    }
    throw new AuthorizationError('Not authorized');
}

async function updateDonorProfile(donorId, data, actorUser) {
    if (actorUser.id !== donorId) throw new AuthorizationError('Not authorized');
    const updated = await donorRepo.update(donorId, data);
    return updated;
}

async function updateAvailability(donorId, { isAvailable }, actorUser) {
    if (actorUser.id !== donorId && actorUser.role !== 'ADMIN') throw new AuthorizationError('Not authorized');
    const updated = await donorRepo.updateAvailability(donorId, isAvailable);
    return { isAvailable: updated.isAvailable };
}

async function getDonorHistory(donorId, reqQuery, actorUser) {
    if (actorUser.id !== donorId && actorUser.role !== 'ADMIN') throw new AuthorizationError('Not authorized');
    const { limit, offset, page } = parsePagination(reqQuery);
    const { data, count } = await donorRepo.getDonationHistory(donorId, { limit, offset });
    return buildPagination(data, count, page, limit);
}

module.exports = {
    getDonorProfile,
    updateDonorProfile,
    updateAvailability,
    getDonorHistory
};
