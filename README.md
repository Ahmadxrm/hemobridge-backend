# HemoBridge Backend API

> Production-quality Phase 1 MVP backend for **HemoBridge** — a healthcare blood coordination platform connecting Hospitals, Blood Banks, Voluntary Donors, and Platform Administrators across Nigeria.

---

## Table of Contents

- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Setup](#environment-setup)
- [Database Setup](#database-setup)
- [Running the Server](#running-the-server)
- [API Overview](#api-overview)
- [External Integrations](#external-integrations)
- [Testing](#testing)
- [Deployment Notes](#deployment-notes)
- [Known Limitations](#known-limitations)

---

## Architecture

The backend is a **modular monolith** — single deployable unit with clean internal separation of concerns.

```
src/
├── config/             # DB pool, environment config
├── controllers/        # Thin HTTP handlers (call service, return response)
├── routes/             # Express routers with middleware chains
├── middleware/         # auth, rbac, validate, rateLimiter, errorHandler
├── services/           # Business logic layer
├── repositories/       # All database access (raw SQL with pg)
├── validators/         # Joi validation schemas
├── integrations/
│   ├── notifications/  # Central notification service
│   ├── sms/            # Termii adapter
│   ├── whatsapp/       # Meta WhatsApp adapter
│   ├── email/          # SendGrid adapter
│   ├── voice/          # Africa's Talking adapter
│   └── payments/       # Paystack adapter
├── jobs/               # node-cron background jobs
├── database/
│   ├── migrations/     # Numbered SQL migration files
│   └── seeds/          # Development seed data
├── utils/              # logger, errors, response, constants, helpers, crypto
├── app.js              # Express app setup
└── server.js           # HTTP server entry point + startup sequence
```

**Technology Stack:**
- Node.js 18+ / Express.js
- PostgreSQL + PostGIS (geographic search)
- JWT authentication with session blacklist
- Argon2id password/OTP hashing
- Joi validation
- Winston logging
- node-cron background jobs

---

## Prerequisites

- Node.js >= 18.0.0
- PostgreSQL >= 14 with PostGIS extension
- Git

### Installing PostGIS

```bash
# Ubuntu/Debian
sudo apt-get install postgresql-14-postgis-3

# macOS (Homebrew)
brew install postgis

# After installing, enable in PostgreSQL:
psql -U postgres -c "CREATE EXTENSION postgis;"
```

---

## Installation

```bash
cd hemobridge-backend
npm install
```

---

## Environment Setup

```bash
cp .env.example .env
```

Edit `.env` with your values. Key variables:

| Variable | Description |
|---|---|
| `DB_HOST/PORT/NAME/USER/PASSWORD` | PostgreSQL connection |
| `JWT_SECRET` | ≥32 character random string |
| `JWT_REFRESH_SECRET` | ≥32 character random string |
| `PAYSTACK_SECRET_KEY` | Paystack secret key |
| `PAYSTACK_WEBHOOK_SECRET` | Paystack webhook secret |
| `SENDGRID_API_KEY` | Email delivery |
| `TERMII_API_KEY` | SMS delivery |
| `WHATSAPP_ACCESS_TOKEN` | WhatsApp delivery |
| `AT_API_KEY` | Voice call delivery |

> **Development mode**: All external service keys can be left empty. The platform runs with mock adapters that log to the console instead of calling external APIs.

---

## Database Setup

### 1. Create the database

```sql
-- Connect as postgres superuser
CREATE DATABASE hemobridge_dev;
\c hemobridge_dev
CREATE EXTENSION postgis;
CREATE EXTENSION "uuid-ossp";
```

### 2. Run migrations

```bash
npm run migrate
```

Migrations are numbered SQL files in `src/database/migrations/`. They run in order and track applied migrations in the `schema_migrations` table.

### 3. Seed development data

```bash
npm run seed
```

This creates:
- Admin user: `admin@hemobridge.com` / `Admin@HemoBridge2025!`
- Demo Hospital: `hospital@demo.hemobridge.com` / `Hospital@Demo2025!`
- Demo Blood Bank: `bloodbank@demo.hemobridge.com` / `BloodBank@Demo2025!`
- Demo Donors: `donor1@demo.hemobridge.com` / `Donor@Demo2025!`
- Sample blood inventory and emergency requests

> ⚠️ **DEVELOPMENT ONLY** — Never use seed credentials in production.

---

## Running the Server

```bash
# Development (with hot reload)
npm run dev

# Production
npm start
```

Server starts on `http://localhost:5000` (or your configured `PORT`).

Health check: `GET http://localhost:5000/health`

---

## API Overview

All endpoints use the prefix: `/api/v1`

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/register/organization` | Public | Register a hospital or blood bank |
| POST | `/auth/register/donor` | Public | Register a blood donor |
| POST | `/auth/otp/send` | Public | Send OTP code |
| POST | `/auth/otp/verify` | Public | Verify OTP code |
| POST | `/auth/login` | Public | Login and receive JWT |
| POST | `/auth/logout` | JWT | Invalidate session |
| POST | `/auth/forgot-password` | Public | Request password reset |
| POST | `/auth/reset-password` | Public | Complete password reset |
| GET | `/auth/me` | JWT | Get current user profile |

### Inventory (Organisation only)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/inventory/units` | Org JWT | Add blood unit |
| GET | `/inventory/units` | Org JWT | List inventory |
| PATCH | `/inventory/units/:id` | Org JWT | Update unit |
| DELETE | `/inventory/units/:id` | Org JWT | Delete unit |
| GET | `/inventory/dashboard` | Org JWT | Inventory summary |

### Blood Search (Public)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/blood/search?type=O%2B&lat=6.45&lng=3.39&radius=50` | Public | Find blood by type + location |

### Emergency Requests

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/requests` | Org JWT | Create blood request |
| GET | `/requests` | JWT | List requests |
| GET | `/requests/:id` | JWT | Get request detail |
| PATCH | `/requests/:id/respond` | Org JWT | Approve or reject |
| PATCH | `/requests/:id/status` | Org JWT | Update status |
| POST | `/requests/:id/transfer-details` | Org JWT | Add transfer info |
| POST | `/requests/:id/confirm-received` | Org JWT | Confirm receipt |

### Donors

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/donors/:id` | JWT | Get donor profile |
| PATCH | `/donors/:id/profile` | Donor JWT | Update profile |
| PATCH | `/donors/:id/availability` | Donor JWT | Set availability |
| GET | `/donors/:id/history` | JWT | Donation history |

### Donation Requests

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/donation-requests` | Org JWT | Create donor mobilisation request |
| GET | `/donation-requests/:id` | JWT | Get request |
| GET | `/donation-requests/:id/matches` | Org JWT | Find matching donors |
| POST | `/donation-requests/:id/notify` | Org JWT | Notify matched donors |
| POST | `/donation-requests/:id/responses` | Donor JWT | Accept/decline |
| GET | `/donation-requests/:id/progress` | JWT | Response progress |
| PATCH | `/donation-requests/:id/close` | Org JWT | Close request |

### Notifications

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/notifications` | JWT | Get user notifications |
| POST | `/notifications/send` | Admin JWT | Internal send (admin only) |
| PATCH | `/users/:id/notification-preferences` | JWT | Update preferences |

### Subscriptions & Payments

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/plans` | Public | Get available plans |
| POST | `/subscriptions` | Org JWT | Subscribe to plan |
| PATCH | `/subscriptions/:id/renew` | Org JWT | Renew subscription |
| GET | `/organizations/:id/payments` | JWT | Payment history |
| POST | `/payments/webhook` | Paystack Sig | Payment webhook |

### Admin

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/admin/organizations` | Admin JWT | List organisations |
| POST | `/admin/organizations/:id/verify` | Admin JWT | Verify/reject/suspend org |
| PATCH | `/admin/users/:id/status` | Admin JWT | Change user status |
| GET | `/admin/system/status` | Admin JWT | System overview |
| GET | `/admin/audit-logs` | Admin JWT | Audit log query |

### Response Format

```json
// Success
{
  "status": "success",
  "code": 200,
  "message": "Operation completed successfully",
  "data": {},
  "meta": { "timestamp": "2025-01-01T00:00:00.000Z" }
}

// Error
{
  "status": "error",
  "code": 400,
  "error": {
    "type": "VALIDATION_ERROR",
    "message": "Validation failed: ...",
    "details": [{ "field": "email", "message": "..." }]
  },
  "meta": { "timestamp": "2025-01-01T00:00:00.000Z" }
}
```

---

## External Integrations

| Provider | Channel | Status | Config Needed |
|---|---|---|---|
| Termii | SMS | Mock in dev | `TERMII_API_KEY` |
| Meta WhatsApp Business API | WhatsApp | Mock in dev | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` |
| SendGrid | Email | Mock in dev | `SENDGRID_API_KEY` |
| Africa's Talking | Voice | Mock in dev | `AT_API_KEY`, `AT_USERNAME` |
| Paystack | Payments | Mock in dev | `PAYSTACK_SECRET_KEY`, `PAYSTACK_WEBHOOK_SECRET` |
| PostGIS | Geolocation | ✅ Local | No external key |

In development, when API keys are not configured, adapters log to `logger.warn` with `[MOCK]` prefix instead of calling external APIs. No silent failures.

---

## Testing

```bash
# Run all tests
npm test

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

Tests use Jest + Supertest and connect to the configured database. Set `DB_NAME=hemobridge_test` in your test environment.

Test suites:
- `tests/auth/auth.test.js` — Registration, OTP, login, RBAC
- `tests/inventory/inventory.test.js` — CRUD, ownership, negative stock
- `tests/blood/blood.test.js` — Geographic search, expiry exclusion
- `tests/requests/request.test.js` — Lifecycle state machine
- `tests/donors/donor.test.js` — Profile, availability, privacy
- `tests/payments/payment.test.js` — Webhook idempotency, signature

---

## Deployment Notes

### Environment
- Set `NODE_ENV=production`
- Provide all required secrets (never commit `.env`)
- Use a process manager (PM2, systemd, or container)

### Database
- Enable PostGIS on production PostgreSQL instance
- Run `npm run migrate` before starting
- Use a dedicated PostgreSQL user with least-privilege access

### Security Checklist
- [ ] Strong `JWT_SECRET` (≥32 random chars)
- [ ] Paystack webhook secret configured
- [ ] CORS origin restricted to your domain
- [ ] HTTPS/TLS in front of the API (nginx, Cloudflare, etc.)
- [ ] Rate limiting tuned for production load
- [ ] All external API keys configured

### Recommended Infrastructure
- API: Node.js on a Linux VM or container
- Database: Managed PostgreSQL with PostGIS (Supabase, AWS RDS, Render, Railway)
- Process Manager: PM2 or Docker
- Reverse Proxy: Nginx with SSL

---

## Known Limitations (Phase 1 MVP)

1. **No refresh token endpoint** — JWT access tokens expire in 15m. Frontend must re-login after expiry. Refresh token implementation is a Phase 2 item.
2. **No real-time WebSockets** — Request status changes are poll-based. Socket.IO can be added without architectural changes.
3. **Notification delivery** — External providers require credentials. Dev mode logs mock messages.
4. **File uploads** — Organisation licence documents are stored as URLs. File upload service (S3/Cloudinary) not implemented.
5. **Payment checkout** — Paystack checkout URL is returned; frontend must redirect. Full Paystack inline JS integration is a frontend concern.

---

## Git Commit History (Suggested)

```
feat: initial backend setup and project scaffold
feat: database schema — 20 tables with PostGIS
feat: authentication, OTP, RBAC, and JWT
feat: organisation verification workflow
feat: blood inventory CRUD with expiry logic
feat: PostGIS blood search
feat: emergency request lifecycle
feat: donor management and privacy controls
feat: donation requests and donor matching
feat: central notification service with 5 channels
feat: payments, subscriptions, and Paystack webhook
feat: background jobs — expiry, low-stock, retries
feat: admin module — audit logs, system status
feat: automated test suite
feat: seed data and README
```

---

*Built with ❤️ for HemoBridge — saving lives through better blood coordination.*
