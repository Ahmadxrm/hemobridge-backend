'use strict';

const donorService = require('../services/donor.service');
const { sendSuccess, sendPaginated } = require('../utils/response');

exports.getProfile = async (req, res, next) => {
  try {
    const data = await donorService.getDonorProfile(req.params.id, req.user);
    return sendSuccess(res, 200, 'Profile fetched successfully', data);
  } catch (err) {
    next(err);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const data = await donorService.updateDonorProfile(req.params.id, req.body, req.user);
    return sendSuccess(res, 200, 'Profile updated successfully', data);
  } catch (err) {
    next(err);
  }
};

exports.updateAvailability = async (req, res, next) => {
  try {
    const data = await donorService.updateAvailability(req.params.id, req.body, req.user);
    return sendSuccess(res, 200, 'Availability updated successfully', data);
  } catch (err) {
    next(err);
  }
};

exports.getHistory = async (req, res, next) => {
  try {
    const result = await donorService.getDonorHistory(req.params.id, req.query, req.user);
    return sendPaginated(res, 200, 'History fetched successfully', result.data, result.meta);
  } catch (err) {
    next(err);
  }
};
