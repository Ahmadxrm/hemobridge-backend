'use strict';

const { app, request, clearTestData, createTestUser, query, pool } = require('../helpers/testSetup');

describe('Inventory API', () => {
  jest.setTimeout(30000);

  let orgToken;
  let orgId;
  let donorToken;
  let inventoryUnitId;

  beforeAll(async () => {
    await clearTestData();
    const { user, token } = await createTestUser('HOSPITAL');
    orgToken = token;
    
    // Retrieve linked organization
    const orgRes = await query(
      `SELECT id FROM organizations WHERE user_id = $1`,
      [user.id]
    );
    orgId = orgRes.rows[0].id;

    const donor = await createTestUser('DONOR');
    donorToken = donor.token;
  });

  afterAll(async () => {
    await pool.end();
  });

  it('should create an inventory unit', async () => {
    const res = await request(app)
      .post('/api/v1/inventory/units')
      .set('Authorization', `Bearer ${orgToken}`)
      .send({
        bloodGroup: 'O',
        rhesusFactor: 'positive',
        componentType: 'WHOLE_BLOOD',
        volumeMl: 450,
        quantity: 10,
        collectionDate: new Date().toISOString(),
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      });
    expect(res.status).toBe(201);
    inventoryUnitId = res.body.data.id;
  });

  it('should get inventory units', async () => {
    const res = await request(app)
      .get('/api/v1/inventory/units')
      .set('Authorization', `Bearer ${orgToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('should update an inventory unit', async () => {
    const res = await request(app)
      .patch(`/api/v1/inventory/units/${inventoryUnitId}`)
      .set('Authorization', `Bearer ${orgToken}`)
      .send({ quantity: 5 });
    expect(res.status).toBe(200);
  });

  it('should reject negative quantity in update', async () => {
    const res = await request(app)
      .patch(`/api/v1/inventory/units/${inventoryUnitId}`)
      .set('Authorization', `Bearer ${orgToken}`)
      .send({ quantity: -1 });
    expect([400, 422]).toContain(res.status);
  });

  it('should delete an inventory unit', async () => {
    const res = await request(app)
      .delete(`/api/v1/inventory/units/${inventoryUnitId}`)
      .set('Authorization', `Bearer ${orgToken}`);
    expect(res.status).toBe(200);
  });

  it('should reject inventory creation by donor', async () => {
    const res = await request(app)
      .post('/api/v1/inventory/units')
      .set('Authorization', `Bearer ${donorToken}`)
      .send({
        bloodGroup: 'O',
        rhesusFactor: 'positive',
        componentType: 'WHOLE_BLOOD',
        volumeMl: 450,
        quantity: 10,
        collectionDate: new Date().toISOString(),
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      });
    expect(res.status).toBe(403);
  });

  it('should get dashboard', async () => {
    const res = await request(app)
      .get('/api/v1/inventory/dashboard')
      .set('Authorization', `Bearer ${orgToken}`);
    expect(res.status).toBe(200);
  });

  it('should reject inventory from another org', async () => {
    // Re-create a unit for org 1
    const createRes = await request(app)
      .post('/api/v1/inventory/units')
      .set('Authorization', `Bearer ${orgToken}`)
      .send({
        bloodGroup: 'A',
        rhesusFactor: 'negative',
        componentType: 'WHOLE_BLOOD',
        volumeMl: 450,
        quantity: 1,
        collectionDate: new Date().toISOString(),
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      });
    const unitId = createRes.body.data.id;

    // Create org 2
    const { token: token2 } = await createTestUser('HOSPITAL');

    // Update with org 2 token
    const res = await request(app)
      .patch(`/api/v1/inventory/units/${unitId}`)
      .set('Authorization', `Bearer ${token2}`)
      .send({ quantity: 2 });
    expect(res.status).toBe(403);
  });
});
