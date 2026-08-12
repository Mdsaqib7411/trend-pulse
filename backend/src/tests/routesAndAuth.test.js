/**
 * Jest Unit & Integration Test Suite for Auth and Critical API Routes
 */
const request = require('supertest');
const app = require('../app');
const mongoose = require('mongoose');
const Trend = require('../models/Trend');

// Mock authMiddleware to test authenticated endpoints without live Firebase connection
jest.mock('../middlewares/authMiddleware', () => ({
  verifyToken: (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Unauthorized: No token provided' });
    }
    req.user = { uid: 'test-user-uid-123', email: 'test@trendpulse.app' };
    next();
  }
}));

// Mock trendAggregator service
jest.mock('../services/trendAggregator', () => ({
  getAggregatedTrends: jest.fn().mockResolvedValue({
    data: [{ trendId: 't1', title: 'AI Automation Revolution', category: 'Technology', trendScore: 92 }],
    isStale: false,
    fetchedAt: new Date().toISOString()
  })
}));

describe('🔑 Auth & Critical API Routes Test Suite', () => {

  beforeAll(() => {
    process.env.NODE_ENV = 'test';

    // Mock Trend.find for search endpoint test with full Mongoose query chain
    jest.spyOn(Trend, 'find').mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maxTimeMS: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        { trendId: 't1', title: 'AI Automation Revolution', category: 'Technology', trendScore: 92 }
      ])
    });
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  // Test 1: GET /health
  test('1. GET /health should return 200 and API status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('message', 'TrendPulse API is running');
    expect(res.body.data).toHaveProperty('status', 'ok');
  });

  // Test 2: GET /api/system/status
  test('2. GET /api/system/status should return 200 system telemetry', async () => {
    const res = await request(app).get('/api/system/status');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data).toHaveProperty('system');
    expect(res.body.data).toHaveProperty('databases');
  });

  // Test 3: POST /api/users/sync - Unauthenticated Request (401)
  test('3. POST /api/users/sync without Bearer token should return 401 Unauthorized', async () => {
    const res = await request(app)
      .post('/api/users/sync')
      .send({});
    expect(res.statusCode).toEqual(401);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body.message).toMatch(/unauthorized/i);
  });

  // Test 4: POST /api/users/sync - Authenticated Request Validation (400)
  test('4. POST /api/users/sync with Bearer token but invalid body should return 400 validation error', async () => {
    const res = await request(app)
      .post('/api/users/sync')
      .set('Authorization', 'Bearer valid-test-token-123')
      .send({});
    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('success', false);
  });

  // Test 5: GET /api/users/profile - Authenticated Access Failure (401)
  test('5. GET /api/users/profile without Bearer token should return 401 Unauthorized', async () => {
    const res = await request(app).get('/api/users/profile');
    expect(res.statusCode).toEqual(401);
    expect(res.body).toHaveProperty('success', false);
  });

  // Test 6: GET /api/trends/home - Public Trends Feed (200)
  test('6. GET /api/trends/home should return 200 with data array', async () => {
    const res = await request(app).get('/api/trends/home');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('success', true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  // Test 7: GET /api/trends/search - Public Search with Query (200)
  test('7. GET /api/trends/search?q=AI should return 200 search results', async () => {
    const res = await request(app).get('/api/trends/search?q=AI');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('data');
  });

  // Test 8: POST /api/ai/chat - Unauthenticated AI Chat (401)
  test('8. POST /api/ai/chat without Bearer token should return 401 Unauthorized', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .send({ message: 'Hello AI' });
    expect(res.statusCode).toEqual(401);
    expect(res.body).toHaveProperty('success', false);
  });

  // Test 9: POST /api/ai/chat - Authenticated AI Chat Validation (400)
  test('9. POST /api/ai/chat with Bearer token but empty body should return 400 validation error', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', 'Bearer valid-test-token-123')
      .send({});
    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('success', false);
  });

  // Test 10: GET /admin/queues - Protection test for unauthorized admin access (401)
  test('10. GET /admin/queues without admin token should return 401 Unauthorized', async () => {
    const res = await request(app).get('/admin/queues');
    expect(res.statusCode).toEqual(401);
    expect(res.body).toHaveProperty('success', false);
  });

});
