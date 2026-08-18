'use strict';

const { app, request, clearTestData, createTestUser, pool } = require('../helpers/testSetup');

describe('Donor API', () => {
  jest.setTimeout(30000);

  let donorToken;
  let donorUserId;
  let hospitalToken;

  beforeAll(async () => {
    await clearTestData();
    const donor = await createTestUser('DONOR');
    donorToken = donor.token;
    donorUserId = donor.user.id;

    const hospital = await createTestUser('HOSPITAL');
    hospitalToken = hospital.token;
  });

  afterAll(async () => {
    await pool.end();
  });

  it('should get donor profile', async () => {
    const res = await request(app)
      .get(`/api/v1/donors/${donorUserId}`)
      .set('Authorization', `Bearer ${donorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBeDefined();
  });

  it('should update donor profile', async () => {
    const res = await request(app)
      .patch(`/api/v1/donors/${donorUserId}/profile`)
      .set('Authorization', `Bearer ${donorToken}`)
      .send({
        address: '123 New Donor Lane',
        lga: 'Ikeja'
      });
    expect(res.status).toBe(200);
  });

  it('should update availability', async () => {
    const res = await request(app)
      .patch(`/api/v1/donors/${donorUserId}/availability`)
      .set('Authorization', `Bearer ${donorToken}`)
      .send({
        isAvailable: false
      });
    expect(res.status).toBe(200);
  });

  it('should not expose private donor info to organisations', async () => {
    const res = await request(app)
      .get(`/api/v1/donors/${donorUserId}`)
      .set('Authorization', `Bearer ${hospitalToken}`);
    expect(res.status).toBe(200);
    // Hospital shouldn't see exact contact details unless specific permission is granted
    expect(res.body.data.phone).toBeUndefined();
    expect(res.body.data.email).toBeUndefined();
  });

  it('should get donation history', async () => {
    const res = await request(app)
      .get(`/api/v1/donors/${donorUserId}/history`)
      .set('Authorization', `Bearer ${donorToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
