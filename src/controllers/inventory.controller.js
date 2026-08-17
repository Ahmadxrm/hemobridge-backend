'use strict';

const inventoryService = require('../services/inventory.service');
const orgRepository = require('../repositories/organization.repository');
const { NotFoundError } = require('../utils/errors');
const { sendSuccess, sendPaginated } = require('../utils/response');

/**
 * Helper: get the organisation ID for the authenticated user.
 * Throws NotFoundError if the user has no linked organisation.
 */
const getOrgId = async (userId) => {
  const org = await orgRepository.findByUserId(userId);
  if (!org) {
    throw new NotFoundError('Organisation not found for this user');
  }
  return org.id;
};

exports.createUnit = async (req, res, next) => {
  try {
    const orgId = await getOrgId(req.user.id);
    const data = await inventoryService.createInventoryUnit(orgId, req.body, req.user);
    return sendSuccess(res, { statusCode: 201, message: 'Inventory unit created successfully', data });
  } catch (err) {
    next(err);
  }
};

exports.getUnits = async (req, res, next) => {
  try {
    const orgId = await getOrgId(req.user.id);
    const result = await inventoryService.getInventoryUnits(orgId, req.query);
    return sendPaginated(res, {
      message: 'Inventory units fetched successfully',
      data: result.data || result,
      pagination: result.pagination || {},
    });
  } catch (err) {
    next(err);
  }
};

exports.updateUnit = async (req, res, next) => {
  try {
    const orgId = await getOrgId(req.user.id);
    const data = await inventoryService.updateInventoryUnit(req.params.id, orgId, req.body, req.user);
    return sendSuccess(res, { statusCode: 200, message: 'Inventory unit updated successfully', data });
  } catch (err) {
    next(err);
  }
};

exports.deleteUnit = async (req, res, next) => {
  try {
    const orgId = await getOrgId(req.user.id);
    const data = await inventoryService.deleteInventoryUnit(req.params.id, orgId, req.user);
    return sendSuccess(res, { statusCode: 200, message: 'Inventory unit deleted successfully', data });
  } catch (err) {
    next(err);
  }
};

exports.getDashboard = async (req, res, next) => {
  try {
    const orgId = await getOrgId(req.user.id);
    const data = await inventoryService.getDashboard(orgId);
    return sendSuccess(res, { statusCode: 200, message: 'Dashboard fetched successfully', data });
  } catch (err) {
    next(err);
  }
};
