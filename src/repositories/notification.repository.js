'use strict';

const { query } = require('../config/database');

const create = async ({ userId, channel, subject, body, recipientPhone, recipientEmail, eventType, entityType, entityId, templateId, templateData }) => {
  const result = await query(`
    INSERT INTO notifications (
      user_id, channel, subject, body, recipient_phone, recipient_email,
      event_type, entity_type, entity_id, template_id, template_data
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
    ) RETURNING *
  `, [userId, channel, subject, body, recipientPhone, recipientEmail, eventType, entityType, entityId, templateId, templateData]);
  return result.rows[0];
};

const updateStatus = async (id, status, { providerRef, provider, failureReason } = {}) => {
  const result = await query(`
    UPDATE notifications
    SET status = $2, provider_ref = $3, provider = $4, failure_reason = $5, updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [id, status, providerRef, provider, failureReason]);
  return result.rows[0];
};

const markSent = async (id, providerRef, provider) => {
  const result = await query(`
    UPDATE notifications
    SET status = 'SENT', sent_at = NOW(), provider_ref = $2, provider = $3, updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [id, providerRef, provider]);
  return result.rows[0];
};

const markFailed = async (id, failureReason) => {
  const result = await query(`
    UPDATE notifications
    SET status = 'FAILED', failure_reason = $2, updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [id, failureReason]);
  return result.rows[0];
};

const scheduleRetry = async (id, nextRetryAt) => {
  const result = await query(`
    UPDATE notifications
    SET status = 'RETRYING', retry_count = retry_count + 1, next_retry_at = $2, updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [id, nextRetryAt]);
  return result.rows[0];
};

const findPendingRetries = async () => {
  const result = await query(`
    SELECT * FROM notifications
    WHERE status = 'RETRYING'
      AND next_retry_at <= NOW()
      AND retry_count < 3
  `);
  return result.rows;
};

const findForUser = async (userId, { page = 1, limit = 10 }) => {
  const offset = (page - 1) * limit;
  
  const countResult = await query(`SELECT COUNT(*) FROM notifications WHERE user_id = $1`, [userId]);
  const total = parseInt(countResult.rows[0].count, 10);
  
  const result = await query(`
    SELECT * FROM notifications
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3
  `, [userId, limit, offset]);
  
  return { data: result.rows, total, page, limit, totalPages: Math.ceil(total / limit) };
};

const markRead = async (id, userId) => {
  const result = await query(`
    UPDATE notifications
    SET read_at = NOW(), updated_at = NOW()
    WHERE id = $1 AND user_id = $2
    RETURNING *
  `, [id, userId]);
  return result.rows[0];
};

const getPreferences = async (userId) => {
  const result = await query('SELECT * FROM notification_preferences WHERE user_id = $1', [userId]);
  return result.rows[0] || null;
};

const upsertPreferences = async (userId, { sms, whatsapp, email, voice, inApp }) => {
  const result = await query(`
    INSERT INTO notification_preferences (user_id, sms, whatsapp, email, voice, in_app)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (user_id) DO UPDATE
    SET sms = EXCLUDED.sms,
        whatsapp = EXCLUDED.whatsapp,
        email = EXCLUDED.email,
        voice = EXCLUDED.voice,
        in_app = EXCLUDED.in_app,
        updated_at = NOW()
    RETURNING *
  `, [userId, sms, whatsapp, email, voice, inApp]);
  return result.rows[0];
};

const createDefaultPreferences = async (userId) => {
  const result = await query(`
    INSERT INTO notification_preferences (user_id, sms, whatsapp, email, voice, in_app)
    VALUES ($1, true, false, true, false, true)
    RETURNING *
  `, [userId]);
  return result.rows[0];
};

module.exports = {
  create,
  updateStatus,
  markSent,
  markFailed,
  scheduleRetry,
  findPendingRetries,
  findForUser,
  markRead,
  getPreferences,
  upsertPreferences,
  createDefaultPreferences
};
