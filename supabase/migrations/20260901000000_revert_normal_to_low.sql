-- Migration: Revert risk_level 'normal' back to 'low'
-- 
-- Background: A previous migration (20260831000001_migrate_low_to_normal.sql) incorrectly
-- renamed 'low' to 'normal' in the database. The Excel data contract uses LOW/MODERATE/HIGH
-- which must map to internal values low/moderate/high (not normal/moderate/high).
-- The UI displays low as "Normal" — this is a UI-only translation.
--
-- This migration safely reverts the damage.

-- 1. Revert member_assessments: normal -> low
UPDATE public.member_assessments 
SET risk_level = 'low' 
WHERE risk_level = 'normal';

-- 2. Revert follow_ups: normal -> low
UPDATE public.follow_ups 
SET risk_level = 'low' 
WHERE risk_level = 'normal';

-- 3. Rename interval column back if it was renamed (safe -- idempotent check)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='health_threshold_settings' AND column_name='interval_normal'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='health_threshold_settings' AND column_name='interval_low'
  ) THEN
    -- Keep column named interval_normal for backward compat with existing API surface.
    -- The application layer maps interval_normal -> low key in followUpIntervals.
    -- DO NOT rename here to avoid breaking existing settings reads.
    -- The code in useSettings.ts and settingsService.ts handles the mapping.
    NULL;
  END IF;
END $$;

-- 4. In case an enum exists (defensive)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'risk_level_enum') THEN
    BEGIN
      ALTER TYPE risk_level_enum RENAME VALUE 'normal' TO 'low';
    EXCEPTION
      WHEN invalid_parameter_value THEN
        -- 'normal' doesn't exist or 'low' already exists; ignore
        NULL;
      WHEN OTHERS THEN
        NULL;
    END;
  END IF;
END $$;
