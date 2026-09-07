-- 20260907000010_master_admin_deep_config.sql

-- 1. Safely Add 'master_admin' to app_role enum if it does not exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumtypid = 'public.app_role'::regtype 
      AND enumlabel = 'master_admin'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'master_admin';
  END IF;
END
$$;

-- 2. Add advanced Login Page configuration to global_settings
ALTER TABLE public.global_settings
ADD COLUMN IF NOT EXISTS desktop_light_background TEXT,
ADD COLUMN IF NOT EXISTS desktop_dark_background TEXT,
ADD COLUMN IF NOT EXISTS mobile_light_background TEXT,
ADD COLUMN IF NOT EXISTS mobile_dark_background TEXT,
ADD COLUMN IF NOT EXISTS desktop_overlay_opacity TEXT DEFAULT '40',
ADD COLUMN IF NOT EXISTS desktop_blur TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS desktop_glass_effect BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS mobile_overlay_opacity TEXT DEFAULT '40',
ADD COLUMN IF NOT EXISTS mobile_blur TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS mobile_glass_effect BOOLEAN DEFAULT true;
