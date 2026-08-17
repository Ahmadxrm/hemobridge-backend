'use strict';

const axios = require('axios');
const config = require('../../config');
const logger = require('../../utils/logger');

/**
 * Meta WhatsApp Business API Adapter.
 *
 * Configuration required (in .env):
 *   WHATSAPP_ACCESS_TOKEN
 *   WHATSAPP_PHONE_NUMBER_ID
 *   WHATSAPP_BASE_URL
 *
 * In development, logs and returns mock success.
 */

const isDev = !config.whatsapp.accessToken || !config.whatsapp.phoneNumberId;

async function send({ recipient, body }) {
  // Normalise phone: WhatsApp requires international format without '+'
  const phone = recipient.replace(/^\+/, '').replace(/\s/g, '');

  if (isDev) {
    logger.warn('[WHATSAPP:MOCK] WhatsApp not configured. Simulating delivery.', {
      recipient: phone,
      body: body.substring(0, 80),
    });
    return {
      success: true,
      providerRef: `mock-wa-${Date.now()}`,
      mock: true,
    };
  }

  try {
    const response = await axios.post(
      `${config.whatsapp.baseUrl}/${config.whatsapp.phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body },
      },
      {
        headers: {
          Authorization: `Bearer ${config.whatsapp.accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    const msgId = response.data?.messages?.[0]?.id;
    logger.info('WhatsApp message sent', { recipient: phone, msgId });

    return { success: true, providerRef: msgId || '' };
  } catch (err) {
    const errMsg = err.response?.data?.error?.message || err.message;
    logger.error('WhatsApp delivery failed', { recipient: phone, error: errMsg });
    return { success: false, error: errMsg };
  }
}

module.exports = { send };
