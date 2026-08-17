'use strict';

const { query } = require('../config/database');

const create = async ({ userId, purpose, otpHash, contact, expiresAt }) => {
  const result = await query(`
    INSERT INTO otps (user_id, purpose, otp_hash, contact, expires_at)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [userId, purpose, otpHash, contact, expiresAt]);
  return result.rows[0];
};

const findLatest = async (userId, purpose) => {
  const result = await query(`
    SELECT * FROM otps
    WHERE user_id = $1 AND purpose = $2 AND is_used = false AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1
  `, [userId, purpose]);
  return result.rows[0] || null;
};

const markUsed = async (id) => {
  const result = await query(`
    UPDATE otps
    SET is_used = true, verified_at = NOW(), updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [id]);
  return result.rows[0];
};

const incrementAttempts = async (id) => {
  const result = await query(`
    UPDATE otps
    SET attempts = attempts + 1, updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [id]);
  return result.rows[0];
};

const deleteExpired = async () => {
  const result = await query(`
    DELETE FROM otps WHERE expires_at < NOW() RETURNING id
  `);
  return result.rowCount;
};

const createResetToken = async ({ userId, tokenHash, expiresAt }) => {
  const result = await query(`
    INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
    VALUES ($1, $2, $3)
    RETURNING *
  `, [userId, tokenHash, expiresAt]);
  return result.rows[0];
};

const findResetToken = async (tokenHash) => {
  const result = await query(`
    SELECT * FROM password_reset_tokens
    WHERE token_hash = $1 AND is_used = false AND expires_at > NOW()
  `, [tokenHash]);
  return result.rows[0] || null;
};

const markResetTokenUsed = async (id) => {
  const result = await query(`
    UPDATE password_reset_tokens
    SET is_used = true, used_at = NOW(), updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [id]);
  return result.rows[0];
};

module.exports = {
  create,
  findLatest,
  markUsed,
  incrementAttempts,
  deleteExpired,
  createResetToken,
  findResetToken,
  markResetTokenUsed
};
