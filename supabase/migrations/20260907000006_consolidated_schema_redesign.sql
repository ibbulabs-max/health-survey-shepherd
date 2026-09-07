-- ==============================================================================
-- 1. POSTGIS DETECTION & MAP AREAS
-- ==============================================================================
-- We will enable PostGIS if it exists on the instance. If not, the application 
-- will fallback to Turf.js. But we will safely attempt to create it.
-- NOTE: Supabase typically requires extensions to be enabled in a specific way,
-- but standard IF NOT EXISTS is safe.
CREATE EXTENSION IF NOT EXISTS postgis SCHEMA public;

-- Ensure map_areas exists (in case 20260906 was not applied completely)
CREATE TABLE IF NOT EXISTS public.map_areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID NOT NULL REFERENCES auth.users(id),
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#3b82f6',
    geometry JSONB NOT NULL,
    assigned_chw_id UUID REFERENCES auth.users(id),
    organization_id UUID NOT NULL
);

-- STRICT INVARIANT: Area cannot be saved without an assigned CHW.
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'map_areas_chw_required'
  ) THEN
    ALTER TABLE public.map_areas ADD CONSTRAINT map_areas_chw_required CHECK (assigned_chw_id IS NOT NULL);
  END IF;
END $$;


-- ==============================================================================
-- 2. GLOBAL SETTINGS (SINGLETON)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.global_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    app_name TEXT DEFAULT 'Health Survey Shepherd',
    organization_name TEXT DEFAULT 'My Organization',
    tagline TEXT,
    
    primary_color TEXT DEFAULT '#2563eb',
    secondary_color TEXT DEFAULT '#475569',
    
    logo_url TEXT,
    favicon_url TEXT,
    splash_logo_url TEXT,
    
    login_background_url TEXT,
    login_welcome_message TEXT,
    
    contact_whatsapp_number TEXT,
    contact_label TEXT DEFAULT 'Contact',
    help_support_label TEXT DEFAULT 'Help & Support',
    
    privacy_policy_url TEXT,
    terms_conditions_url TEXT,
    faq_url TEXT,
    about_text TEXT,
    
    show_powered_by BOOLEAN DEFAULT true,
    powered_by_name TEXT DEFAULT 'Ibrahim Labs',
    powered_by_url TEXT,
    powered_by_logo_url TEXT,
    
    -- Ensure singleton pattern
    singleton_key BOOLEAN DEFAULT true UNIQUE CHECK (singleton_key)
);

-- Seed an initial row safely
INSERT INTO public.global_settings (singleton_key) 
VALUES (true)
ON CONFLICT (singleton_key) DO NOTHING;

ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view global settings" ON public.global_settings;
CREATE POLICY "Anyone can view global settings" ON public.global_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Only master_admin can modify global settings" ON public.global_settings;
CREATE POLICY "Only master_admin can modify global settings" ON public.global_settings
    FOR ALL USING ((SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = 'master_admin');


-- ==============================================================================
-- 3. SYSTEM ALERTS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.system_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    severity TEXT NOT NULL DEFAULT 'info',
    category TEXT NOT NULL,
    summary TEXT NOT NULL,
    details JSONB,
    read_by UUID[] DEFAULT '{}',
    resolved BOOLEAN DEFAULT false
);

ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins and master_admins can view system alerts" ON public.system_alerts;
CREATE POLICY "Admins and master_admins can view system alerts" ON public.system_alerts
    FOR SELECT USING ((SELECT role FROM public.user_roles WHERE user_id = auth.uid()) IN ('admin', 'master_admin'));

DROP POLICY IF EXISTS "Authenticated users can create system alerts" ON public.system_alerts;
CREATE POLICY "Authenticated users can create system alerts" ON public.system_alerts
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Master admins can update alerts" ON public.system_alerts;
CREATE POLICY "Master admins can update alerts" ON public.system_alerts
    FOR UPDATE USING ((SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = 'master_admin');


-- ==============================================================================
-- 4. MASTER ADMIN TEST MODE SESSIONS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.test_mode_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    master_admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    simulated_role TEXT NOT NULL,
    simulated_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '2 hours'),
    active BOOLEAN DEFAULT true
);

