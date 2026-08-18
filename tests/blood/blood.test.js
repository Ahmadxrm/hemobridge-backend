'use strict';

const { app, request, clearTestData, pool } = require('../helpers/testSetup');

describe('Blood Search API', () => {
  jest.setTimeout(30000);

  beforeAll(async () => {
    await clearTestData();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('should search blood by type and location', async () => {
    const res = await request(app).get('/api/v1/blood/search?type=O%2B&lat=6.45&lng=3.39&radius=50');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.results)).toBe(true);
  });

  it('should require all search params', async () => {
    const res = await request(app).get('/api/v1/blood/search?lat=6.45&lng=3.39');
    expect(res.status).toBe(400);
  });

  it('should not require authentication for blood search', async () => {
    const res = await request(app).get('/api/v1/blood/search?type=O%2B&lat=6.45&lng=3.39');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.results)).toBe(true);
  });

  it('should not return expired inventory in results', async () => {
    const res = await request(app).get('/api/v1/blood/search?type=O%2B&lat=6.45&lng=3.39');
    expect(res.status).toBe(200);
    const expiredItem = res.body.data.results.find(item => new Date(item.expiryDate) < new Date());
    expect(expiredItem).toBeUndefined();
  });
});
