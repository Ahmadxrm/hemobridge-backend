'use strict';

require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:5000',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME || 'hemobridge_dev',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    max: parseInt(process.env.DB_POOL_MAX, 10) || 10,
    min: parseInt(process.env.DB_POOL_MIN, 10) || 2,
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE, 10) || 10000,
    connectionTimeoutMillis: 10000,
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev_secret_change_in_production_32chars',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_change_in_production',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  otp: {
    expiresInMinutes: parseInt(process.env.OTP_EXPIRES_IN_MINUTES, 10) || 10,
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS, 10) || 5,
    resendCooldownSeconds: parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS, 10) || 60,
  },

  cors: {
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
      : ['http://localhost:5173', 'http://localhost:3000'],
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
    authMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) || 20,
    otpMax: parseInt(process.env.OTP_RATE_LIMIT_MAX, 10) || 5,
  },

  termii: {
    apiKey: process.env.TERMII_API_KEY || '',
    senderId: process.env.TERMII_SENDER_ID || 'HemoBridge',
    baseUrl: process.env.TERMII_BASE_URL || 'https://api.ng.termii.com/api',
  },

  whatsapp: {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    baseUrl: process.env.WHATSAPP_BASE_URL || 'https://graph.facebook.com/v20.0',
  },

  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY || '',
    from: process.env.EMAIL_FROM || 'noreply@hemobridge.com',
    fromName: process.env.EMAIL_FROM_NAME || 'HemoBridge',
  },

  africastalking: {
    apiKey: process.env.AT_API_KEY || '',
    username: process.env.AT_USERNAME || '',
    baseUrl: process.env.AT_BASE_URL || 'https://voice.africastalking.com',
  },

  paystack: {
    secretKey: process.env.PAYSTACK_SECRET_KEY || '',
    publicKey: process.env.PAYSTACK_PUBLIC_KEY || '',
    baseUrl: process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co',
    webhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET || '',
  },

  lowStock: {
    defaultThreshold: parseInt(process.env.DEFAULT_LOW_STOCK_THRESHOLD, 10) || 5,
    checkIntervalMinutes: parseInt(process.env.LOW_STOCK_CHECK_INTERVAL_MINUTES, 10) || 30,
  },

  passwordReset: {
    expiresInMinutes: parseInt(process.env.PASSWORD_RESET_EXPIRES_IN_MINUTES, 10) || 60,
  },

  logging: {
    level: process.env.LOG_LEVEL || 'debug',
  },
};

// Validate critical configuration in production
if (config.env === 'production') {
  const required = [
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'DB_PASSWORD',
    'PAYSTACK_SECRET_KEY',
  ];

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables in production: ${missing.join(', ')}`);
  }
}

module.exports = config;
