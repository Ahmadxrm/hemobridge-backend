'use strict';

const donationService = require('../services/donation.service');
const { sendSuccess } = require('../utils/response');

exports.createDonationRequest = async (req, res, next) => {
  try {
    const data = await donationService.createDonationRequest(req.body, req.user);
    return sendSuccess(res, 201, 'Donation request created successfully', data);
  } catch (err) {
    next(err);
  }
};

exports.getDonationRequest = async (req, res, next) => {
  try {
    const data = await donationService.getDonationRequest(req.params.id, req.user);
    return sendSuccess(res, 200, 'Donation request fetched successfully', data);
  } catch (err) {
    next(err);
  }
};

exports.getMatches = async (req, res, next) => {
  try {
    const matches = await donationService.findMatches(req.params.id, req.user);
    return sendSuccess(res, 200, 'Matches fetched successfully', { matches });
  } catch (err) {
    next(err);
  }
};

exports.notifyDonors = async (req, res, next) => {
  try {
    const data = await donationService.notifyMatchedDonors(req.params.id, req.user);
    return sendSuccess(res, 200, 'Donors notified successfully', data);
  } catch (err) {
    next(err);
  }
};

exports.submitResponse = async (req, res, next) => {
  try {
    const data = await donationService.submitDonorResponse(req.params.id, req.body, req.user);
    return sendSuccess(res, 201, 'Response submitted successfully', data);
  } catch (err) {
    next(err);
  }
};

exports.getProgress = async (req, res, next) => {
  try {
    const data = await donationService.getProgress(req.params.id, req.user);
    return sendSuccess(res, 200, 'Progress fetched successfully', data);
  } catch (err) {
    next(err);
  }
};

exports.close = async (req, res, next) => {
  try {
    const data = await donationService.closeDonationRequest(req.params.id, req.user);
    return sendSuccess(res, 200, 'Donation request closed successfully', data);
  } catch (err) {
    next(err);
  }
};
