-- db/migrations/0004_create_venues.sql
-- Migration: introduce minimal venues table (Story 1.3)

CREATE TABLE IF NOT EXISTS venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Stable listing support (ORDER BY lower(name))
CREATE INDEX IF NOT EXISTS idx_venues_name_lower ON venues (lower(name));
CREATE INDEX IF NOT EXISTS idx_venues_city_lower ON venues (lower(city));

-- Optional FK: opportunities.venue_id -> venues.id
DO $$
BEGIN
  -- Idempotent check: avoid adding a duplicate FK even if it already exists with a different name.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace
    JOIN pg_attribute a ON a.attrelid = rel.oid
    WHERE c.contype = 'f'
      AND n.nspname = 'public'
      AND rel.relname = 'opportunities'
      AND a.attname = 'venue_id'
      AND a.attnum = ANY (c.conkey)
      AND c.confrelid = 'public.venues'::regclass
  ) THEN
    ALTER TABLE public.opportunities
      ADD CONSTRAINT fk_opportunities_venue_id
      FOREIGN KEY (venue_id)
      REFERENCES public.venues(id)
      ON DELETE SET NULL;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to keep updated_at current if set_updated_at_column() exists in DB
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at_column'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at_venues'
    ) THEN
      CREATE TRIGGER trg_set_updated_at_venues
      BEFORE UPDATE ON venues
      FOR EACH ROW EXECUTE PROCEDURE set_updated_at_column();
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Migration done.
