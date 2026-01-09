-- db/migrations/0001_create_gmail_tokens.sql
-- Migration: create tables to store Google/Gmail OAuth account tokens and metadata
-- Intended for PoC: store tokens, basic account metadata, token expiry and scopes.
-- NOTE: For production, encrypt refresh_token at rest and restrict access via secrets manager.
--       Use least-privilege scopes (e.g., https://www.googleapis.com/auth/gmail.readonly for read-only).
--       Also implement token rotation and secure key management.

CREATE TABLE IF NOT EXISTS gmail_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  google_user_id TEXT,               -- sub / subject from Google's ID token (unique per Google account)
  email TEXT,                        -- primary email for the Google account
  display_name TEXT,
  access_token TEXT,                 -- short-lived access token (for PoC stored as text)
  refresh_token TEXT,                -- long-lived refresh token (MUST be encrypted in production)
  scope TEXT,                        -- space-separated list of granted scopes
  token_type TEXT,
  expires_at TIMESTAMPTZ,            -- access token expiry
  revoked BOOLEAN DEFAULT FALSE,     -- whether user revoked access (set via webhook or refresh failure)
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (google_user_id),
  UNIQUE (profile_id)
);

CREATE INDEX IF NOT EXISTS idx_gmail_accounts_profile_id ON gmail_accounts (profile_id);
CREATE INDEX IF NOT EXISTS idx_gmail_accounts_google_user_id ON gmail_accounts (google_user_id);

-- Small table to record import runs / status for PoC (can be expanded later)
CREATE TABLE IF NOT EXISTS gmail_import_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES gmail_accounts(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  completed_at TIMESTAMPTZ,
  status TEXT,                       -- e.g., 'running', 'completed', 'failed'
  details JSONB,                     -- diagnostic info (counts, errors)
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gmail_import_runs_account_id ON gmail_import_runs (account_id);

-- Attach trigger to keep updated_at current if set_updated_at_column() exists in DB
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at_column'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at_gmail_accounts'
    ) THEN
      CREATE TRIGGER trg_set_updated_at_gmail_accounts
      BEFORE UPDATE ON gmail_accounts
      FOR EACH ROW EXECUTE PROCEDURE set_updated_at_column();
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at_gmail_import_runs'
    ) THEN
      CREATE TRIGGER trg_set_updated_at_gmail_import_runs
      BEFORE UPDATE ON gmail_import_runs
      FOR EACH ROW EXECUTE PROCEDURE set_updated_at_column();
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Migration done.