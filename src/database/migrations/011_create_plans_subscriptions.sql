-- Migration: 011_create_plans_subscriptions.sql
-- Pricing plans and organization subscriptions

CREATE TYPE subscription_status AS ENUM (
  'TRIAL',
  'ACTIVE',
  'EXPIRED',
  'CANCELLED',
  'PAST_DUE'
);

CREATE TABLE IF NOT EXISTS plans (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(100)  NOT NULL UNIQUE,
  slug            VARCHAR(50)   NOT NULL UNIQUE,
  description     TEXT,
  price_kobo      BIGINT        NOT NULL DEFAULT 0, -- amount in kobo (1 NGN = 100 kobo)
  currency        VARCHAR(3)    NOT NULL DEFAULT 'NGN',
  billing_cycle   VARCHAR(20)   NOT NULL DEFAULT 'monthly',
  trial_days      INTEGER       NOT NULL DEFAULT 14,
  is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
  features        JSONB,
  display_order   INTEGER       NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id                UUID                PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID                NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  plan_id           UUID                NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,

  status            subscription_status NOT NULL DEFAULT 'TRIAL',

  -- Dates
  trial_starts_at   TIMESTAMPTZ,
  trial_ends_at     TIMESTAMPTZ,
  starts_at         TIMESTAMPTZ,
  ends_at           TIMESTAMPTZ,
  cancelled_at      TIMESTAMPTZ,

  -- Payment provider reference
  provider          VARCHAR(50)         DEFAULT 'paystack',
  provider_sub_id   VARCHAR(255),
  provider_plan_id  VARCHAR(255),

  -- Metadata
  notes             TEXT,

  created_at        TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_org      ON subscriptions (organization_id);
CREATE INDEX idx_subscriptions_status   ON subscriptions (status);
CREATE INDEX idx_subscriptions_ends_at  ON subscriptions (ends_at);
