-- Migration: 005_create_blood_inventory.sql
-- Blood inventory per organization

CREATE TABLE IF NOT EXISTS blood_inventory (
  id               UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  blood_type       VARCHAR(5)   NOT NULL
    CHECK (blood_type IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),

  quantity         INTEGER      NOT NULL DEFAULT 0
    CHECK (quantity >= 0),

  units_available  INTEGER      NOT NULL DEFAULT 0
    CHECK (units_available >= 0),

  -- Expiry management
  collection_date  DATE,
  expiry_date      DATE         NOT NULL,
  is_expired       BOOLEAN      NOT NULL DEFAULT FALSE,

  -- Status
  is_available     BOOLEAN      NOT NULL DEFAULT TRUE,

  -- Source metadata
  component_type   VARCHAR(50)  DEFAULT 'WHOLE_BLOOD',
  batch_number     VARCHAR(100),
  storage_location VARCHAR(100),

  -- Optimistic locking
  version          INTEGER      NOT NULL DEFAULT 0,

  notes            TEXT,

  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_blood_inventory_org           ON blood_inventory (organization_id);
CREATE INDEX idx_blood_inventory_type          ON blood_inventory (blood_type);
CREATE INDEX idx_blood_inventory_expiry        ON blood_inventory (expiry_date);
CREATE INDEX idx_blood_inventory_available     ON blood_inventory (is_available, is_expired);
CREATE INDEX idx_blood_inventory_org_type      ON blood_inventory (organization_id, blood_type);
