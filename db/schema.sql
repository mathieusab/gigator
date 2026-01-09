-- db/schema.sql
-- Supabase / Postgres schema for Gigator (SaaS marketplace)
-- Creates enums, tables, constraints, and indexes.
-- Designed for Supabase (assumes auth.users exists)

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ENUMs
CREATE TYPE opportunity_status AS ENUM (
  'draft',
  'open',
  'negotiating',
  'booked',
  'cancelled',
  'declined',
  'archived'
);

CREATE TYPE booking_status AS ENUM (
  'pending',
  'confirmed',
  'cancelled',
  'completed',
  'refunded'
);

CREATE TYPE payment_status AS ENUM (
  'pending',
  'succeeded',
  'failed',
  'refunded'
);

CREATE TYPE member_role AS ENUM (
  'owner',
  'admin',
  'member'
);

CREATE TYPE message_direction AS ENUM (
  'inbound',
  'outbound'
);

-- Profiles
-- Use this table to store application profile data linked to Supabase auth.users
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_uid UUID UNIQUE, -- reference to auth.users.id (stored as uuid)
  google_user_id TEXT UNIQUE,
  email TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  website TEXT,
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles (email);

-- App email allowlist (MVP auth gate)
CREATE TABLE IF NOT EXISTS app_email_allowlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_app_email_allowlist_email ON app_email_allowlist (email);

-- Support case-insensitive lookups performed via lower(email)
CREATE INDEX IF NOT EXISTS idx_app_email_allowlist_email_lower ON app_email_allowlist (lower(email));

-- Organizations
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  metadata JSONB,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations (slug);

-- Organization members (many-to-many)
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role member_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members (organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members (user_id);

-- Venues (rooms directory) - minimal MVP
CREATE TABLE IF NOT EXISTS venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Support stable ordering and indexable lookups (ORDER BY lower(name))
CREATE INDEX IF NOT EXISTS idx_venues_name_lower ON venues (lower(name));
CREATE INDEX IF NOT EXISTS idx_venues_city_lower ON venues (lower(city));

-- Opportunities (gigs / listings)
CREATE TABLE IF NOT EXISTS opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT,
  description TEXT,
  status opportunity_status NOT NULL DEFAULT 'draft',
  date DATE, -- scheduled date if relevant
  location TEXT,
  venue_id UUID REFERENCES venues(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- who owns the listing
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  cachet_amount_cents BIGINT, -- store money as integer (cents)
  cachet_currency TEXT DEFAULT 'USD',
  metadata JSONB,
  related_thread_id UUID, -- reference to threads.id (email sync)
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_opportunities_owner ON opportunities (owner_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities (status);
CREATE INDEX IF NOT EXISTS idx_opportunities_date ON opportunities (date);
CREATE INDEX IF NOT EXISTS idx_opportunities_org ON opportunities (organization_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_title_trgm ON opportunities USING gin (to_tsvector('english', coalesce(title,'')));

-- Threads (email / conversation threads import)
CREATE TABLE IF NOT EXISTS threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_thread_id TEXT UNIQUE,
  subject TEXT,
  last_message_at TIMESTAMPTZ,
  raw_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_threads_gmail_thread_id ON threads (gmail_thread_id);

-- Messages (threaded messages)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES threads(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  direction message_direction DEFAULT 'inbound',
  message_id TEXT, -- provider-specific message id
  subject TEXT,
  body TEXT,
  raw_payload JSONB,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages (thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages (sender_id);

-- Bookings / Orders
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  buyer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  seller_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status booking_status NOT NULL DEFAULT 'pending',
  quantity INTEGER DEFAULT 1,
  total_amount_cents BIGINT NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bookings_opportunity ON bookings (opportunity_id);
CREATE INDEX IF NOT EXISTS idx_bookings_buyer ON bookings (buyer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings (status);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  provider TEXT, -- e.g., stripe
  provider_payment_id TEXT,
  amount_cents BIGINT NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  status payment_status NOT NULL DEFAULT 'pending',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments (booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_provider ON payments (provider);

-- Reviews
-- Reviews can target opportunities, bookings, users, etc. Use target_type/target_id for flexibility.
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  target_type TEXT NOT NULL, -- 'opportunity' | 'booking' | 'profile'
  target_id UUID NOT NULL,
  rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  comment TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON reviews (reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_target ON reviews (target_type, target_id);

-- Notifications (simple event notifications)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id);

-- Denormalized counters / materialized counters (example)
-- Add counters to profiles for quick lookups (can be kept in sync by triggers)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS opportunities_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bookings_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reviews_count INTEGER DEFAULT 0;

-- Example materialized view for searchable opportunities (optional)
-- (If you prefer, create a materialized view and refresh periodically)
-- CREATE MATERIALIZED VIEW mv_opportunities_search AS
-- SELECT id, title, to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '')) AS document
-- FROM opportunities;

-- Helper function to keep updated_at in sync
CREATE OR REPLACE FUNCTION set_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to common tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at_profiles'
  ) THEN
    CREATE TRIGGER trg_set_updated_at_profiles
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE PROCEDURE set_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at_organizations'
  ) THEN
    CREATE TRIGGER trg_set_updated_at_organizations
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE PROCEDURE set_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at_opportunities'
  ) THEN
    CREATE TRIGGER trg_set_updated_at_opportunities
    BEFORE UPDATE ON opportunities
    FOR EACH ROW EXECUTE PROCEDURE set_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at_bookings'
  ) THEN
    CREATE TRIGGER trg_set_updated_at_bookings
    BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE PROCEDURE set_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at_venues'
  ) THEN
    CREATE TRIGGER trg_set_updated_at_venues
    BEFORE UPDATE ON venues
    FOR EACH ROW EXECUTE PROCEDURE set_updated_at_column();
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Index recommendations for commonly queried JSONB keys (example)
-- CREATE INDEX idx_opportunities_metadata_gin ON opportunities USING gin (metadata);

-- Sample data constraints & notes
-- - Use gen_random_uuid() to generate UUIDs for application inserts if not using auth.users id.
-- - Profiles.auth_uid can store Supabase auth user's UUID to join auth.users -> profiles
-- - Money stored as integer cents to avoid floating point issues

-- Final: grant minimal privileges to public (Supabase uses RLS for fine-grained access).
-- Keep tables owned by postgres role used by Supabase (default behavior).