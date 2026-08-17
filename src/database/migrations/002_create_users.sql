-- Migration: 002_create_users.sql
-- Core users table — all platform actors have a user record

CREATE TYPE user_role AS ENUM ('ADMIN', 'HOSPITAL', 'BLOOD_BANK', 'DONOR');
CREATE TYPE user_status AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION');

CREATE TABLE IF NOT EXISTS users (
  id                    UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  email                 VARCHAR(255) NOT NULL UNIQUE,
  phone                 VARCHAR(30),
  password_hash         TEXT         NOT NULL,
  role                  user_role    NOT NULL,
  status                user_status  NOT NULL DEFAULT 'PENDING_VERIFICATION',
  email_verified        BOOLEAN      NOT NULL DEFAULT FALSE,
  phone_verified        BOOLEAN      NOT NULL DEFAULT FALSE,
  last_login_at         TIMESTAMPTZ,
  failed_login_attempts INTEGER      NOT NULL DEFAULT 0,
  locked_until          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email   ON users (email);
CREATE INDEX idx_users_role    ON users (role);
CREATE INDEX idx_users_status  ON users (status);
