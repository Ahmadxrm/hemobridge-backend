'use strict';

const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const { query } = require('../config/database');
const { AuthenticationError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Authenticate a request using the Bearer JWT token.
 * Attaches the decoded user payload to req.user.
 * Verifies the token has not been invalidated (blacklisted).
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No authentication token provided');
    }

    const token = authHeader.slice(7);

    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new AuthenticationError('Authentication token has expired');
      }
      throw new AuthenticationError('Invalid authentication token');
    }

    // Check session is still valid (blacklist check)
    if (decoded.jti) {
      const sessionResult = await query(
        'SELECT is_valid, expires_at FROM sessions WHERE jti = $1',
        [decoded.jti]
      );

      if (sessionResult.rows.length === 0 || !sessionResult.rows[0].is_valid) {
        throw new AuthenticationError('Session has been invalidated. Please log in again.');
      }
    }

    // Fetch current user status
    const userResult = await query(
      'SELECT id, email, role, status FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      throw new AuthenticationError('User account not found');
    }

    const user = userResult.rows[0];

    if (user.status === 'SUSPENDED') {
      throw new AuthenticationError('Your account has been suspended. Please contact support.');
    }

    if (user.status === 'INACTIVE') {
      throw new AuthenticationError('Your account is inactive.');
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      jti: decoded.jti,
    };

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Optional authentication — attach user if token present, continue if not.
 * Used for routes that serve both authenticated and anonymous requests.
 */
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  return authenticate(req, res, next);
}

/**
 * Generate a signed JWT access token with a jti claim.
 */
function generateAccessToken(user) {
  const jti = uuidv4();
  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      jti,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
  return { token, jti };
}

/**
 * Register a new session in the sessions table.
 */
async function createSession(userId, jti, req) {
  // Calculate expiry from the JWT expiry setting
  const expiryMs = parseJwtExpiry(config.jwt.expiresIn);
  const expiresAt = new Date(Date.now() + expiryMs);

  await query(
    `INSERT INTO sessions (user_id, jti, expires_at, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (jti) DO NOTHING`,
    [
      userId,
      jti,
      expiresAt.toISOString(),
      req?.ip || null,
      req?.headers?.['user-agent'] || null,
    ]
  );

  return expiresAt;
}

/**
 * Invalidate a session (logout).
 */
async function invalidateSession(jti) {
  await query(
    `UPDATE sessions SET is_valid = FALSE, invalidated_at = NOW()
     WHERE jti = $1`,
    [jti]
  );
}

/**
 * Parse JWT expiry string to milliseconds.
 */
function parseJwtExpiry(expiry) {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) return 15 * 60 * 1000; // default 15 minutes
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return value * (multipliers[unit] || 60000);
}

module.exports = {
  authenticate,
  optionalAuth,
  generateAccessToken,
  createSession,
  invalidateSession,
};
