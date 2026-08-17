-- Migration: 015_create_sessions.sql
-- JWT session blacklist for logout invalidation

CREATE TABLE IF NOT EXISTS sessions (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jti             VARCHAR(255) NOT NULL UNIQUE,   -- JWT ID claim
  expires_at      TIMESTAMPTZ  NOT NULL,
  invalidated_at  TIMESTAMPTZ,
  is_valid        BOOLEAN      NOT NULL DEFAULT TRUE,
  ip_address      VARCHAR(45),
  user_agent      TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_jti      ON sessions (jti);
CREATE INDEX idx_sessions_user_id  ON sessions (user_id);
CREATE INDEX idx_sessions_valid    ON sessions (is_valid, expires_at);
