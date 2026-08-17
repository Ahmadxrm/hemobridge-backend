'use strict';

const axios = require('axios');
const config = require('../../config');
const logger = require('../../utils/logger');

/**
 * Africa's Talking Voice Call Adapter.
 *
 * Configuration required (in .env):
 *   AT_API_KEY
 *   AT_USERNAME
 *   AT_BASE_URL
 *
 * In development, logs and returns mock success.
 * Note: Voice calls typically use text-to-speech for the message body.
 */

const isDev = !config.africastalking.apiKey || !config.africastalking.username;

async function send({ recipient, body }) {
  // Normalise phone to international format for Africa's Talking
  const phone = recipient.startsWith('+') ? recipient : `+234${recipient.replace(/^0/, '')}`;

  if (isDev) {
    logger.warn('[VOICE:MOCK] Africa\'s Talking not configured. Simulating voice call.', {
      recipient: phone,
      scriptPreview: body.substring(0, 80),
    });
    return {
      success: true,
      providerRef: `mock-voice-${Date.now()}`,
      mock: true,
    };
  }

  try {
    // Africa's Talking voice API — make outbound call with TTS
    const response = await axios.post(
      `${config.africastalking.baseUrl}/call`,
      new URLSearchParams({
        username: config.africastalking.username,
        to: phone,
        from: '', // Use default caller ID from AT account
        // Note: For full TTS, you'd use a callbackUrl that serves SSML/XML
        // For MVP, we initiate the call and log the reference
      }),
      {
        headers: {
          apiKey: config.africastalking.apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        timeout: 15000,
      }
    );

    const entries = response.data?.entries?.[0];
    logger.info('Voice call initiated via Africa\'s Talking', {
      recipient: phone,
      status: entries?.status,
    });

    if (entries?.status === 'Queued') {
      return { success: true, providerRef: entries?.sessionId || '' };
    } else {
      return { success: false, error: entries?.errorMessage || 'Unknown error' };
    }
  } catch (err) {
    const errMsg = err.response?.data?.errorMessage || err.message;
    logger.error('Voice call failed', { recipient: phone, error: errMsg });
    return { success: false, error: errMsg };
  }
}

module.exports = { send };
