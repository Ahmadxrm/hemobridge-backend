-- Migration: 016_create_low_stock_alerts.sql
-- Deduplication tracker for low-stock alerts to avoid spam

CREATE TABLE IF NOT EXISTS low_stock_alerts (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  blood_type        VARCHAR(5)  NOT NULL,
  current_quantity  INTEGER     NOT NULL,
  threshold         INTEGER     NOT NULL,
  alerted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at       TIMESTAMPTZ,
  is_resolved       BOOLEAN     NOT NULL DEFAULT FALSE,
  notification_sent BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (organization_id, blood_type, is_resolved)
);

CREATE INDEX idx_low_stock_org           ON low_stock_alerts (organization_id);
CREATE INDEX idx_low_stock_resolved      ON low_stock_alerts (is_resolved);
CREATE INDEX idx_low_stock_alerted       ON low_stock_alerts (alerted_at DESC);

-- System configuration key-value store
CREATE TABLE IF NOT EXISTS system_settings (
  key         VARCHAR(100)  PRIMARY KEY,
  value       TEXT          NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_by  UUID          REFERENCES users(id)
);
