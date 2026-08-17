'use strict';

const axios = require('axios');
const config = require('../../config');
const logger = require('../../utils/logger');

/**
 * Termii SMS Provider Adapter.
 *
 * Implements the INotificationProvider interface:
 *   send({ recipient, subject, body, templateData }) -> { success, providerRef, error }
 *
 * Configuration required (in .env):
 *   TERMII_API_KEY
 *   TERMII_SENDER_ID
 *   TERMII_BASE_URL
 *
 * In development (when API key is not configured), logs to console and returns a mock success.
 */

const isDev = !config.termii.apiKey;

async function send({ recipient, body }) {
  if (isDev) {
    logger.warn('[SMS:MOCK] Termii API key not configured. Simulating SMS delivery.', {
      recipient,
      body: body.substring(0, 80),
    });
    return {
      success: true,
      providerRef: `mock-sms-${Date.now()}`,
      mock: true,
    };
  }

  try {
    const response = await axios.post(
      `${config.termii.baseUrl}/sms/send`,
      {
        to: recipient,
        from: config.termii.senderId,
        sms: body,
        type: 'plain',
        channel: 'generic',
        api_key: config.termii.apiKey,
      },
      { timeout: 10000 }
    );

    const data = response.data;
    logger.info('SMS sent via Termii', { recipient, ref: data?.message_id });

    return {
      success: true,
      providerRef: String(data?.message_id || ''),
    };
  } catch (err) {
    const errMsg = err.response?.data?.message || err.message;
    logger.error('Termii SMS delivery failed', { recipient, error: errMsg });
    return {
      success: false,
      error: errMsg,
    };
  }
}

module.exports = { send };
