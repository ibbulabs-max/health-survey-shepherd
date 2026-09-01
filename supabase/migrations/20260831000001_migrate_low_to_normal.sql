-- Migration: Rename internal 'low' risk levels to 'normal'

-- 1. Rename column in health_threshold_settings if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='health_threshold_settings' AND column_name='interval_low'
  ) THEN
    ALTER TABLE public.health_threshold_settings RENAME COLUMN interval_low TO interval_normal;
  END IF;
END $$;

-- 2. Update existing member assessments
UPDATE public.member_assessments 
SET risk_level = 'normal' 
WHERE risk_level = 'low';

-- 3. Update existing follow-ups
UPDATE public.follow_ups 
SET risk_level = 'normal' 
WHERE risk_level = 'low';

-- 4. In case the enum exists (though our inspection showed text/varchar fields, this is a safe measure)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'risk_level_enum') THEN
    ALTER TYPE risk_level_enum RENAME VALUE 'low' TO 'normal';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Ignore if enum rename fails or isn't an enum
END $$;
