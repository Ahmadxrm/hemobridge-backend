'use strict';

const authService = require('../services/auth.service');
const { sendSuccess } = require('../utils/response');

exports.registerOrganization = async (req, res, next) => {
  try {
    const data = await authService.registerOrganization(req.body, req);
    return sendSuccess(res, 201, 'Organisation registered successfully. Pending verification.', data);
  } catch (err) {
    next(err);
  }
};

exports.registerDonor = async (req, res, next) => {
  try {
    const data = await authService.registerDonor(req.body, req);
    return sendSuccess(res, 201, 'Donor registered successfully. Please verify your email.', data);
  } catch (err) {
    next(err);
  }
};

exports.sendOTP = async (req, res, next) => {
  try {
    const message = await authService.sendOTP(req.body);
    return sendSuccess(res, 200, message);
  } catch (err) {
    next(err);
  }
};

exports.verifyOTP = async (req, res, next) => {
  try {
    await authService.verifyOTP(req.body);
    return sendSuccess(res, 200, 'OTP verified successfully', { verified: true });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const data = await authService.login(req.body, req);
    return sendSuccess(res, 200, 'Login successful', data);
  } catch (err) {
    next(err);
  }
};

exports.logout = async (req, res, next) => {
  try {
    await authService.logout({ userId: req.user.id, jti: req.user.jti });
    return sendSuccess(res, 200, 'Logged out successfully');
  } catch (err) {
    next(err);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    const profile = await authService.getMe(req.user.id);
    return sendSuccess(res, 200, 'Profile fetched successfully', profile);
  } catch (err) {
    next(err);
  }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    await authService.forgotPassword(req.body);
    return sendSuccess(res, 200, 'Password reset instructions sent to your email');
  } catch (err) {
    next(err);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    await authService.resetPassword(req.body);
    return sendSuccess(res, 200, 'Password reset successfully');
  } catch (err) {
    next(err);
  }
};
