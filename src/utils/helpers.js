'use strict';

const { PAGINATION } = require('./constants');

/**
 * Extract and validate pagination parameters from a query string.
 */
function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || PAGINATION.DEFAULT_PAGE);
  const limit = Math.min(
    PAGINATION.MAX_LIMIT,
    Math.max(1, parseInt(query.limit, 10) || PAGINATION.DEFAULT_LIMIT)
  );
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

/**
 * Combine blood group and rhesus factor into a standard blood type string.
 * @param {string} bloodGroup - e.g. 'A', 'B', 'AB', 'O'
 * @param {string} rhesusFactor - e.g. 'positive', 'negative', '+', '-'
 * @returns {string} e.g. 'A+', 'O-'
 */
function combineBloodType(bloodGroup, rhesusFactor) {
  const rhesus = rhesusFactor === 'positive' || rhesusFactor === '+' ? '+' : '-';
  return `${bloodGroup.toUpperCase()}${rhesus}`;
}

/**
 * Split a combined blood type into group + rhesus.
 * @param {string} bloodType - e.g. 'A+'
 * @returns {{ group: string, rhesus: string }}
 */
function splitBloodType(bloodType) {
  const rhesus = bloodType.endsWith('+') ? '+' : '-';
  const group = bloodType.slice(0, -1);
  return { group, rhesus };
}

/**
 * Generate a random numeric OTP of the given length.
 */
function generateOTP(length = 6) {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * digits.length)];
  }
  return otp;
}

/**
 * Remove sensitive fields from a user/donor object before sending to client.
 */
function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash, ...safe } = user;
  return safe;
}

/**
 * Strip private donor data based on consent and context.
 */
function sanitizeDonor(donor, includePrivate = false) {
  if (!donor) return null;
  if (includePrivate) return donor;
  const { phone, email, date_of_birth, address, lga, ...publicFields } = donor;
  return publicFields;
}

/**
 * Build a PostgreSQL UPDATE SET clause from an object.
 * Returns { setClauses, values, nextIndex }
 * Skips undefined values.
 */
function buildUpdateSet(data, startIndex = 1) {
  const setClauses = [];
  const values = [];
  let idx = startIndex;

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    setClauses.push(`${key} = $${idx}`);
    values.push(value);
    idx++;
  }

  return { setClauses: setClauses.join(', '), values, nextIndex: idx };
}

/**
 * Check if a value is a valid UUID v4.
 */
function isValidUUID(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Sleep for a given number of milliseconds. Useful in tests and retries.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Return the client IP address from an Express request.
 */
function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip ||
    'unknown'
  );
}

module.exports = {
  parsePagination,
  combineBloodType,
  splitBloodType,
  generateOTP,
  sanitizeUser,
  sanitizeDonor,
  buildUpdateSet,
  isValidUUID,
  sleep,
  getClientIp,
};
