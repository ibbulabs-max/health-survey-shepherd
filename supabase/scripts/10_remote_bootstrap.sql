-- ============================================================
-- CONSOLIDATED REMOTE BOOTSTRAP (idempotent, safe to re-run)
-- Run this once against the live Supabase project (SQL Editor).
-- Brings the database up to the schema the app needs:
--   * public.health_threshold_settings (App Rules storage) + audit table
--   * public.holidays
--   * public.tasks
--   * follow_ups.completed_at / completed_by / anchor_date
--   * Data-API GRANTs + RLS policies
-- Nothing is dropped; no existing rows are modified.
-- ============================================================

-- ---------- 1. APP RULES (health_threshold_settings) ----------
CREATE TABLE IF NOT EXISTS public.health_threshold_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  minimum_eligible_age INTEGER NOT NULL DEFAULT 30,

  systolic_normal_max INTEGER NOT NULL DEFAULT 129,
  systolic_moderate_min INTEGER NOT NULL DEFAULT 130,
  systolic_high_min INTEGER NOT NULL DEFAULT 140,

  diastolic_normal_max INTEGER NOT NULL DEFAULT 84,
  diastolic_moderate_min INTEGER NOT NULL DEFAULT 85,
  diastolic_high_min INTEGER NOT NULL DEFAULT 90,

  sugar_normal_max INTEGER NOT NULL DEFAULT 139,
  sugar_moderate_min INTEGER NOT NULL DEFAULT 140,
  sugar_moderate_max INTEGER NOT NULL DEFAULT 199,
  sugar_high_min INTEGER NOT NULL DEFAULT 200,

  interval_high INTEGER NOT NULL DEFAULT 15,
  interval_moderate INTEGER NOT NULL DEFAULT 30,
  interval_low INTEGER NOT NULL DEFAULT 180,

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.health_threshold_settings
  ADD COLUMN IF NOT EXISTS supervisor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS interval_high INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS interval_moderate INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS interval_low INTEGER NOT NULL DEFAULT 180,
  ADD COLUMN IF NOT EXISTS working_days JSONB DEFAULT '["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]'::jsonb,
  ADD COLUMN IF NOT EXISTS working_hours JSONB DEFAULT '{"start":"09:00","end":"17:00"}'::jsonb,
  ADD COLUMN IF NOT EXISTS vitals_config JSONB DEFAULT '{"bloodPressure":true,"bloodSugar":true,"weight":true,"height":true,"bmi":true,"pulse":true,"spo2":true,"temperature":true}'::jsonb;

UPDATE public.health_threshold_settings
   SET vitals_config = '{"bloodPressure":true,"bloodSugar":true,"weight":true,"height":true,"bmi":true,"pulse":true,"spo2":true,"temperature":true}'::jsonb
 WHERE vitals_config IS NULL;

CREATE TABLE IF NOT EXISTS public.health_threshold_settings_audit (
  audit_id BIGSERIAL PRIMARY KEY,
  settings_id UUID,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  previous_values JSONB,
  new_values JSONB
);

-- Exactly one global (admin) row, at most one override per supervisor.
DROP INDEX IF EXISTS public.unique_admin_settings;
CREATE UNIQUE INDEX unique_admin_settings
  ON public.health_threshold_settings ((1)) WHERE supervisor_id IS NULL;

DROP INDEX IF EXISTS public.unique_supervisor_settings;
CREATE UNIQUE INDEX unique_supervisor_settings
  ON public.health_threshold_settings (supervisor_id) WHERE supervisor_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_threshold_settings TO authenticated;
GRANT ALL ON public.health_threshold_settings TO service_role;
GRANT SELECT, INSERT ON public.health_threshold_settings_audit TO authenticated;
GRANT ALL ON public.health_threshold_settings_audit TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.health_threshold_settings_audit_audit_id_seq TO authenticated, service_role;

ALTER TABLE public.health_threshold_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_threshold_settings_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read health thresholds" ON public.health_threshold_settings;
CREATE POLICY "Allow authenticated read health thresholds"
  ON public.health_threshold_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow admin to manage health thresholds" ON public.health_threshold_settings;
CREATE POLICY "Allow admin to manage health thresholds"
  ON public.health_threshold_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Allow supervisor to manage their health thresholds" ON public.health_threshold_settings;
CREATE POLICY "Allow supervisor to manage their health thresholds"
  ON public.health_threshold_settings FOR ALL TO authenticated
  USING (auth.uid() = supervisor_id AND public.has_role(auth.uid(), 'supervisor'))
  WITH CHECK (auth.uid() = supervisor_id AND public.has_role(auth.uid(), 'supervisor'));

DROP POLICY IF EXISTS "Admins read settings audit" ON public.health_threshold_settings_audit;
CREATE POLICY "Admins read settings audit"
  ON public.health_threshold_settings_audit FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Seed the single global default row when missing.
INSERT INTO public.health_threshold_settings (
  minimum_eligible_age,
  systolic_normal_max, systolic_moderate_min, systolic_high_min,
  diastolic_normal_max, diastolic_moderate_min, diastolic_high_min,
  sugar_normal_max, sugar_moderate_min, sugar_moderate_max, sugar_high_min,
  interval_high, interval_moderate, interval_low, supervisor_id
)
SELECT 30, 129, 130, 140, 84, 85, 90, 139, 140, 199, 200, 15, 30, 180, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.health_threshold_settings WHERE supervisor_id IS NULL);

-- ---------- 2. HOLIDAYS ----------
CREATE TABLE IF NOT EXISTS public.holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date DATE NOT NULL UNIQUE,
  name TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_holidays_date ON public.holidays(holiday_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.holidays TO authenticated;
GRANT ALL ON public.holidays TO service_role;

ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all authenticated users to read holidays" ON public.holidays;
CREATE POLICY "Allow all authenticated users to read holidays"
  ON public.holidays FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow admin and supervisor to manage holidays" ON public.holidays;
CREATE POLICY "Allow admin and supervisor to manage holidays"
  ON public.holidays FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'supervisor')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'supervisor')
  );

-- ---------- 3. TASKS ----------
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  house_uuid UUID REFERENCES public.houses(id) ON DELETE CASCADE,
  member_uuid UUID REFERENCES public.house_members(id) ON DELETE CASCADE,
  follow_up_id UUID REFERENCES public.follow_ups(id) ON DELETE SET NULL,
  task_type TEXT NOT NULL DEFAULT 'follow_up',
  status TEXT NOT NULL DEFAULT 'pending',
  due_date DATE NOT NULL,
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_member ON public.tasks(member_uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read tasks" ON public.tasks;
CREATE POLICY "Authenticated can read tasks"
  ON public.tasks FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can write tasks" ON public.tasks;
CREATE POLICY "Authenticated can write tasks"
  ON public.tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------- 4. FOLLOW-UP LIFECYCLE COLUMNS ----------
ALTER TABLE public.follow_ups
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS anchor_date DATE;

CREATE INDEX IF NOT EXISTS idx_follow_ups_member_status
  ON public.follow_ups(member_uuid, status);

-- Duplicate protection: at most one open follow-up per member.
DROP INDEX IF EXISTS public.unique_pending_followup_per_member;
CREATE UNIQUE INDEX unique_pending_followup_per_member
  ON public.follow_ups (member_uuid) WHERE status = 'pending';

-- ---------- 5. RELOAD DATA API SCHEMA CACHE ----------
NOTIFY pgrst, 'reload schema';
