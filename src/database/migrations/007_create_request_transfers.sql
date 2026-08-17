-- Migration: 007_create_request_transfers.sql
-- Transfer/logistics details for in-transit blood requests

CREATE TABLE IF NOT EXISTS request_transfers (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id          UUID        NOT NULL UNIQUE REFERENCES emergency_requests(id) ON DELETE CASCADE,

  -- Courier details (optional)
  courier_name        VARCHAR(255),
  courier_phone       VARCHAR(30),
  vehicle_number      VARCHAR(50),
  tracking_reference  VARCHAR(100),

  -- Dispatch info
  dispatched_by       UUID        REFERENCES users(id),
  dispatched_at       TIMESTAMPTZ,
  estimated_arrival   TIMESTAMPTZ,

  -- Confirmation
  received_by         UUID        REFERENCES users(id),
  received_at         TIMESTAMPTZ,
  receive_notes       TEXT,

  notes               TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transfers_request_id ON request_transfers (request_id);
