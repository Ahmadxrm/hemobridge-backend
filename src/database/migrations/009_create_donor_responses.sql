-- Migration: 009_create_donor_responses.sql
-- Individual donor accept/decline responses to donation requests

CREATE TYPE donor_response_status AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'COMPLETED');

CREATE TABLE IF NOT EXISTS donor_responses (
  id                    UUID                  PRIMARY KEY DEFAULT uuid_generate_v4(),
  donation_request_id   UUID                  NOT NULL REFERENCES donation_requests(id) ON DELETE CASCADE,
  donor_id              UUID                  NOT NULL REFERENCES donors(id) ON DELETE CASCADE,

  status                donor_response_status NOT NULL DEFAULT 'PENDING',

  -- Response details
  message               TEXT,
  decline_reason        TEXT,

  -- Scheduling
  available_date        DATE,
  available_time        VARCHAR(50),

  responded_at          TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,

  created_at            TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ           NOT NULL DEFAULT NOW(),

  UNIQUE (donation_request_id, donor_id)
);

CREATE INDEX idx_donor_responses_donation_req ON donor_responses (donation_request_id);
CREATE INDEX idx_donor_responses_donor        ON donor_responses (donor_id);
CREATE INDEX idx_donor_responses_status       ON donor_responses (status);
