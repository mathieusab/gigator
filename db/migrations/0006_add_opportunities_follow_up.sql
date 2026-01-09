-- db/migrations/0006_add_opportunities_follow_up.sql
-- Migration: add next_action + follow_up_due_date to opportunities (Story 2.2)

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS next_action TEXT;

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS follow_up_due_date DATE;

-- Support follow-up due/overdue listing.
CREATE INDEX IF NOT EXISTS idx_opportunities_follow_up_due_date ON opportunities (follow_up_due_date);

-- Migration done.
