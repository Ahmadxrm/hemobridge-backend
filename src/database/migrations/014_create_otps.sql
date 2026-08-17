-- Migration: 014_create_otps.sql
-- OTP records with purpose tracking and hashed storage

CREATE TYPE otp_purpose AS ENUM (
  'EMAIL_VERIFICATION',
  'PHONE_VERIFICATION',
  'PASSWORD_RESET',
  'LOGIN_2FA'
);

CREATE TABLE IF NOT EXISTS otps (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose       otp_purpose NOT NULL,

  -- OTP is stored hashed — never plaintext
  otp_hash      TEXT        NOT NULL,

  -- Contact used for this OTP
  contact       VARCHAR(255) NOT NULL,  -- email or phone

  expires_at    TIMESTAMPTZ  NOT NULL,
  verified_at   TIMESTAMPTZ,
  attempts      INTEGER      NOT NULL DEFAULT 0,
  is_used       BOOLEAN      NOT NULL DEFAULT FALSE,

  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_otps_user_purpose  ON otps (user_id, purpose);
CREATE INDEX idx_otps_expires_at    ON otps (expires_at);
CREATE INDEX idx_otps_user_id       ON otps (user_id);

-- Password reset tokens (separate from OTPs — longer lived, single-use)
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    TEXT        NOT NULL UNIQUE,
  expires_at    TIMESTAMPTZ  NOT NULL,
  used_at       TIMESTAMPTZ,
  is_used       BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prt_user_id    ON password_reset_tokens (user_id);
CREATE INDEX idx_prt_token_hash ON password_reset_tokens (token_hash);
CREATE INDEX idx_prt_expires    ON password_reset_tokens (expires_at);
