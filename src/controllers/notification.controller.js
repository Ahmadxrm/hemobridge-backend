'use strict';

const notificationRepo = require('../repositories/notification.repository');
const notificationService = require('../services/notification.service');
const { sendSuccess, sendPaginated } = require('../utils/response');

exports.getNotifications = async (req, res, next) => {
  try {
    const result = await notificationRepo.findForUser(req.user.id, req.query);
    // findForUser returning a paginated format with { data, meta }
    return sendPaginated(res, 200, 'Notifications fetched successfully', result.data, result.meta);
  } catch (err) {
    next(err);
  }
};

exports.sendNotification = async (req, res, next) => {
  try {
    const data = await notificationService.dispatch(req.body);
    return sendSuccess(res, 201, 'Notification dispatched successfully', data);
  } catch (err) {
    next(err);
  }
};

exports.updatePreferences = async (req, res, next) => {
  try {
    const data = await notificationRepo.upsertPreferences(req.params.id, req.body);
    return sendSuccess(res, 200, 'Notification preferences updated successfully', data);
  } catch (err) {
    next(err);
  }
};
