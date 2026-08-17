'use strict';

const userRepo = require('../repositories/user.repository');
const orgRepo = require('../repositories/organization.repository');
const donorRepo = require('../repositories/donor.repository');
const otpRepo = require('../repositories/otp.repository');
const auditRepo = require('../repositories/audit.repository');
const notificationRepo = require('../repositories/notification.repository');
const { query } = require('../config/database');
const {
  hashPassword,
  verifyPassword,
  hashOTP,
  verifyOTP: verifyOTPHash,
  generateSecureToken,
  hashToken,
} = require('../utils/crypto');
const { generateOTP, combineBloodType, sanitizeUser } = require('../utils/helpers');
const {
  ROLES,
  USER_STATUS,
  OTP_PURPOSE,
  AUDIT_EVENTS,
  NOTIFICATION_CHANNELS,
} = require('../utils/constants');
const {
  AuthenticationError,
  ConflictError,
  ValidationError,
  NotFoundError,
  BusinessRuleError,
} = require('../utils/errors');
const config = require('../config');
const notificationService = require('../integrations/notifications/notification.service');
const { generateAccessToken, createSession, invalidateSession } = require('../middleware/auth');
const logger = require('../utils/logger');

// ── Helpers ────────────────────────────────────────────────────────────────

function getOrgStatusField(org) {
  // org status is on the organizations table as 'status'
  return org.status;
}

// ── Registration ───────────────────────────────────────────────────────────

const registerOrganization = async (data, req) => {
  const existingUser = await userRepo.findByEmail(data.email);
  if (existingUser) {
    throw new ConflictError('An account with this email already exists');
  }

  const passwordHash = await hashPassword(data.password);

  const user = await userRepo.create({
    email: data.email,
    phone: data.phone,
    passwordHash,
    role: data.role,
  });

  const organization = await orgRepo.create({
    userId: user.id,
    name: data.name,
    email: data.email,
    phone: data.phone,
    address: data.address,
    city: data.city,
    state: data.state,
    lga: data.lga,
    organizationType: data.role, // HOSPITAL or BLOOD_BANK
    registrationNumber: data.registrationNumber,
    hospitalType: data.hospitalType,
    ownershipType: data.ownershipType,
    representativeName: data.representativeName,
    representativeEmail: data.representativeEmail,
    representativePhone: data.representativePhone,
    operatingStatus: data.operatingStatus,
    licenceDocumentUrl: null,
    latitude: data.latitude,
    longitude: data.longitude,
  });

  await notificationRepo.createDefaultPreferences(user.id);

  await auditRepo.log({
    actorId: user.id,
    actorRole: data.role,
    action: AUDIT_EVENTS.ORG_REGISTERED || 'ORG_REGISTERED',
    entityType: 'ORGANIZATION',
    entityId: organization.id,
    ipAddress: req?.ip,
    userAgent: req?.headers?.['user-agent'],
  });

  return {
    user: sanitizeUser(user),
    organization,
  };
};

const registerDonor = async (data, req) => {
  if (data.consentGiven !== true) {
    throw new BusinessRuleError('You must provide consent to register as a blood donor');
  }

  const existingUser = await userRepo.findByEmail(data.email);
  if (existingUser) {
    throw new ConflictError('An account with this email already exists');
  }

  const bloodType = combineBloodType(data.bloodGroup, data.rhesusFactor);
  const passwordHash = await hashPassword(data.password);

  const user = await userRepo.create({
    email: data.email,
    phone: data.phone,
    passwordHash,
    role: ROLES.DONOR,
  });

  const donor = await donorRepo.create({
    userId: user.id,
    fullName: data.fullName,
    dateOfBirth: data.dateOfBirth,
    gender: data.gender,
    bloodType,
    address: data.address,
    lga: data.lga,
    state: data.state,
    preferredChannel: data.preferredChannel || 'SMS',
    consentGiven: true,
    dataSharingConsent: data.dataSharingConsent || false,
    healthInformation: data.healthInformation,
    latitude: data.latitude,
    longitude: data.longitude,
  });

  await notificationRepo.createDefaultPreferences(user.id);

  // Generate and send email verification OTP
  const otp = generateOTP(6);
  const otpHash = await hashOTP(otp);
  const expiresAt = new Date(Date.now() + (config.otp?.expiresInMinutes || 10) * 60000);

  await otpRepo.create({
    userId: user.id,
    purpose: OTP_PURPOSE.EMAIL_VERIFICATION,
    otpHash,
    contact: user.email,
    expiresAt,
  });

  // Send OTP
  try {
    await notificationService.sendOTPNotification({
      userId: user.id,
      otp,
      purpose: OTP_PURPOSE.EMAIL_VERIFICATION,
      channel: NOTIFICATION_CHANNELS.EMAIL,
    });
  } catch (err) {
    logger.warn('Failed to send verification OTP', { userId: user.id, error: err.message });
  }

  // DEV: log OTP
  if (config.env !== 'production') {
    logger.warn('[DEV ONLY] Email verification OTP', { userId: user.id, otp, email: user.email });
  }

  await auditRepo.log({
    actorId: user.id,
    actorRole: ROLES.DONOR,
    action: AUDIT_EVENTS.USER_REGISTERED || 'USER_REGISTERED',
    entityType: 'USER',
    entityId: user.id,
    ipAddress: req?.ip,
    userAgent: req?.headers?.['user-agent'],
  });

  return {
    user: sanitizeUser(user),
    donor,
  };
};

