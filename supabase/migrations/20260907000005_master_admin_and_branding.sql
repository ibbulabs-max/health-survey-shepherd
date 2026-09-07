-- 1. Global Settings Table for Branding & Config
CREATE TABLE IF NOT EXISTS public.global_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    app_name TEXT DEFAULT 'Health Survey Shepherd',
    tagline TEXT,
    primary_color TEXT DEFAULT '#2563eb',
    secondary_color TEXT DEFAULT '#475569',
    logo_url TEXT,
    favicon_url TEXT,
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
    powered_by_logo_url TEXT
);

-- Seed an initial row
INSERT INTO public.global_settings (app_name) 
SELECT 'Health Survey Shepherd'
WHERE NOT EXISTS (SELECT 1 FROM public.global_settings);

-- RLS for global_settings
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view global settings" ON public.global_settings
    FOR SELECT USING (true);

CREATE POLICY "Only master_admin can modify global settings" ON public.global_settings
    FOR ALL USING (
        (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = 'master_admin'
    );

-- 2. System Alerts Table for Master Admin Notifications
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

-- RLS for system_alerts
ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and master_admins can view system alerts" ON public.system_alerts
    FOR SELECT USING (
        (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) IN ('admin', 'master_admin')
    );

CREATE POLICY "Authenticated users can create system alerts (e.g. from edge functions/clients reporting failure)" ON public.system_alerts
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Master admins can update alerts" ON public.system_alerts
    FOR UPDATE USING (
        (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = 'master_admin'
    );

-- 3. Trigger to keep global_settings updated_at current
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER global_settings_updated_at
BEFORE UPDATE ON public.global_settings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4. Map Areas constraint (must have CHW assigned)
-- We will enforce this on the frontend and add a database check constraint.
-- Because existing data might be null, we only add check constraint if data allows or we update it.
-- For safety, we will just ensure it going forward via application logic, as adding a strict NOT NULL constraint on existing tables can break migrations if there's null data.
-- Actually, let's just make a safe CHECK constraint that applies only to new records or allows null if legacy?
-- We'll just enforce via RLS:
CREATE POLICY "Require assigned_chw_id on insert for map_areas" ON public.map_areas
    FOR INSERT WITH CHECK (
        assigned_chw_id IS NOT NULL AND
        (
            organization_id = (SELECT organization_id FROM user_roles WHERE user_id = auth.uid()) OR
            (SELECT role FROM user_roles WHERE user_id = auth.uid()) = 'master_admin'
        )
    );

-- Wait, the existing insert policy on map_areas doesn't have this check. We can drop and recreate it.
DROP POLICY IF EXISTS "Insert map areas" ON public.map_areas;
CREATE POLICY "Insert map areas" ON public.map_areas FOR INSERT WITH CHECK (
    assigned_chw_id IS NOT NULL AND
    (
        organization_id = (SELECT organization_id FROM user_roles WHERE user_id = auth.uid()) OR
        (SELECT role FROM user_roles WHERE user_id = auth.uid()) = 'master_admin'
    )
);

