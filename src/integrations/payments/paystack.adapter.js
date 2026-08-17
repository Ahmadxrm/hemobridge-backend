'use strict';

const axios = require('axios');
const crypto = require('crypto');
const config = require('../../config');
const logger = require('../../utils/logger');

/**
 * Paystack Payment Adapter.
 *
 * Configuration required (in .env):
 *   PAYSTACK_SECRET_KEY
 *   PAYSTACK_WEBHOOK_SECRET
 *
 * In development (no key), logs and returns mock responses.
 */

const isDev = !config.paystack.secretKey;

const client = axios.create({
  baseURL: config.paystack.baseUrl,
  headers: {
    Authorization: `Bearer ${config.paystack.secretKey}`,
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

/**
 * Initialise a payment transaction.
 * @param {{ email, amountKobo, reference, metadata, callbackUrl }} options
 * @returns {{ success, authorizationUrl, reference, accessCode, error }}
 */
async function initiatePayment({ email, amountKobo, reference, metadata, callbackUrl }) {
  if (isDev) {
    logger.warn('[PAYSTACK:MOCK] Paystack not configured. Simulating payment init.', {
      email,
      amountKobo,
      reference,
    });
    return {
      success: true,
      authorizationUrl: `https://checkout.paystack.com/mock/${reference}`,
      reference,
      accessCode: `mock-ac-${Date.now()}`,
      mock: true,
    };
  }

  try {
    const response = await client.post('/transaction/initialize', {
      email,
      amount: amountKobo,
      reference,
      metadata,
      callback_url: callbackUrl,
      currency: 'NGN',
    });

    const data = response.data?.data;
    return {
      success: true,
      authorizationUrl: data.authorization_url,
      reference: data.reference,
      accessCode: data.access_code,
    };
  } catch (err) {
    const errMsg = err.response?.data?.message || err.message;
    logger.error('Paystack payment init failed', { error: errMsg });
    return { success: false, error: errMsg };
  }
}

/**
 * Verify a payment by reference.
 * @param {string} reference
 * @returns {{ success, status, amountKobo, reference, data, error }}
 */
async function verifyPayment(reference) {
  if (isDev) {
    logger.warn('[PAYSTACK:MOCK] Simulating payment verification.', { reference });
    return {
      success: true,
      status: 'success',
      amountKobo: 1000000,
      reference,
      mock: true,
    };
  }

  try {
    const response = await client.get(`/transaction/verify/${reference}`);
    const data = response.data?.data;
    return {
      success: true,
      status: data.status,
      amountKobo: data.amount,
      reference: data.reference,
      data,
    };
  } catch (err) {
    const errMsg = err.response?.data?.message || err.message;
    logger.error('Paystack verification failed', { reference, error: errMsg });
    return { success: false, error: errMsg };
  }
}

/**
 * Verify an incoming Paystack webhook signature.
 * Returns true if the signature is valid.
 *
 * @param {string} body - Raw request body string
 * @param {string} signature - Value of X-Paystack-Signature header
 * @returns {boolean}
 */
function verifyWebhookSignature(body, signature) {
  if (!config.paystack.webhookSecret) {
    if (config.env === 'development') {
      logger.warn('[PAYSTACK:MOCK] Webhook secret not configured. Skipping signature verify in dev.');
      return true;
    }
    return false;
  }

  const hash = crypto
    .createHmac('sha512', config.paystack.webhookSecret)
    .update(body)
    .digest('hex');

  return hash === signature;
}

module.exports = { initiatePayment, verifyPayment, verifyWebhookSignature };
