'use strict';

const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const config = require('../config');
const { sendError } = require('../utils/response');

/**
 * General API rate limiter — applied to all routes.
 */
const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    sendError(res, {
      statusCode: 429,
      type: 'RATE_LIMIT_ERROR',
      message: 'Too many requests. Please slow down and try again later.',
    });
  },
});

/**
 * Auth rate limiter — stricter limit for login/register endpoints.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    sendError(res, {
      statusCode: 429,
      type: 'RATE_LIMIT_ERROR',
      message: 'Too many authentication attempts. Please wait 15 minutes before trying again.',
    });
  },
});

/**
 * OTP rate limiter — very strict to prevent OTP abuse.
 */
const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: config.rateLimit.otpMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    sendError(res, {
      statusCode: 429,
      type: 'RATE_LIMIT_ERROR',
      message: 'Too many OTP requests. Please wait before requesting a new code.',
    });
  },
});

/**
 * OTP slow down — progressively delay responses after 2 OTP requests.
 */
const otpSlowDown = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 2,
  delayMs: () => 1000,
  maxDelayMs: 10000,
});

/**
 * Password reset rate limiter.
 */
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    sendError(res, {
      statusCode: 429,
      type: 'RATE_LIMIT_ERROR',
      message: 'Too many password reset requests. Please wait before trying again.',
    });
  },
});

module.exports = {
  generalLimiter,
  authLimiter,
  otpLimiter,
  otpSlowDown,
  passwordResetLimiter,
};