// ── OTP ────────────────────────────────────────────────────────────────────

const sendOTP = async ({ userId, purpose }) => {
  const user = await userRepo.findById(userId);
  if (!user) throw new NotFoundError('User not found');

  // Cooldown check
  const existing = await otpRepo.findLatest(userId, purpose);
  const cooldownSec = config.otp?.resendCooldownSeconds || 60;

  if (existing && !existing.is_used && new Date(existing.expires_at) > new Date()) {
    const elapsed = Date.now() - new Date(existing.created_at).getTime();
    if (elapsed < cooldownSec * 1000) {
      const waitSec = Math.ceil((cooldownSec * 1000 - elapsed) / 1000);
      throw new BusinessRuleError(`Please wait ${waitSec} seconds before requesting a new OTP`);
    }
  }

  const otp = generateOTP(6);
  const otpHash = await hashOTP(otp);
  const expiresAt = new Date(Date.now() + (config.otp?.expiresInMinutes || 10) * 60000);

  const channel = purpose === OTP_PURPOSE.PHONE_VERIFICATION
    ? NOTIFICATION_CHANNELS.SMS
    : NOTIFICATION_CHANNELS.EMAIL;

  await otpRepo.create({
    userId,
    purpose,
    otpHash,
    contact: channel === NOTIFICATION_CHANNELS.SMS ? user.phone : user.email,
    expiresAt,
  });

  await notificationService.sendOTPNotification({ userId, otp, purpose, channel });

  // DEV: log OTP
  if (config.env !== 'production') {
    logger.warn('[DEV ONLY] OTP sent', { userId, purpose, otp });
  }

  await auditRepo.log({
    actorId: userId,
    actorRole: user.role,
    action: 'OTP_SENT',
    entityType: 'USER',
    entityId: userId,
  });

  return { message: 'OTP sent successfully' };
};

const verifyOTP = async ({ userId, otp, purpose }) => {
  const record = await otpRepo.findLatest(userId, purpose);

  if (!record) throw new ValidationError('No pending OTP found for this purpose');
  if (record.is_used) throw new ValidationError('OTP has already been used');
  if (new Date(record.expires_at) < new Date()) throw new ValidationError('OTP has expired');
  if (record.attempts >= 5) throw new ValidationError('Maximum verification attempts exceeded');

  await otpRepo.incrementAttempts(record.id);

  const isValid = await verifyOTPHash(record.otp_hash, otp);
  if (!isValid) throw new ValidationError('Invalid OTP code');

  await otpRepo.markUsed(record.id);

  if (purpose === OTP_PURPOSE.EMAIL_VERIFICATION) {
    await userRepo.verifyEmail(userId);
  }

  await auditRepo.log({
    actorId: userId,
    action: 'OTP_VERIFIED',
    entityType: 'USER',
    entityId: userId,
  });

  return { message: 'Verified successfully', verified: true };
};

// ── Login / Logout ─────────────────────────────────────────────────────────

