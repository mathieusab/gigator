-- db/migrations/0007_create_activity_log.sql
-- Migration: create activity_log for opportunity events + non-email interactions (Story 2.3)

-- Ensure UUID generator is available when running migrations on a fresh Postgres.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  actor_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Primary access pattern: timeline per opportunity.
CREATE INDEX IF NOT EXISTS idx_activity_log_opportunity_occurred_at_desc
  ON activity_log (opportunity_id, occurred_at DESC);

-- Secondary access pattern: time-ordered events per type.
CREATE INDEX IF NOT EXISTS idx_activity_log_action_type_occurred_at_desc
  ON activity_log (action_type, occurred_at DESC);

-- Migration done.
