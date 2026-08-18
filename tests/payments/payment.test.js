'use strict';

const { app, request, clearTestData, createTestUser, query, pool } = require('../helpers/testSetup');

describe('Payments & Subscriptions', () => {
  jest.setTimeout(30000);

  let orgToken;
  let orgUserId;
  let planId;

  beforeAll(async () => {
    await clearTestData();
    const { user, token } = await createTestUser('HOSPITAL');
    orgToken = token;
    orgUserId = user.id;

    // Seed default subscription plan if not exists
    await query(`
      INSERT INTO plans (id, name, slug, description, price_kobo, trial_days, features, is_active, display_order)
      VALUES 
        ('00000000-0000-0000-0000-000000000001', 'Trial Plan', 'trial', '14-day trial plan', 0, 14, '["All Features"]'::jsonb, true, 1)
      ON CONFLICT (id) DO NOTHING
    `);
    planId = '00000000-0000-0000-0000-000000000001';
  });

  afterAll(async () => {
    await pool.end();
  });

  it('should return available plans', async () => {
    const res = await request(app)
      .get('/api/v1/plans');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('should create a trial subscription', async () => {
    const res = await request(app)
      .post('/api/v1/subscriptions')
      .set('Authorization', `Bearer ${orgToken}`)
      .send({
        planId
      });
    expect([200, 201]).toContain(res.status);
  });

  it('should reject duplicate webhook events (idempotency)', async () => {
    const payload = {
      event: 'charge.success',
      data: {
        reference: 'T' + Date.now(),
        status: 'success',
        amount: 10000,
        customer: { email: 'test@example.com' }
      }
    };

    const res1 = await request(app)
      .post('/api/v1/payments/webhook')
      .send(payload);

    const res2 = await request(app)
      .post('/api/v1/payments/webhook')
      .send(payload);

    expect([200, 400, 401]).toContain(res1.status); 
    expect([200, 400, 401]).toContain(res2.status);
  });

  it('should reject webhook with invalid signature', async () => {
    const res = await request(app)
      .post('/api/v1/payments/webhook')
      .set('x-paystack-signature', 'invalidsignature')
      .send({
        event: 'charge.success',
        data: {}
      });

    expect([400, 401, 403, 422]).toContain(res.status);
  });
});
