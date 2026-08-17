'use strict';

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authLimiter, otpLimiter, otpSlowDown, passwordResetLimiter } = require('../middleware/rateLimiter');
const {
  registerOrganizationSchema,
  registerDonorSchema,
  sendOtpSchema,
  verifyOtpSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema
} = require('../validators/auth.validators');

router.post('/register/organization', authLimiter, validate(registerOrganizationSchema), authController.registerOrganization);
router.post('/register/donor', authLimiter, validate(registerDonorSchema), authController.registerDonor);
router.post('/otp/send', otpSlowDown, otpLimiter, validate(sendOtpSchema), authController.sendOTP);
router.post('/otp/verify', validate(verifyOtpSchema), authController.verifyOTP);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/logout', authenticate, authController.logout);
router.post('/forgot-password', passwordResetLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);
router.get('/me', authenticate, authController.getMe);

module.exports = router;
