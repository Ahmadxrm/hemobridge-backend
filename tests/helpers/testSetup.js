'use strict';

const request = require('supertest');
const app = require('../../src/app');
const { pool, query } = require('../../src/config/database');
const { hashPassword } = require('../../src/utils/crypto');
const { generateAccessToken, createSession } = require('../../src/middleware/auth');

async function clearTestData() {
  const tables = [
    'sessions',
    'otps',
    'password_reset_tokens',
    'audit_logs',
    'notifications',
    'notification_preferences',
    'low_stock_alerts',
    'donor_responses',
    'request_transfers',
    'emergency_requests',
    'donation_requests',
    'blood_inventory',
    'payments',
    'payment_events',
    'subscriptions',
    'donors',
    'organizations',
    'users',
  ];
  for (const table of tables) {
    try {
      await query(`TRUNCATE TABLE ${table} CASCADE`);
    } catch (error) {
      // Ignore table truncate error if table does not exist
    }
  }
}

async function createTestUser(role, extra = {}) {
  const email = `test-${role.toLowerCase()}-${Date.now()}-${Math.floor(Math.random() * 100000)}@test.com`;
  const password = 'Test@12345!';
  const hashedPassword = await hashPassword(password);
  
  const result = await query(
    `INSERT INTO users (email, role, status, email_verified, password_hash)
     VALUES ($1, $2, 'ACTIVE', true, $3)
     RETURNING *`,
    [email, role, hashedPassword]
  );
  
  const user = result.rows[0];
  const { token, jti } = generateAccessToken({ id: user.id, email: user.email, role: user.role });
  await createSession(user.id, jti);

  if (role === 'HOSPITAL' || role === 'BLOOD_BANK') {
    await query(
      `INSERT INTO organizations (user_id, name, email, phone, address, state, city, organization_type, status)
       VALUES ($1, $2, $3, $4, '123 Test St', 'Lagos', 'Lagos', $5, 'VERIFIED')
       ON CONFLICT (user_id) DO UPDATE SET status = 'VERIFIED'`,
      [user.id, `${role} Test Org`, email, '+2348000000000', role]
    );
  } else if (role === 'DONOR') {
    await query(
      `INSERT INTO donors (user_id, full_name, blood_type, is_available, consent_given)
       VALUES ($1, 'Test Donor', 'O+', true, true)
       ON CONFLICT (user_id) DO NOTHING`,
      [user.id]
    );
  }
  
  return { user, token };
}

module.exports = {
  app,
  request,
  pool,
  query,
  clearTestData,
  createTestUser,
};
