'use strict';

const argon2 = require('argon2');
const crypto = require('crypto');

/**
 * Hash a password using Argon2id.
 * @param {string} password - Plaintext password
 * @returns {Promise<string>} Argon2 hash
 */
async function hashPassword(password) {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 4,
  });
}

/**
 * Verify a password against an Argon2 hash.
 * @param {string} hash - Stored hash
 * @param {string} password - Plaintext password to verify
 * @returns {Promise<boolean>}
 */
async function verifyPassword(hash, password) {
  return argon2.verify(hash, password);
}

/**
 * Hash an OTP using Argon2id.
 * OTPs are shorter-lived so we use lighter settings.
 */
async function hashOTP(otp) {
  return argon2.hash(otp, {
    type: argon2.argon2id,
    memoryCost: 16384, // 16 MB
    timeCost: 2,
    parallelism: 2,
  });
}

/**
 * Verify an OTP against a stored hash.
 */
async function verifyOTP(hash, otp) {
  return argon2.verify(hash, otp);
}

/**
 * Generate a cryptographically secure token.
 * @param {number} bytes - Number of random bytes (default 32)
 * @returns {string} Hex-encoded token
 */
function generateSecureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Hash a token using SHA-256 for storage.
 * Used for password reset tokens (faster than Argon2 for tokens we control).
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  hashPassword,
  verifyPassword,
  hashOTP,
  verifyOTP,
  generateSecureToken,
  hashToken,
};
