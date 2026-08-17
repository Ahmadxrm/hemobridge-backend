'use strict';

const requestService = require('../services/request.service');
const { sendSuccess, sendPaginated } = require('../utils/response');

exports.createRequest = async (req, res, next) => {
  try {
    const data = await requestService.createRequest(req.body, req.user);
    return sendSuccess(res, 201, 'Request created successfully', data);
  } catch (err) {
    next(err);
  }
};

exports.getRequests = async (req, res, next) => {
  try {
    const result = await requestService.getRequests(req.query, req.user);
    return sendPaginated(res, 200, 'Requests fetched successfully', result.data, result.pagination);
  } catch (err) {
    next(err);
  }
};

exports.getRequest = async (req, res, next) => {
  try {
    const data = await requestService.getRequest(req.params.id, req.user);
    return sendSuccess(res, 200, 'Request fetched successfully', data);
  } catch (err) {
    next(err);
  }
};

exports.respondToRequest = async (req, res, next) => {
  try {
    const data = await requestService.respondToRequest(req.params.id, req.body, req.user);
    return sendSuccess(res, 200, 'Responded to request successfully', data);
  } catch (err) {
    next(err);
  }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const data = await requestService.updateRequestStatus(req.params.id, req.body, req.user);
    return sendSuccess(res, 200, 'Request status updated successfully', data);
  } catch (err) {
    next(err);
  }
};

exports.addTransferDetails = async (req, res, next) => {
  try {
    const data = await requestService.addTransferDetails(req.params.id, req.body, req.user);
    return sendSuccess(res, 201, 'Transfer details added successfully', data);
  } catch (err) {
    next(err);
  }
};

exports.confirmReceived = async (req, res, next) => {
  try {
    const data = await requestService.confirmReceived(req.params.id, req.user);
    return sendSuccess(res, 200, 'Receipt confirmed successfully', data);
  } catch (err) {
    next(err);
  }
};
