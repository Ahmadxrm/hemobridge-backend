'use strict';

const { query } = require('../config/database');

const findById = async (id) => {
  const result = await query('SELECT * FROM users WHERE id=$1', [id]);
  return result.rows[0] || null;
};

const findByEmail = async (email) => {
  const result = await query('SELECT * FROM users WHERE email=$1', [email]);
  return result.rows[0] || null;
};

const findByEmailOrPhone = async (email, phone) => {
  const result = await query('SELECT * FROM users WHERE email=$1 OR phone=$2', [email, phone]);
  return result.rows[0] || null;
};

const create = async ({ email, phone, passwordHash, role }) => {
  const result = await query(
    'INSERT INTO users (email, phone, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *',
    [email, phone, passwordHash, role]
  );
  return result.rows[0];
};

/**
 * Generic update — builds SET clause from provided fields object.
 * Ignores undefined values. Camel-cased keys are mapped to snake_case automatically.
 */
const update = async (id, fields) => {
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return findById(id);

  const sets = entries.map(([k, _], i) => `${camelToSnake(k)} = $${i + 2}`).join(', ');
  const values = entries.map(([, v]) => v);

  const result = await query(
    `UPDATE users SET ${sets}, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id, ...values]
  );
  return result.rows[0];
};

/** Convert camelCase to snake_case for dynamic updates. */
function camelToSnake(str) {
  return str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

const updateStatus = async (id, status) => {
  const result = await query(
    'UPDATE users SET status=$2, updated_at=NOW() WHERE id=$1 RETURNING *',
    [id, status]
  );
  return result.rows[0];
};

const incrementFailedLogin = async (id) => {
  const result = await query(
    'UPDATE users SET failed_login_attempts=failed_login_attempts+1, updated_at=NOW() WHERE id=$1 RETURNING *',
    [id]
  );
  return result.rows[0];
};

const resetFailedLogin = async (id) => {
  const result = await query(
    'UPDATE users SET failed_login_attempts=0, locked_until=NULL, updated_at=NOW() WHERE id=$1 RETURNING *',
    [id]
  );
  return result.rows[0];
};

const lockAccount = async (id, until) => {
  const result = await query(
    'UPDATE users SET locked_until=$2, updated_at=NOW() WHERE id=$1 RETURNING *',
    [id, until]
  );
  return result.rows[0];
};

const updateLastLogin = async (id) => {
  const result = await query(
    'UPDATE users SET last_login_at=NOW(), updated_at=NOW() WHERE id=$1 RETURNING *',
    [id]
  );
  return result.rows[0];
};

const updatePassword = async (id, passwordHash) => {
  const result = await query(
    'UPDATE users SET password_hash=$2, updated_at=NOW() WHERE id=$1 RETURNING *',
    [id, passwordHash]
  );
  return result.rows[0];
};

const verifyEmail = async (id) => {
  const user = await findById(id);
  if (!user) return null;

  let newStatus = user.status;
  if (user.status === 'PENDING_VERIFICATION' && user.role === 'DONOR') {
    newStatus = 'ACTIVE';
  }

  const result = await query(
    'UPDATE users SET email_verified=true, status=$2, updated_at=NOW() WHERE id=$1 RETURNING *',
    [id, newStatus]
  );
  return result.rows[0];
};

module.exports = {
  findById,
  findByEmail,
  findByEmailOrPhone,
  create,
  update,
  updateStatus,
  incrementFailedLogin,
  resetFailedLogin,
  lockAccount,
  updateLastLogin,
  updatePassword,
  verifyEmail,
};
