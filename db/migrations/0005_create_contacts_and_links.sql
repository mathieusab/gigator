-- db/migrations/0005_create_contacts_and_links.sql
-- Migration: introduce contacts + contact_venues (Story 1.4)

CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  instagram TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Stable listing support (ORDER BY lower(name))
CREATE INDEX IF NOT EXISTS idx_contacts_name_lower ON contacts (lower(name));

CREATE TABLE IF NOT EXISTS contact_venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (contact_id, venue_id)
);

CREATE INDEX IF NOT EXISTS idx_contact_venues_contact_id ON contact_venues (contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_venues_venue_id ON contact_venues (venue_id);

-- Attach trigger to keep updated_at current if set_updated_at_column() exists in DB
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at_column'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at_contacts'
    ) THEN
      CREATE TRIGGER trg_set_updated_at_contacts
      BEFORE UPDATE ON contacts
      FOR EACH ROW EXECUTE PROCEDURE set_updated_at_column();
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Migration done.
