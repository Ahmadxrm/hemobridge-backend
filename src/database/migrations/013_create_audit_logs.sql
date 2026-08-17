-- Migration: 013_create_audit_logs.sql
-- Immutable audit trail for all critical state-changing actions

CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id      UUID        REFERENCES users(id) ON DELETE SET NULL,
  actor_role    VARCHAR(20),
  action        VARCHAR(100) NOT NULL,
  entity_type   VARCHAR(50),
  entity_id     UUID,
  metadata      JSONB,
  ip_address    VARCHAR(45),
  user_agent    TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_actor       ON audit_logs (actor_id);
CREATE INDEX idx_audit_logs_action      ON audit_logs (action);
CREATE INDEX idx_audit_logs_entity      ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at  ON audit_logs (created_at DESC);
