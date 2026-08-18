'use strict';

const Joi = require('joi');

const registerOrganizationSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  phone: Joi.string().pattern(/^(\+?234|0)[789][01]\d{8}$/).required().messages({
    'string.pattern.base': 'Phone number must be a valid Nigerian format',
  }),
  password: Joi.string().min(8).max(128).required(),
  role: Joi.string().valid('HOSPITAL', 'BLOOD_BANK').required(),
  address: Joi.string().required(),
  state: Joi.string().required(),
  city: Joi.string().optional(),
  lga: Joi.string().optional(),
  registrationNumber: Joi.string().optional(),
  hospitalType: Joi.string().optional(),
  ownershipType: Joi.string().valid('GOVERNMENT', 'PRIVATE', 'FAITH_BASED', 'NGO', 'OTHER').optional(),
  representativeName: Joi.string().optional(),
  representativeEmail: Joi.string().email().optional(),
  representativePhone: Joi.string().optional(),
  operatingStatus: Joi.string().optional(),
  latitude: Joi.number().min(-90).max(90).optional(),
  longitude: Joi.number().min(-180).max(180).optional(),
});

const registerDonorSchema = Joi.object({
  fullName: Joi.string().required(),
  email: Joi.string().email().required(),
  phone: Joi.string().required(),
  password: Joi.string().min(8).max(128).required(),
  bloodGroup: Joi.string().valid('A', 'B', 'AB', 'O').required(),
  rhesusFactor: Joi.string().valid('positive', 'negative', '+', '-').required(),
  dateOfBirth: Joi.date().iso().optional(),
  gender: Joi.string().valid('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY').optional(),
  address: Joi.string().optional(),
  lga: Joi.string().optional(),
  state: Joi.string().optional(),
  preferredChannel: Joi.string().valid('SMS', 'WHATSAPP', 'EMAIL', 'VOICE', 'IN_APP').default('SMS'),
  consentGiven: Joi.boolean().required(),
  dataSharingConsent: Joi.boolean().default(false),
  healthInformation: Joi.string().optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const sendOtpSchema = Joi.object({
  userId: Joi.string().uuid().optional(),
  email: Joi.string().email().optional(),
  purpose: Joi.string().valid('EMAIL_VERIFICATION', 'PHONE_VERIFICATION', 'PASSWORD_RESET', 'LOGIN_2FA').optional(),
  type: Joi.string().valid('EMAIL_VERIFICATION', 'PHONE_VERIFICATION', 'PASSWORD_RESET', 'LOGIN_2FA').optional(),
}).or('userId', 'email');

const verifyOtpSchema = Joi.object({
  userId: Joi.string().uuid().optional(),
  email: Joi.string().email().optional(),
  otp: Joi.string().length(6).pattern(/^\d+$/).required(),
  purpose: Joi.string().valid('EMAIL_VERIFICATION', 'PHONE_VERIFICATION', 'PASSWORD_RESET', 'LOGIN_2FA').optional(),
  type: Joi.string().valid('EMAIL_VERIFICATION', 'PHONE_VERIFICATION', 'PASSWORD_RESET', 'LOGIN_2FA').optional(),
}).or('userId', 'email');

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  password: Joi.string().min(8).required(),
});

module.exports = {
  registerOrganizationSchema,
  registerDonorSchema,
  loginSchema,
  sendOtpSchema,
  verifyOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};
