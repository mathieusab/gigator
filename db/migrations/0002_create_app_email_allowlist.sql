-- db/migrations/0002_create_app_email_allowlist.sql
-- Migration: create allowlist table for app login authorization

CREATE TABLE IF NOT EXISTS app_email_allowlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_app_email_allowlist_email ON app_email_allowlist (email);

-- Case-insensitive lookup support for queries using lower(email)
CREATE INDEX IF NOT EXISTS idx_app_email_allowlist_email_lower ON app_email_allowlist (lower(email));

-- Attach trigger to keep updated_at current if set_updated_at_column() exists in DB
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at_column'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at_app_email_allowlist'
    ) THEN
      CREATE TRIGGER trg_set_updated_at_app_email_allowlist
      BEFORE UPDATE ON app_email_allowlist
      FOR EACH ROW EXECUTE PROCEDURE set_updated_at_column();
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Migration done.
