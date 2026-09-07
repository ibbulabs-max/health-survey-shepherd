-- 20260907000011_reconciliation.sql
-- Safe Reconciliation Migration for Master Admin, Test Mode, and Global Settings

-- 1. Safely add 'master_admin' to app_role enum if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumtypid = 'public.app_role'::regtype 
      AND enumlabel = 'master_admin'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'master_admin';
  END IF;
END $$;

-- 2. Create global_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.global_settings (
    singleton_key BOOLEAN PRIMARY KEY DEFAULT true,
    CONSTRAINT global_settings_singleton CHECK (singleton_key = true),
    
    -- General
    app_name TEXT DEFAULT 'Health Survey Shepherd',
    organization_name TEXT DEFAULT 'Ibrahim Labs',
    tagline TEXT,
    default_language TEXT DEFAULT 'en',
    timezone TEXT DEFAULT 'UTC',
    date_format TEXT DEFAULT 'YYYY-MM-DD',
    
    -- Branding
    app_logo TEXT,
    favicon TEXT,
    splash_logo TEXT,
    login_logo TEXT,
    primary_color TEXT,
    secondary_color TEXT,
    accent_color TEXT,
    light_theme_branding JSONB DEFAULT '{}'::jsonb,
    dark_theme_branding JSONB DEFAULT '{}'::jsonb,
    
    -- Login Page
    desktop_light_background TEXT,
    desktop_dark_background TEXT,
    mobile_light_background TEXT,
    mobile_dark_background TEXT,
    login_background_position TEXT DEFAULT 'center',
    login_background_size TEXT DEFAULT 'cover',
    login_overlay_opacity INTEGER DEFAULT 40,
    login_glass_blur INTEGER DEFAULT 16,
    login_glass_opacity INTEGER DEFAULT 20,
    login_card_transparency INTEGER DEFAULT 80,
    login_welcome_heading TEXT DEFAULT 'Sign in',
    login_description TEXT DEFAULT 'Enter your assigned User ID and 6-digit security PIN.',
    login_show_feature_section BOOLEAN DEFAULT true,
    login_footer_version BOOLEAN DEFAULT true,
    
    -- Powered By
    login_show_powered_by BOOLEAN DEFAULT true,
    login_powered_by_name TEXT DEFAULT 'Ibrahim Labs',
    login_powered_by_logo TEXT,
    login_powered_by_tagline TEXT,
    login_powered_by_url TEXT DEFAULT 'https://ibrahimlabs.com',
    login_powered_by_style TEXT DEFAULT 'default',
    
    -- Contact & Support
    whatsapp_number TEXT,
    whatsapp_logo TEXT,
    contact_number TEXT,
    help_support_url TEXT,
    feedback_url TEXT,
    faq_url TEXT,
    contact_email TEXT,
    whatsapp_message TEXT DEFAULT 'Hello Support, I need assistance with the Health Survey application.',
    enable_support_links BOOLEAN DEFAULT true,
    
    -- Privacy
    privacy_policy_url TEXT,
    terms_url TEXT,
    about_url TEXT,
    data_privacy_notice TEXT,
    
    -- Map
    map_provider TEXT DEFAULT 'openstreetmap',
    map_default_center_lat NUMERIC DEFAULT 0,
    map_default_center_lng NUMERIC DEFAULT 0,
    map_default_zoom INTEGER DEFAULT 13,
    map_style_light TEXT,
    map_style_dark TEXT,
    
    -- Location & Privacy
    working_day_start TEXT DEFAULT '09:00',
    working_day_end TEXT DEFAULT '18:00',
    working_days TEXT[] DEFAULT '{"Monday","Tuesday","Wednesday","Thursday","Friday"}',
    grace_period_minutes INTEGER DEFAULT 15,
    working_hours_timezone TEXT DEFAULT 'UTC',
    working_hours_enabled BOOLEAN DEFAULT true,
    chw_location_sharing BOOLEAN DEFAULT true,
    location_retention_days INTEGER DEFAULT 30,
    
    -- Analytics
    analytics_layout JSONB DEFAULT '[]'::jsonb,
    
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert singleton default if table is empty
INSERT INTO public.global_settings (singleton_key)
SELECT true
WHERE NOT EXISTS (SELECT 1 FROM public.global_settings);

-- 3. Create test_mode_sessions table
CREATE TABLE IF NOT EXISTS public.test_mode_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    master_admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    simulated_role public.app_role NOT NULL,
    simulated_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ DEFAULT (now() + interval '24 hours')
);

-- 4. Effective Actor Functions
CREATE OR REPLACE FUNCTION public.get_effective_actor_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(
    (
      SELECT simulated_user_id 
      FROM public.test_mode_sessions 
      WHERE master_admin_id = auth.uid() 
        AND active = true 
        AND expires_at > now()
        AND (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = 'master_admin'
      LIMIT 1
    ),
    auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.get_effective_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(
    (
      SELECT simulated_role::text
      FROM public.test_mode_sessions 
      WHERE master_admin_id = auth.uid() 
        AND active = true 
        AND expires_at > now()
        AND (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = 'master_admin'
      LIMIT 1
    ),
    (SELECT role::text FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_effective_master_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$ SELECT public.get_effective_role() = 'master_admin'; $$;

CREATE OR REPLACE FUNCTION public.is_effective_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$ SELECT public.get_effective_role() IN ('admin', 'master_admin', 'super_admin'); $$;

CREATE OR REPLACE FUNCTION public.is_effective_supervisor() RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$ SELECT public.get_effective_role() IN ('supervisor', 'admin', 'master_admin', 'super_admin'); $$;

CREATE OR REPLACE FUNCTION public.is_effective_survey_user() RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$ SELECT public.get_effective_role() = 'survey_user'; $$;

-- 5. RLS Policies for global_settings and test_mode_sessions
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_mode_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read global_settings" ON public.global_settings;
CREATE POLICY "Public read global_settings" ON public.global_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Master admin update global_settings" ON public.global_settings;
CREATE POLICY "Master admin update global_settings" ON public.global_settings FOR UPDATE USING (
  public.is_effective_master_admin()
);

DROP POLICY IF EXISTS "Master admin manage test mode" ON public.test_mode_sessions;
CREATE POLICY "Master admin manage test mode" ON public.test_mode_sessions FOR ALL USING (
  master_admin_id = auth.uid()
);
