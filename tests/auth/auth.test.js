'use strict';

const { app, request, clearTestData, createTestUser, query, pool } = require('../helpers/testSetup');
const { v4: uuidv4 } = require('uuid');

describe('Authentication API', () => {
  jest.setTimeout(30000);

  beforeAll(async () => {
    await clearTestData();
  });

  afterAll(async () => {
    await pool.end();
  });

  const uniqueEmail = () => `test-${Date.now()}@test.com`;

  it('should register a hospital organisation', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register/organization')
      .send({
        name: 'Test Hospital',
        email: uniqueEmail(),
        phone: '+2348000000001',
        password: 'Test@12345!',
        role: 'HOSPITAL',
        address: '123 Test St',
        state: 'Lagos',
        city: 'Lagos'
      });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data.user.role).toBe('HOSPITAL');
    expect(res.body.data.user.status).toBe('PENDING_VERIFICATION');
  });

  it('should register a donor', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register/donor')
      .send({
        fullName: 'Test Donor',
        email: uniqueEmail(),
        phone: '+2348012345678',
        password: 'Test@12345!',
        bloodGroup: 'O',
        rhesusFactor: 'positive',
        consentGiven: true
      });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('DONOR');
  });

  it('should reject donor registration without consent', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register/donor')
      .send({
        fullName: 'Test Donor',
        email: uniqueEmail(),
        phone: '+2348012345679',
        password: 'Test@12345!',
        bloodGroup: 'O',
        rhesusFactor: 'positive',
        consentGiven: false
      });
    expect(res.status).toBe(422);
    expect(res.body.status).toBe('error');
  });

  it('should reject registration with duplicate email', async () => {
    const email = uniqueEmail();
    const data = {
      fullName: 'Test Donor',
      email,
      phone: '+2348012345670',
      password: 'Test@12345!',
      bloodGroup: 'O',
      rhesusFactor: 'positive',
      consentGiven: true
    };
    await request(app).post('/api/v1/auth/register/donor').send(data);
    const res = await request(app).post('/api/v1/auth/register/donor').send(data);
    expect(res.status).toBe(409);
  });

  it('should reject login with invalid credentials', async () => {
    const { user } = await createTestUser('DONOR');
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: user.email,
        password: 'WrongPassword123!'
      });
    expect(res.status).toBe(401);
  });

  it('should login successfully for an active donor', async () => {
    const { user } = await createTestUser('DONOR');
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: user.email,
        password: 'Test@12345!'
      });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.role).toBe('DONOR');
  });

  it('should reject login for pending org', async () => {
    const { user } = await createTestUser('HOSPITAL');
    await query(`UPDATE users SET status = 'PENDING_VERIFICATION' WHERE id = $1`, [user.id]);
    
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: user.email,
        password: 'Test@12345!'
      });
    expect(res.status).toBe(401);
  });

  it('should return profile on GET /me', async () => {
    const { token } = await createTestUser('DONOR');
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', \`Bearer \${token}\`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBeDefined();
  });

  it('should reject unauthenticated /me', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('should send OTP and verify it (failure case)', async () => {
    const { user } = await createTestUser('DONOR');
    
    // Attempt to send OTP
    const sendRes = await request(app)
      .post('/api/v1/auth/otp/send')
      .send({ email: user.email, type: 'EMAIL_VERIFICATION' });
    expect(sendRes.status).toBe(200);

    // Verify OTP with wrong code
    const verifyRes = await request(app)
      .post('/api/v1/auth/otp/verify')
      .send({ email: user.email, otp: '000000', type: 'EMAIL_VERIFICATION' });
    expect(verifyRes.status).toBe(400);
  });
});
