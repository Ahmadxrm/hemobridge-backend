-- Migration: 003_create_organizations.sql
-- Organizations table for hospitals and blood banks

CREATE TYPE org_status AS ENUM (
  'PENDING_VERIFICATION',
  'VERIFIED',
  'REJECTED',
  'SUSPENDED'
);

CREATE TYPE ownership_type AS ENUM (
  'GOVERNMENT',
  'PRIVATE',
  'FAITH_BASED',
  'NGO',
  'OTHER'
);

CREATE TABLE IF NOT EXISTS organizations (
  id                      UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID          NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name                    VARCHAR(255)  NOT NULL,
  registration_number     VARCHAR(100)  UNIQUE,
  address                 TEXT          NOT NULL,
  city                    VARCHAR(100),
  state                   VARCHAR(100)  NOT NULL,
  lga                     VARCHAR(100),
  country                 VARCHAR(100)  NOT NULL DEFAULT 'Nigeria',

  -- PostGIS geography point (lng, lat)
  location                GEOGRAPHY(POINT, 4326),

  phone                   VARCHAR(30)   NOT NULL,
  email                   VARCHAR(255)  NOT NULL,
  website                 VARCHAR(255),

  organization_type       VARCHAR(50)   NOT NULL, -- matches role: HOSPITAL | BLOOD_BANK
  hospital_type           VARCHAR(50),            -- GENERAL, SPECIALIST, TEACHING, etc.
  ownership_type          ownership_type,

  -- Representative contact
  representative_name     VARCHAR(255),
  representative_email    VARCHAR(255),
  representative_phone    VARCHAR(30),

  -- Verification
  status                  org_status    NOT NULL DEFAULT 'PENDING_VERIFICATION',
  verification_notes      TEXT,
  verified_at             TIMESTAMPTZ,
  verified_by             UUID          REFERENCES users(id),
  rejection_reason        TEXT,
  suspended_reason        TEXT,

  -- Document/licence (URL or path stored externally)
  licence_document_url    TEXT,

  -- Low-stock configuration
  low_stock_threshold     INTEGER       NOT NULL DEFAULT 5
    CHECK (low_stock_threshold >= 0),

  -- Operating status
  operating_status        VARCHAR(50)   DEFAULT 'OPERATIONAL',

  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_organizations_user_id  ON organizations (user_id);
CREATE INDEX idx_organizations_status   ON organizations (status);
CREATE INDEX idx_organizations_state    ON organizations (state);
CREATE INDEX idx_organizations_location ON organizations USING GIST (location);
