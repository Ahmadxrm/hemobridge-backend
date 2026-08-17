-- Migration: 012_create_payments.sql
-- Payment transactions and webhook events

CREATE TYPE payment_status AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');

CREATE TABLE IF NOT EXISTS payments (
  id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     UUID            NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  subscription_id     UUID            REFERENCES subscriptions(id) ON DELETE SET NULL,
  plan_id             UUID            REFERENCES plans(id),

  amount_kobo         BIGINT          NOT NULL,
  currency            VARCHAR(3)      NOT NULL DEFAULT 'NGN',
  status              payment_status  NOT NULL DEFAULT 'PENDING',

  provider            VARCHAR(50)     NOT NULL DEFAULT 'paystack',
  provider_ref        VARCHAR(255)    UNIQUE,  -- provider transaction reference
  provider_response   JSONB,

  initiated_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ,
  failed_at           TIMESTAMPTZ,
  failure_reason      TEXT,

  metadata            JSONB,

  created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_org           ON payments (organization_id);
CREATE INDEX idx_payments_status        ON payments (status);
CREATE INDEX idx_payments_provider_ref  ON payments (provider_ref);
CREATE INDEX idx_payments_created_at    ON payments (created_at DESC);

-- Webhook event idempotency table
CREATE TABLE IF NOT EXISTS payment_events (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider        VARCHAR(50) NOT NULL,
  event_type      VARCHAR(100) NOT NULL,
  provider_ref    VARCHAR(255) NOT NULL,   -- provider event/transaction ID
  payload         JSONB        NOT NULL,
  processed       BOOLEAN      NOT NULL DEFAULT FALSE,
  processed_at    TIMESTAMPTZ,
  error_message   TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  UNIQUE (provider, provider_ref)
);

CREATE INDEX idx_payment_events_ref  ON payment_events (provider_ref);
CREATE INDEX idx_payment_events_proc ON payment_events (processed, created_at);
