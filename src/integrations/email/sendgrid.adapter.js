'use strict';

const axios = require('axios');
const config = require('../../config');
const logger = require('../../utils/logger');

/**
 * SendGrid Email Adapter.
 *
 * Configuration required (in .env):
 *   SENDGRID_API_KEY
 *   EMAIL_FROM
 *   EMAIL_FROM_NAME
 *
 * In development, logs and returns mock success.
 */

const isDev = !config.sendgrid.apiKey;

async function send({ recipient, subject, body }) {
  if (isDev) {
    logger.warn('[EMAIL:MOCK] SendGrid not configured. Simulating email delivery.', {
      recipient,
      subject,
      preview: body.substring(0, 100),
    });
    return {
      success: true,
      providerRef: `mock-email-${Date.now()}`,
      mock: true,
    };
  }

  try {
    const response = await axios.post(
      'https://api.sendgrid.com/v3/mail/send',
      {
        personalizations: [{ to: [{ email: recipient }] }],
        from: {
          email: config.sendgrid.from,
          name: config.sendgrid.fromName,
        },
        subject: subject || 'HemoBridge Notification',
        content: [
          {
            type: 'text/plain',
            value: body,
          },
          {
            type: 'text/html',
            value: `<p>${body.replace(/\n/g, '<br>')}</p>`,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${config.sendgrid.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    // SendGrid returns 202 on success with X-Message-Id header
    const msgId = response.headers['x-message-id'] || '';
    logger.info('Email sent via SendGrid', { recipient, subject, msgId });

    return { success: true, providerRef: msgId };
  } catch (err) {
    const errMsg = err.response?.data?.errors?.[0]?.message || err.message;
    logger.error('SendGrid email delivery failed', { recipient, error: errMsg });
    return { success: false, error: errMsg };
  }
}

module.exports = { send };