ALTER TABLE public.test_mode_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Master Admins can manage their test sessions" ON public.test_mode_sessions;
CREATE POLICY "Master Admins can manage their test sessions" ON public.test_mode_sessions
    FOR ALL USING (
        master_admin_id = auth.uid() AND 
        (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = 'master_admin'
    );


-- ==============================================================================
-- 5. ANALYTICS CUSTOMIZATION TABLES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.analytics_dashboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role_default TEXT, 
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.analytics_dashboard_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_id UUID NOT NULL REFERENCES public.analytics_dashboards(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    position_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.analytics_dashboard_widgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.analytics_dashboard_groups(id) ON DELETE CASCADE,
    widget_type TEXT NOT NULL,
    position_order INTEGER NOT NULL DEFAULT 0,
    width INTEGER DEFAULT 1,
    height INTEGER DEFAULT 1,
    config JSONB DEFAULT '{}'
);

ALTER TABLE public.analytics_dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_dashboard_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_dashboard_widgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read assigned or role dashboards" ON public.analytics_dashboards;
CREATE POLICY "Users can read assigned or role dashboards" ON public.analytics_dashboards
    FOR SELECT USING (
        user_id = auth.uid() OR 
        role_default = (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) OR
        (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = 'master_admin'
    );

DROP POLICY IF EXISTS "Manage dashboards" ON public.analytics_dashboards;
CREATE POLICY "Manage dashboards" ON public.analytics_dashboards
    FOR ALL USING (
        user_id = auth.uid() OR 
        (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = 'master_admin'
    );

DROP POLICY IF EXISTS "Read groups" ON public.analytics_dashboard_groups;
CREATE POLICY "Read groups" ON public.analytics_dashboard_groups
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.analytics_dashboards d 
            WHERE d.id = dashboard_id AND (
                d.user_id = auth.uid() OR 
                d.role_default = (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) OR
                (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = 'master_admin'
            )
        )
    );

DROP POLICY IF EXISTS "Manage groups" ON public.analytics_dashboard_groups;
CREATE POLICY "Manage groups" ON public.analytics_dashboard_groups
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.analytics_dashboards d 
            WHERE d.id = dashboard_id AND (
                d.user_id = auth.uid() OR 
                (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = 'master_admin'
            )
        )
    );

DROP POLICY IF EXISTS "Read widgets" ON public.analytics_dashboard_widgets;
CREATE POLICY "Read widgets" ON public.analytics_dashboard_widgets
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.analytics_dashboard_groups g
            JOIN public.analytics_dashboards d ON d.id = g.dashboard_id
            WHERE g.id = group_id AND (
                d.user_id = auth.uid() OR 
                d.role_default = (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) OR
                (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = 'master_admin'
            )
        )
    );

DROP POLICY IF EXISTS "Manage widgets" ON public.analytics_dashboard_widgets;
CREATE POLICY "Manage widgets" ON public.analytics_dashboard_widgets
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.analytics_dashboard_groups g
            JOIN public.analytics_dashboards d ON d.id = g.dashboard_id
            WHERE g.id = group_id AND (
                d.user_id = auth.uid() OR 
                (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = 'master_admin'
            )
        )
    );

-- ==============================================================================
-- 6. LOCATION PRIVACY SECURITY INVARIANT (PINS/LOCATION)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    gps_sharing_enabled BOOLEAN DEFAULT false,
    analytics_layout JSONB DEFAULT '[]'::jsonb
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View own settings" ON public.user_settings;
CREATE POLICY "View own settings" ON public.user_settings FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Manage own settings" ON public.user_settings;
CREATE POLICY "Manage own settings" ON public.user_settings FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Location Privacy Invariant" ON public.pins;
CREATE POLICY "Location Privacy Invariant" ON public.pins
    AS RESTRICTIVE FOR SELECT USING (
        (pin_type != 'live_location') OR 
        (
            EXISTS (
                SELECT 1 FROM public.user_settings us 
                WHERE us.user_id = pins.user_id AND us.gps_sharing_enabled = true
            )
        ) OR
        user_id = auth.uid()
    );
