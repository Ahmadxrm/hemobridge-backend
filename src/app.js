'use strict';

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const config = require('./config');
const logger = require('./utils/logger');
const { generalLimiter } = require('./middleware/rateLimiter');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// ── Route imports ──────────────────────────────────────────────────────────
const authRoutes         = require('./routes/auth.routes');
const inventoryRoutes    = require('./routes/inventory.routes');
const bloodRoutes        = require('./routes/blood.routes');
const requestRoutes      = require('./routes/request.routes');
const donorRoutes        = require('./routes/donor.routes');
const donationRoutes     = require('./routes/donation.routes');
const notificationRoutes = require('./routes/notification.routes');
const subscriptionRoutes = require('./routes/subscription.routes');
const adminRoutes        = require('./routes/admin.routes');

const app = express();

// ── Security headers ───────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ── CORS ───────────────────────────────────────────────────────────────────
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Paystack-Signature'],
}));

// ── Raw body capture for Paystack webhook signature verification ───────────
// Must come BEFORE express.json() for the webhook route only.
app.use('/api/v1/payments/webhook', (req, res, next) => {
  let data = '';
  req.setEncoding('utf8');
  req.on('data', (chunk) => {
    data += chunk;
  });
  req.on('end', () => {
    req.rawBody = data;
    try {
      req.body = JSON.parse(data);
    } catch {
      req.body = {};
    }
    next();
  });
});

// ── Body parsing ───────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── Request logging ────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
      ip: req.ip,
      userId: req.user?.id,
    });
  });
  next();
});

// ── General rate limiting ──────────────────────────────────────────────────
app.use(generalLimiter);

// ── Health check (unauthenticated, not rate limited heavily) ───────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'hemobridge-backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: config.env,
  });
});

// ── API Routes ─────────────────────────────────────────────────────────────
const API_PREFIX = '/api/v1';

app.use(`${API_PREFIX}/auth`,              authRoutes);
app.use(`${API_PREFIX}/inventory`,         inventoryRoutes);
app.use(`${API_PREFIX}/blood`,             bloodRoutes);
app.use(`${API_PREFIX}/requests`,          requestRoutes);
app.use(`${API_PREFIX}/donors`,            donorRoutes);
app.use(`${API_PREFIX}/donation-requests`, donationRoutes);
app.use(`${API_PREFIX}/notifications`,     notificationRoutes);
app.use(`${API_PREFIX}/plans`,             subscriptionRoutes);   // GET /plans
app.use(`${API_PREFIX}/subscriptions`,     subscriptionRoutes);   // POST /subscriptions
app.use(`${API_PREFIX}/organizations`,     subscriptionRoutes);   // GET /organizations/:id/payments
app.use(`${API_PREFIX}/payments`,          subscriptionRoutes);   // POST /payments/webhook
app.use(`${API_PREFIX}/admin`,             adminRoutes);

// Also mount notification-preferences under /users (legacy path)
app.use(`${API_PREFIX}/users`,             notificationRoutes);

// ── 404 handler ────────────────────────────────────────────────────────────
app.use(notFoundHandler);

// ── Central error handler (MUST be last) ──────────────────────────────────
app.use(errorHandler);

module.exports = app;
