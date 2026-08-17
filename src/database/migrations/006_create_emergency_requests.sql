-- Migration: 006_create_emergency_requests.sql
-- Emergency blood requests from hospitals/organisations

CREATE TYPE request_status AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'IN_TRANSIT',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE request_urgency AS ENUM ('ROUTINE', 'URGENT', 'CRITICAL');

CREATE TABLE IF NOT EXISTS emergency_requests (
  id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  requesting_org_id UUID          NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  fulfilling_org_id UUID          REFERENCES organizations(id) ON DELETE RESTRICT,

  blood_type        VARCHAR(5)    NOT NULL
    CHECK (blood_type IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),

  units_needed      INTEGER       NOT NULL CHECK (units_needed > 0),
  units_committed   INTEGER       NOT NULL DEFAULT 0 CHECK (units_committed >= 0),

  urgency           request_urgency NOT NULL DEFAULT 'URGENT',
  status            request_status  NOT NULL DEFAULT 'PENDING',

  -- Patient context (anonymised — no patient PII stored)
  patient_info      TEXT,

  -- Notes and communication
  notes             TEXT,
  rejection_reason  TEXT,
  response_notes    TEXT,

  -- Lifecycle timestamps
  responded_at      TIMESTAMPTZ,
  in_transit_at     TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  cancelled_at      TIMESTAMPTZ,

  -- Who actioned this
  responded_by      UUID          REFERENCES users(id),

  -- Inventory reservation (FK to blood_inventory unit reserved)
  reserved_inventory_id UUID      REFERENCES blood_inventory(id),

  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_requests_requesting_org  ON emergency_requests (requesting_org_id);
CREATE INDEX idx_requests_fulfilling_org  ON emergency_requests (fulfilling_org_id);
CREATE INDEX idx_requests_status          ON emergency_requests (status);
CREATE INDEX idx_requests_blood_type      ON emergency_requests (blood_type);
CREATE INDEX idx_requests_created_at      ON emergency_requests (created_at DESC);
