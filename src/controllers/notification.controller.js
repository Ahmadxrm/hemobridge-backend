'use strict';

const notificationRepo = require('../repositories/notification.repository');
const notificationService = require('../integrations/notifications/notification.service');
const { sendSuccess, sendPaginated } = require('../utils/response');

exports.getNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await notificationRepo.findForUser(req.user.id, { page: parseInt(page), limit: parseInt(limit) });
    return sendPaginated(res, 200, 'Notifications fetched successfully', result.data, {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    });
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
    const userId = req.params.id;
    // Only the user themselves or admin can update preferences
    if (req.user.id !== userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ status: 'error', code: 403, error: { type: 'FORBIDDEN', message: 'Not authorized' } });
    }
    const data = await notificationRepo.upsertPreferences(userId, req.body);
    return sendSuccess(res, 200, 'Notification preferences updated successfully', data);
  } catch (err) {
    next(err);
  }
};

exports.getPreferences = async (req, res, next) => {
  try {
    const userId = req.params.id;
    if (req.user.id !== userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ status: 'error', code: 403, error: { type: 'FORBIDDEN', message: 'Not authorized' } });
    }
    const data = await notificationRepo.getPreferences(userId);
    return sendSuccess(res, 200, 'Preferences fetched successfully', data || {});
  } catch (err) {
    next(err);
  }
};
