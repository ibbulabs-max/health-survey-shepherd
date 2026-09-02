-- Migration: Add completed_at and completed_by to follow_ups if not already present
-- 
-- Background: The 10_remote_bootstrap.sql script was supposed to add these columns
-- but it was not applied to the live database. This migration safely adds them.
-- The application code uses completed_at to track when a follow-up was closed.
--
-- Safe to re-run (idempotent).

ALTER TABLE public.follow_ups
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS anchor_date DATE;

-- Reload PostgREST schema cache so the new columns are immediately accessible
NOTIFY pgrst, 'reload schema';
