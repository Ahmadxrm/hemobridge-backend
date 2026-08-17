-- Migration: 004_create_donors.sql
-- Donor profiles linked to users

CREATE TYPE gender_type AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');

CREATE TABLE IF NOT EXISTS donors (
  id                            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                       UUID          NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  full_name                     VARCHAR(255)  NOT NULL,
  date_of_birth                 DATE,
  gender                        gender_type,

  blood_type                    VARCHAR(5)    NOT NULL
    CHECK (blood_type IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),

  -- Location
  address                       TEXT,
  lga                           VARCHAR(100),
  state                         VARCHAR(100),
  country                       VARCHAR(100)  NOT NULL DEFAULT 'Nigeria',
  location                      GEOGRAPHY(POINT, 4326),

  -- Availability
  is_available                  BOOLEAN       NOT NULL DEFAULT TRUE,
  last_donation_date            DATE,
  next_eligible_donation_date   DATE,

  -- Health context
  health_information            TEXT,

  -- Preferred notification channel
  preferred_channel             VARCHAR(20)   DEFAULT 'SMS',

  -- Privacy & consent
  consent_given                 BOOLEAN       NOT NULL DEFAULT FALSE,
  consent_given_at              TIMESTAMPTZ,
  data_sharing_consent          BOOLEAN       NOT NULL DEFAULT FALSE,

  created_at                    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_donors_user_id       ON donors (user_id);
CREATE INDEX idx_donors_blood_type    ON donors (blood_type);
CREATE INDEX idx_donors_is_available  ON donors (is_available);
CREATE INDEX idx_donors_state         ON donors (state);
CREATE INDEX idx_donors_location      ON donors USING GIST (location);
