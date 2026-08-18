'use strict';

const { app, request, clearTestData, createTestUser, query, pool } = require('../helpers/testSetup');

describe('Emergency Requests API', () => {
  jest.setTimeout(30000);

  let hospitalToken;
  let hospitalOrgId;
  let bloodBankToken;
  let bloodBankOrgId;
  let donorToken;
  let requestId;

  beforeAll(async () => {
    await clearTestData();

    // Create hospital
    const { user: hospitalUser, token: hToken } = await createTestUser('HOSPITAL');
    hospitalToken = hToken;
    const hOrgRes = await query(
      `SELECT id FROM organizations WHERE user_id = $1`,
      [hospitalUser.id]
    );
    hospitalOrgId = hOrgRes.rows[0].id;

    // Create blood bank
    const { user: bbUser, token: bToken } = await createTestUser('BLOOD_BANK');
    bloodBankToken = bToken;
    const bbOrgRes = await query(
      `SELECT id FROM organizations WHERE user_id = $1`,
      [bbUser.id]
    );
    bloodBankOrgId = bbOrgRes.rows[0].id;

    // Create donor
    const donor = await createTestUser('DONOR');
    donorToken = donor.token;
  });

  afterAll(async () => {
    await pool.end();
  });

  it('should create an emergency request', async () => {
    const res = await request(app)
      .post('/api/v1/requests')
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({
        bloodGroup: 'O',
        rhesusFactor: 'positive',
        componentType: 'WHOLE_BLOOD',
        unitsRequired: 2,
        urgencyLevel: 'CRITICAL',
        targetBloodBankId: bloodBankOrgId
      });
    expect(res.status).toBe(201);
    requestId = res.body.data.id;
  });

  it('should get requests list', async () => {
    const res = await request(app)
      .get('/api/v1/requests')
      .set('Authorization', `Bearer ${hospitalToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('should get single request', async () => {
    const res = await request(app)
      .get(`/api/v1/requests/${requestId}`)
      .set('Authorization', `Bearer ${hospitalToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(requestId);
  });

  it('should approve a request', async () => {
    const res = await request(app)
      .patch(`/api/v1/requests/${requestId}/status`)
      .set('Authorization', `Bearer ${bloodBankToken}`)
      .send({
        status: 'APPROVED'
      });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('APPROVED');
  });

  it('should reject invalid status transition', async () => {
    // Create a new request and reject it
    const reqRes = await request(app)
      .post('/api/v1/requests')
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({
        bloodGroup: 'A',
        rhesusFactor: 'negative',
        componentType: 'WHOLE_BLOOD',
        unitsRequired: 1,
        urgencyLevel: 'HIGH',
        targetBloodBankId: bloodBankOrgId
      });
    const newReqId = reqRes.body.data.id;

    await request(app)
      .patch(`/api/v1/requests/${newReqId}/status`)
      .set('Authorization', `Bearer ${bloodBankToken}`)
      .send({
        status: 'REJECTED',
        rejectionReason: 'Not enough stock'
      });

    const res = await request(app)
      .patch(`/api/v1/requests/${newReqId}/status`)
      .set('Authorization', `Bearer ${bloodBankToken}`)
      .send({ status: 'APPROVED' });
    
    expect(res.status).toBe(422);
  });

  it('should reject unauthorized request creation', async () => {
    const res = await request(app)
      .post('/api/v1/requests')
      .set('Authorization', `Bearer ${donorToken}`)
      .send({
        bloodGroup: 'O',
        rhesusFactor: 'positive',
        componentType: 'WHOLE_BLOOD',
        unitsRequired: 2,
        urgencyLevel: 'CRITICAL'
      });
    expect(res.status).toBe(403);
  });

  it('should reject a request', async () => {
    const reqRes = await request(app)
      .post('/api/v1/requests')
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({
        bloodGroup: 'B',
        rhesusFactor: 'positive',
        componentType: 'WHOLE_BLOOD',
        unitsRequired: 3,
        urgencyLevel: 'NORMAL',
        targetBloodBankId: bloodBankOrgId
      });
    const newReqId = reqRes.body.data.id;

    const res = await request(app)
      .patch(`/api/v1/requests/${newReqId}/status`)
      .set('Authorization', `Bearer ${bloodBankToken}`)
      .send({
        status: 'REJECTED',
        rejectionReason: 'Out of stock'
      });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('REJECTED');
  });
});
