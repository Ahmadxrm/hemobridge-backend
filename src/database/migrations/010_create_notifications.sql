-- Migration: 010_create_notifications.sql
-- Notification records for all channels

CREATE TYPE notification_channel AS ENUM ('SMS', 'WHATSAPP', 'EMAIL', 'VOICE', 'IN_APP');
CREATE TYPE notification_status  AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'RETRYING');

CREATE TABLE IF NOT EXISTS notifications (
  id              UUID                  PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID                  NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  channel         notification_channel  NOT NULL,
  status          notification_status   NOT NULL DEFAULT 'PENDING',

  -- Content
  subject         VARCHAR(255),
  body            TEXT                  NOT NULL,
  template_id     VARCHAR(100),
  template_data   JSONB,

  -- Recipient contact (snapshotted at time of send)
  recipient_phone VARCHAR(30),
  recipient_email VARCHAR(255),

  -- Context
  event_type      VARCHAR(100),
  entity_type     VARCHAR(50),
  entity_id       UUID,

  -- Delivery tracking
  provider        VARCHAR(50),
  provider_ref    VARCHAR(255),
  sent_at         TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  failed_at       TIMESTAMPTZ,
  failure_reason  TEXT,

  -- Retry management
  retry_count     INTEGER       NOT NULL DEFAULT 0,
  max_retries     INTEGER       NOT NULL DEFAULT 3,
  next_retry_at   TIMESTAMPTZ,

  -- Read tracking (in-app)
  read_at         TIMESTAMPTZ,

  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id    ON notifications (user_id);
CREATE INDEX idx_notifications_status     ON notifications (status);
CREATE INDEX idx_notifications_channel    ON notifications (channel);
CREATE INDEX idx_notifications_entity     ON notifications (entity_type, entity_id);
CREATE INDEX idx_notifications_unread     ON notifications (user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_retry      ON notifications (next_retry_at) WHERE status = 'RETRYING';

-- Notification preferences per user
CREATE TABLE IF NOT EXISTS notification_preferences (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  sms         BOOLEAN     NOT NULL DEFAULT TRUE,
  whatsapp    BOOLEAN     NOT NULL DEFAULT FALSE,
  email       BOOLEAN     NOT NULL DEFAULT TRUE,
  voice       BOOLEAN     NOT NULL DEFAULT FALSE,
  in_app      BOOLEAN     NOT NULL DEFAULT TRUE,

  -- Quiet hours (optional)
  quiet_start TIME,
  quiet_end   TIME,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_prefs_user ON notification_preferences (user_id);
