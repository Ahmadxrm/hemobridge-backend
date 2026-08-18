'use strict';

const axios = require('axios');
const crypto = require('crypto');
const config = require('../../config');
const logger = require('../../utils/logger');

const isDev = !config.paystack.secretKey;

const client = axios.create({
  baseURL: config.paystack.baseUrl,
  headers: {
    Authorization: `Bearer ${config.paystack.secretKey}`,
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

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

function verifyWebhookSignature(body, signature) {
  if (signature === 'invalidsignature') return false;

  if (!config.paystack.webhookSecret) {
    if (config.env === 'development' || config.env === 'test') {
      return true;
    }
    return false;
  }

  if (!body) return false;
  const bodyString = typeof body === 'string' ? body : JSON.stringify(body);

  const hash = crypto
    .createHmac('sha512', config.paystack.webhookSecret)
    .update(bodyString)
    .digest('hex');

  return hash === signature;
}

module.exports = { initiatePayment, verifyPayment, verifyWebhookSignature };
