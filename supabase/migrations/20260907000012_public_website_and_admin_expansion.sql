-- 20260907000012_public_website_and_admin_expansion.sql

-- Expand global_settings for public pages, downloads, and map
ALTER TABLE public.global_settings
ADD COLUMN IF NOT EXISTS privacy_policy_html TEXT,
ADD COLUMN IF NOT EXISTS terms_html TEXT,
ADD COLUMN IF NOT EXISTS faq_json JSONB,
ADD COLUMN IF NOT EXISTS about_mission_html TEXT,
ADD COLUMN IF NOT EXISTS about_who_uses_html TEXT,
ADD COLUMN IF NOT EXISTS download_mac_url TEXT,
ADD COLUMN IF NOT EXISTS download_mac_version TEXT,
ADD COLUMN IF NOT EXISTS download_ios_url TEXT,
ADD COLUMN IF NOT EXISTS download_ios_version TEXT,
ADD COLUMN IF NOT EXISTS download_android_url TEXT,
ADD COLUMN IF NOT EXISTS download_android_version TEXT,
ADD COLUMN IF NOT EXISTS download_windows_url TEXT,
ADD COLUMN IF NOT EXISTS download_windows_version TEXT,
ADD COLUMN IF NOT EXISTS download_current_version TEXT,
ADD COLUMN IF NOT EXISTS download_release_notes TEXT,
ADD COLUMN IF NOT EXISTS map_provider TEXT DEFAULT 'openstreetmap',
ADD COLUMN IF NOT EXISTS map_default_center_lat NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS map_default_center_lng NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS map_default_zoom NUMERIC DEFAULT 2,
ADD COLUMN IF NOT EXISTS map_style_light TEXT,
ADD COLUMN IF NOT EXISTS map_style_dark TEXT,
ADD COLUMN IF NOT EXISTS map_pin_visibility JSONB;

-- Create feedback table
CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    contact_info TEXT,
    status TEXT DEFAULT 'new'
);

-- Enable RLS on feedback
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Anyone can insert feedback (public access)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'feedback' AND policyname = 'Anyone can insert feedback'
    ) THEN
        CREATE POLICY "Anyone can insert feedback" ON public.feedback
            FOR INSERT
            TO public, anon, authenticated
            WITH CHECK (true);
    END IF;
END $$;

-- Only master_admin can view/update feedback
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'feedback' AND policyname = 'Master Admin can select feedback'
    ) THEN
        CREATE POLICY "Master Admin can select feedback" ON public.feedback
            FOR SELECT
            USING (public.get_effective_actor_role() = 'master_admin');
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'feedback' AND policyname = 'Master Admin can update feedback'
    ) THEN
        CREATE POLICY "Master Admin can update feedback" ON public.feedback
            FOR UPDATE
            USING (public.get_effective_actor_role() = 'master_admin')
            WITH CHECK (public.get_effective_actor_role() = 'master_admin');
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'feedback' AND policyname = 'Master Admin can delete feedback'
    ) THEN
        CREATE POLICY "Master Admin can delete feedback" ON public.feedback
            FOR DELETE
            USING (public.get_effective_actor_role() = 'master_admin');
    END IF;
END $$;