const login = async ({ email, password }, req) => {
  const user = await userRepo.findByEmail(email);

  // Timing-safe: don't reveal whether email exists
  if (!user) {
    throw new AuthenticationError('Invalid email or password');
  }

  // Lock check
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    throw new AuthenticationError('Account temporarily locked due to too many failed attempts. Please try again later.');
  }

  // Password verify
  const valid = await verifyPassword(user.password_hash, password);
  if (!valid) {
    await userRepo.incrementFailedLogin(user.id);
    const attempts = (user.failed_login_attempts || 0) + 1;
    if (attempts >= 5) {
      const lockUntil = new Date(Date.now() + 30 * 60000); // 30 min
      await userRepo.lockAccount(user.id, lockUntil);
    }
    throw new AuthenticationError('Invalid email or password');
  }

  // Email verification
  if (!user.email_verified) {
    throw new AuthenticationError('Please verify your email address before logging in');
  }

  // Org status check
  if (user.role === ROLES.HOSPITAL || user.role === ROLES.BLOOD_BANK) {
    const org = await orgRepo.findByUserId(user.id);
    if (!org) {
      throw new AuthenticationError('Organisation account not found');
    }
    if (org.status === 'PENDING_VERIFICATION') {
      throw new AuthenticationError('Your organisation is pending verification by our team. You will be notified once approved.');
    }
    if (org.status === 'REJECTED') {
      throw new AuthenticationError('Your organisation registration has been rejected. Please contact support.');
    }
    if (org.status === 'SUSPENDED') {
      throw new AuthenticationError('Your organisation account has been suspended. Please contact support.');
    }
  }

  await userRepo.resetFailedLogin(user.id);
  await userRepo.updateLastLogin(user.id);

  const { token, jti } = generateAccessToken(user);
  const expiresAt = await createSession(user.id, jti, req);

  await auditRepo.log({
    actorId: user.id,
    actorRole: user.role,
    action: AUDIT_EVENTS.USER_LOGIN || 'USER_LOGIN',
    entityType: 'USER',
    entityId: user.id,
    ipAddress: req?.ip,
    userAgent: req?.headers?.['user-agent'],
  });

  return {
    user: sanitizeUser(user),
    token,
    expiresAt,
  };
};

const logout = async ({ userId, jti }) => {
  await invalidateSession(jti);

  await auditRepo.log({
    actorId: userId,
    action: AUDIT_EVENTS.USER_LOGOUT || 'USER_LOGOUT',
    entityType: 'USER',
    entityId: userId,
  });

  return { message: 'Logged out successfully' };
};

// ── Profile ────────────────────────────────────────────────────────────────

const getMe = async (userId) => {
  const user = await userRepo.findById(userId);
  if (!user) throw new NotFoundError('User not found');

  const profile = { user: sanitizeUser(user) };

  if (user.role === ROLES.HOSPITAL || user.role === ROLES.BLOOD_BANK) {
    profile.organization = await orgRepo.findByUserId(userId);
  } else if (user.role === ROLES.DONOR) {
    profile.donor = await donorRepo.findByUserId(userId);
  }

  return profile;
};

// ── Password Reset ─────────────────────────────────────────────────────────

const forgotPassword = async ({ email }) => {
  const user = await userRepo.findByEmail(email);

  if (user) {
    const token = generateSecureToken(32);
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 60 * 60000); // 60 minutes

    await otpRepo.createResetToken({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    const frontendUrl = config.frontendUrl || 'http://localhost:5173';

    await notificationService.sendPasswordResetEmail({
      userId: user.id,
      resetToken: token,
      frontendUrl,
    }).catch((err) => {
      logger.warn('Failed to send password reset email', { error: err.message });
    });

    await auditRepo.log({
      actorId: user.id,
      action: AUDIT_EVENTS.PASSWORD_RESET || 'PASSWORD_RESET',
      entityType: 'USER',
      entityId: user.id,
      metadata: { action: 'RESET_REQUESTED' },
    });
  }

  // Always return same message (don't reveal if email exists)
  return { message: 'If your email is registered, you will receive a password reset link shortly.' };
};

const resetPassword = async ({ token, password }) => {
  const tokenHash = hashToken(token);
  const record = await otpRepo.findResetToken(tokenHash);

  if (!record || record.is_used || new Date(record.expires_at) < new Date()) {
    throw new ValidationError('This password reset link is invalid or has expired');
  }

  const passwordHash = await hashPassword(password);
  await userRepo.updatePassword(record.user_id, passwordHash);
  await otpRepo.markResetTokenUsed(record.id);

  // Invalidate all sessions for this user
  await query(
    'UPDATE sessions SET is_valid = false, invalidated_at = NOW() WHERE user_id = $1',
    [record.user_id]
  );

  await auditRepo.log({
    actorId: record.user_id,
    action: AUDIT_EVENTS.PASSWORD_RESET || 'PASSWORD_RESET',
    entityType: 'USER',
    entityId: record.user_id,
    metadata: { action: 'RESET_COMPLETED' },
  });

  return { message: 'Password reset successfully. Please log in with your new password.' };
};

module.exports = {
  registerOrganization,
  registerDonor,
  sendOTP,
  verifyOTP,
  login,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
};
