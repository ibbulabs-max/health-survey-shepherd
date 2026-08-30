-- Migration: Create health_threshold_settings and audit table

CREATE TABLE IF NOT EXISTS public.health_threshold_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  minimum_eligible_age INTEGER NOT NULL DEFAULT 30,

  systolic_normal_max INTEGER NOT NULL DEFAULT 130,
  systolic_moderate_min INTEGER NOT NULL DEFAULT 140,
  systolic_high_min INTEGER NOT NULL DEFAULT 150,

  diastolic_normal_max INTEGER NOT NULL DEFAULT 80,
  diastolic_moderate_min INTEGER NOT NULL DEFAULT 90,
  diastolic_high_min INTEGER NOT NULL DEFAULT 100,

  sugar_normal_max INTEGER NOT NULL DEFAULT 135,
  sugar_moderate_min INTEGER NOT NULL DEFAULT 136,
  sugar_moderate_max INTEGER NOT NULL DEFAULT 160,
  sugar_high_min INTEGER NOT NULL DEFAULT 161,

  interval_high INTEGER NOT NULL DEFAULT 15,
  interval_moderate INTEGER NOT NULL DEFAULT 30,
  interval_low INTEGER NOT NULL DEFAULT 180,

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit/history table to preserve previous configurations
CREATE TABLE IF NOT EXISTS public.health_threshold_settings_audit (
  audit_id BIGSERIAL PRIMARY KEY,
  settings_id UUID,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  previous_values JSONB,
  new_values JSONB
);

-- RLS enabling and example policies (match project conventions)
ALTER TABLE public.health_threshold_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read health thresholds" ON public.health_threshold_settings;
CREATE POLICY "Allow authenticated read health thresholds" ON public.health_threshold_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow admin to manage health thresholds" ON public.health_threshold_settings;
CREATE POLICY "Allow admin to manage health thresholds" ON public.health_threshold_settings FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin')
  )
);

-- Ensure at least one default row exists (insert only if table is empty)
INSERT INTO public.health_threshold_settings (
  minimum_eligible_age, 
  systolic_normal_max, systolic_moderate_min, systolic_high_min, 
  diastolic_normal_max, diastolic_moderate_min, diastolic_high_min, 
  sugar_normal_max, sugar_moderate_min, sugar_moderate_max, sugar_high_min,
  interval_high, interval_moderate, interval_low
)
SELECT 30, 130, 140, 150, 80, 90, 100, 135, 136, 160, 161, 15, 30, 180
WHERE NOT EXISTS (SELECT 1 FROM public.health_threshold_settings);
