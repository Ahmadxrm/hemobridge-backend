'use strict';

const subscriptionService = require('../services/subscription.service');
const { sendSuccess, sendPaginated } = require('../utils/response');

exports.getPlans = async (req, res, next) => {
  try {
    const data = await subscriptionService.getPlans();
    return sendSuccess(res, 200, 'Subscription plans fetched successfully', data);
  } catch (err) {
    next(err);
  }
};

exports.createSubscription = async (req, res, next) => {
  try {
    const data = await subscriptionService.createSubscription(req.body, req.user, req);
    return sendSuccess(res, 201, 'Subscription created successfully', data);
  } catch (err) {
    next(err);
  }
};

exports.renewSubscription = async (req, res, next) => {
  try {
    const data = await subscriptionService.renewSubscription(req.params.id, req.body, req.user, req);
    return sendSuccess(res, 200, 'Subscription renewed successfully', data);
  } catch (err) {
    next(err);
  }
};

exports.getPayments = async (req, res, next) => {
  try {
    const result = await subscriptionService.getPayments(req.params.id, req.query, req.user);
    return sendPaginated(res, 200, 'Payments fetched successfully', result.data, {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    });
  } catch (err) {
    next(err);
  }
};

exports.webhook = async (req, res, next) => {
  try {
    const signature = req.headers['x-paystack-signature'];
    const rawBody = req.rawBody || JSON.stringify(req.body);
    await subscriptionService.processPaystackWebhook(req.body, rawBody, signature);
    return res.status(200).json({ received: true });
  } catch (err) {
    next(err);
  }
};
