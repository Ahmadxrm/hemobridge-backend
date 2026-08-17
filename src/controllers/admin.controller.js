'use strict';

const adminService = require('../services/admin.service');
const { sendSuccess, sendPaginated } = require('../utils/response');

exports.verifyOrganization = async (req, res, next) => {
  try {
    const data = await adminService.verifyOrganization(req.params.id, req.body, req.user, req);
    return sendSuccess(res, 200, 'Organization verification updated successfully', data);
  } catch (err) {
    next(err);
  }
};

exports.updateUserStatus = async (req, res, next) => {
  try {
    const data = await adminService.updateUserStatus(req.params.id, req.body, req.user, req);
    return sendSuccess(res, 200, 'User status updated successfully', data);
  } catch (err) {
    next(err);
  }
};

exports.getAuditLogs = async (req, res, next) => {
  try {
    const result = await adminService.getAuditLogs(req.query);
    return sendPaginated(res, 200, 'Audit logs fetched successfully', result.data, result.meta);
  } catch (err) {
    next(err);
  }
};

exports.getSystemStatus = async (req, res, next) => {
  try {
    const data = await adminService.getSystemStatus();
    return sendSuccess(res, 200, 'System status fetched successfully', data);
  } catch (err) {
    next(err);
  }
};

exports.getOrganizations = async (req, res, next) => {
  try {
    const result = await adminService.getOrganizations(req.query);
    return sendPaginated(res, 200, 'Organizations fetched successfully', result.data, result.meta);
  } catch (err) {
    next(err);
  }
};
