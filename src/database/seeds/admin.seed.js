'use strict';

const { query } = require('../../config/database');
const { hashPassword } = require('../../utils/crypto');
const logger = require('../../utils/logger');

const seedAdmin = async () => {
  try {
    const adminEmail = 'admin@hemobridge.com';
    const { rows } = await query('SELECT id FROM users WHERE email = $1', [adminEmail]);

    if (rows.length === 0) {
      const hashedPassword = await hashPassword('Admin@HemoBridge2025!');
      await query(
        `INSERT INTO users (email, password_hash, role, status, email_verified)
         VALUES ($1, $2, 'ADMIN', 'ACTIVE', true)`,
        [adminEmail, hashedPassword]
      );
      logger.info('DEV ONLY: Admin user created. Email: admin@hemobridge.com / Password: Admin@HemoBridge2025! - NEVER USE IN PRODUCTION');
    } else {
      logger.info('Admin user already exists.');
    }
  } catch (error) {
    logger.error('Error seeding admin user:', error);
    throw error;
  }
};

module.exports = seedAdmin;
