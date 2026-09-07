-- ==============================================================================
-- 1. EFFECTIVE ACTOR CONTEXT FUNCTIONS (Test Mode Security)
-- ==============================================================================

-- Safely get the effective actor ID for RLS policies
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

-- Safely get the effective role for RLS policies
CREATE OR REPLACE FUNCTION public.get_effective_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(
    (
      SELECT simulated_role 
      FROM public.test_mode_sessions 
      WHERE master_admin_id = auth.uid() 
        AND active = true 
        AND expires_at > now()
        AND (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = 'master_admin'
      LIMIT 1
    ),
    (SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1)
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

-- ==============================================================================
-- 2. UPDATE GLOBAL SETTINGS (WORKING AREA ALERTS)
-- ==============================================================================
ALTER TABLE public.global_settings 
ADD COLUMN IF NOT EXISTS working_day_start TEXT DEFAULT '09:00',
ADD COLUMN IF NOT EXISTS working_day_end TEXT DEFAULT '18:00',
ADD COLUMN IF NOT EXISTS working_days TEXT[] DEFAULT '{"Monday","Tuesday","Wednesday","Thursday","Friday"}',
ADD COLUMN IF NOT EXISTS grace_period_minutes INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS working_hours_timezone TEXT DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS working_hours_enabled BOOLEAN DEFAULT true;

-- Basic validations for Working Area config
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_working_day_start') THEN
    ALTER TABLE public.global_settings ADD CONSTRAINT valid_working_day_start CHECK (working_day_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_working_day_end') THEN
    ALTER TABLE public.global_settings ADD CONSTRAINT valid_working_day_end CHECK (working_day_end ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_grace_period') THEN
    ALTER TABLE public.global_settings ADD CONSTRAINT valid_grace_period CHECK (grace_period_minutes >= 0);
  END IF;
END $$;

-- ==============================================================================
-- 3. RE-ASSERT RLS POLICIES WITH EFFECTIVE ACTOR CONTEXT
-- ==============================================================================

DO $$ 
BEGIN

  -- HOUSES
  DROP POLICY IF EXISTS "Restrict house access by role" ON public.houses;
  CREATE POLICY "Restrict house access by role" ON public.houses FOR ALL USING (
    public.is_effective_admin()
    OR supervisor_id = public.get_effective_actor_id()
    OR assigned_csw_id = public.get_effective_actor_id()
    OR uploaded_by = public.get_effective_actor_id()
    OR created_by = public.get_effective_actor_id()
  );

  -- HOUSE MEMBERS
  DROP POLICY IF EXISTS "Restrict member access by role" ON public.house_members;
  CREATE POLICY "Restrict member access by role" ON public.house_members FOR ALL USING (
    public.is_effective_admin()
    OR EXISTS (
      SELECT 1 FROM public.houses h 
      WHERE h.id = house_members.house_uuid 
      AND (
        h.supervisor_id = public.get_effective_actor_id() OR h.assigned_csw_id = public.get_effective_actor_id() OR h.uploaded_by = public.get_effective_actor_id() OR h.created_by = public.get_effective_actor_id()
      )
    )
  );

  -- MEMBER ASSESSMENTS
  DROP POLICY IF EXISTS "Restrict assessment access by role" ON public.member_assessments;
  CREATE POLICY "Restrict assessment access by role" ON public.member_assessments FOR ALL USING (
    public.is_effective_admin()
    OR EXISTS (
      SELECT 1 FROM public.houses h 
      WHERE h.id = member_assessments.house_uuid 
      AND (
        h.supervisor_id = public.get_effective_actor_id() OR h.assigned_csw_id = public.get_effective_actor_id() OR h.uploaded_by = public.get_effective_actor_id() OR h.created_by = public.get_effective_actor_id()
      )
    )
  );

  -- FOLLOW UPS
  DROP POLICY IF EXISTS "Restrict follow_up access by role" ON public.follow_ups;
  CREATE POLICY "Restrict follow_up access by role" ON public.follow_ups FOR ALL USING (
    public.is_effective_admin()
    OR EXISTS (
      SELECT 1 FROM public.house_members m
      JOIN public.houses h ON m.house_uuid = h.id
      WHERE m.id = follow_ups.member_uuid
      AND (
        h.supervisor_id = public.get_effective_actor_id() OR h.assigned_csw_id = public.get_effective_actor_id() OR h.uploaded_by = public.get_effective_actor_id() OR h.created_by = public.get_effective_actor_id()
      )
    )
  );

  -- TASKS
  DROP POLICY IF EXISTS "Restrict tasks access by role" ON public.tasks;
  CREATE POLICY "Restrict tasks access by role" ON public.tasks FOR ALL USING (
    public.is_effective_admin()
    OR assigned_to = public.get_effective_actor_id()
    OR created_by = public.get_effective_actor_id()
  );

  -- MAP AREAS
  DROP POLICY IF EXISTS "View map areas" ON public.map_areas;
  CREATE POLICY "View map areas" ON public.map_areas FOR SELECT USING (
    public.is_effective_admin()
    OR assigned_chw_id = public.get_effective_actor_id()
    OR created_by = public.get_effective_actor_id()
  );
  
  DROP POLICY IF EXISTS "Insert map areas" ON public.map_areas;
  CREATE POLICY "Insert map areas" ON public.map_areas FOR INSERT WITH CHECK (
    public.is_effective_admin()
  );

  DROP POLICY IF EXISTS "Update map areas" ON public.map_areas;
  CREATE POLICY "Update map areas" ON public.map_areas FOR UPDATE USING (
    public.is_effective_admin()
  );

  -- GLOBAL SETTINGS
  DROP POLICY IF EXISTS "Only master_admin can modify global settings" ON public.global_settings;
  CREATE POLICY "Only master_admin can modify global settings" ON public.global_settings
    FOR ALL USING (public.is_effective_master_admin());

  -- SYSTEM ALERTS
  DROP POLICY IF EXISTS "Admins and master_admins can view system alerts" ON public.system_alerts;
  CREATE POLICY "Admins and master_admins can view system alerts" ON public.system_alerts
    FOR SELECT USING (public.is_effective_admin());

  DROP POLICY IF EXISTS "Master admins can update alerts" ON public.system_alerts;
  CREATE POLICY "Master admins can update alerts" ON public.system_alerts
    FOR UPDATE USING (public.is_effective_master_admin());

  -- ANALYTICS DASHBOARDS
  DROP POLICY IF EXISTS "Users can read assigned or role dashboards" ON public.analytics_dashboards;
  CREATE POLICY "Users can read assigned or role dashboards" ON public.analytics_dashboards
      FOR SELECT USING (
          user_id = public.get_effective_actor_id() OR 
          role_default = public.get_effective_role() OR
          public.is_effective_master_admin()
      );

  DROP POLICY IF EXISTS "Manage dashboards" ON public.analytics_dashboards;
  CREATE POLICY "Manage dashboards" ON public.analytics_dashboards
      FOR ALL USING (
          user_id = public.get_effective_actor_id() OR 
          public.is_effective_master_admin()
      );

  DROP POLICY IF EXISTS "Read groups" ON public.analytics_dashboard_groups;
  CREATE POLICY "Read groups" ON public.analytics_dashboard_groups
      FOR SELECT USING (
          EXISTS (
              SELECT 1 FROM public.analytics_dashboards d 
              WHERE d.id = dashboard_id AND (
                  d.user_id = public.get_effective_actor_id() OR 
                  d.role_default = public.get_effective_role() OR
                  public.is_effective_master_admin()
              )
          )
      );

  DROP POLICY IF EXISTS "Manage groups" ON public.analytics_dashboard_groups;
  CREATE POLICY "Manage groups" ON public.analytics_dashboard_groups
      FOR ALL USING (
          EXISTS (
              SELECT 1 FROM public.analytics_dashboards d 
              WHERE d.id = dashboard_id AND (
                  d.user_id = public.get_effective_actor_id() OR 
                  public.is_effective_master_admin()
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
                  d.user_id = public.get_effective_actor_id() OR 
                  d.role_default = public.get_effective_role() OR
                  public.is_effective_master_admin()
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
                  d.user_id = public.get_effective_actor_id() OR 
                  public.is_effective_master_admin()
              )
          )
      );

  -- PINS (LOCATION PRIVACY INVARIANT)
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
          user_id = public.get_effective_actor_id()
      );
  
  -- NEW: Block Inserts/Updates of live location if gps sharing is OFF
  DROP POLICY IF EXISTS "Location Privacy Block Insert/Update" ON public.pins;
  CREATE POLICY "Location Privacy Block Insert/Update" ON public.pins
      AS RESTRICTIVE FOR ALL USING (
          (pin_type != 'live_location') OR 
          (
              EXISTS (
                  SELECT 1 FROM public.user_settings us 
                  WHERE us.user_id = public.get_effective_actor_id() AND us.gps_sharing_enabled = true
              )
          )
      );

END $$;
