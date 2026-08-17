'use strict';

const request = require('supertest');
const app = require('../../src/app');
const { pool, query } = require('../../src/config/database');
const { hashPassword } = require('../../src/utils/crypto');
const { generateAccessToken } = require('../../src/middleware/auth');
const { v4: uuidv4 } = require('uuid');

async function clearTestData() {
  const tables = [
    'users', 'organizations', 'donors', 'inventory_units', 'blood_requests', 'subscriptions', 'payments'
  ];
  for (const table of tables) {
    try {
      await query(`TRUNCATE TABLE ${table} CASCADE`);
    } catch (error) {
      // Ignore if table doesn't exist
    }
  }
}

async function createTestUser(role) {
  const email = `test-${role.toLowerCase()}-${Date.now()}@test.com`;
  const password = 'Test@12345!';
  const hashedPassword = await hashPassword(password);
  
  const result = await query(
    `INSERT INTO users (email, role, status, email_verified, password_hash)
     VALUES ($1, $2, 'ACTIVE', true, $3)
     RETURNING *`,
    [email, role, hashedPassword]
  );
  
  const user = result.rows[0];
  const token = generateAccessToken({ id: user.id, email: user.email, role: user.role });
  
  return { user, token };
}

module.exports = {
  app,
  request,
  pool,
  query,
  clearTestData,
  createTestUser
};
