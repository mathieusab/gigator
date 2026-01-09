-- db/migrations/0003_add_profiles_google_user_id.sql
-- Migration: add google_user_id to profiles for Google sign-in mapping

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS google_user_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_google_user_id ON profiles (google_user_id);

-- Migration done.
