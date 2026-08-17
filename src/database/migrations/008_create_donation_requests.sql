-- Migration: 008_create_donation_requests.sql
-- Voluntary donor mobilisation requests

CREATE TYPE donation_request_status AS ENUM ('OPEN', 'FULFILLED', 'CLOSED', 'CANCELLED');

CREATE TABLE IF NOT EXISTS donation_requests (
  id                  UUID                    PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     UUID                    NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,

  blood_type          VARCHAR(5)              NOT NULL
    CHECK (blood_type IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),

  units_needed        INTEGER                 NOT NULL CHECK (units_needed > 0),
  units_committed     INTEGER                 NOT NULL DEFAULT 0 CHECK (units_committed >= 0),

  -- Location for matching
  location            GEOGRAPHY(POINT, 4326),
  search_radius_km    NUMERIC(6,2)            NOT NULL DEFAULT 25.0,

  urgency             request_urgency         NOT NULL DEFAULT 'URGENT',
  status              donation_request_status NOT NULL DEFAULT 'OPEN',

  message             TEXT,
  notes               TEXT,

  -- Deadline
  expires_at          TIMESTAMPTZ,
  closed_at           TIMESTAMPTZ,
  closed_by           UUID                    REFERENCES users(id),

  created_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_donation_requests_org        ON donation_requests (organization_id);
CREATE INDEX idx_donation_requests_blood_type ON donation_requests (blood_type);
CREATE INDEX idx_donation_requests_status     ON donation_requests (status);
CREATE INDEX idx_donation_requests_location   ON donation_requests USING GIST (location);
CREATE INDEX idx_donation_requests_created    ON donation_requests (created_at DESC);
