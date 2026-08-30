-- Add supervisor_id to health_threshold_settings if it doesn't exist
ALTER TABLE public.health_threshold_settings 
ADD COLUMN IF NOT EXISTS supervisor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add working configuration jsonb columns
ALTER TABLE public.health_threshold_settings
ADD COLUMN IF NOT EXISTS working_days JSONB DEFAULT '["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]'::jsonb,
ADD COLUMN IF NOT EXISTS working_hours JSONB DEFAULT '{"start": "09:00", "end": "17:00"}'::jsonb;

-- Ensure vitals_config exists just in case previous migration missed it
ALTER TABLE public.health_threshold_settings
ADD COLUMN IF NOT EXISTS vitals_config JSONB DEFAULT '{"bloodPressure":true,"bloodSugar":true,"weight":true,"height":true,"bmi":true,"pulse":true,"spo2":true,"temperature":true}'::jsonb;

-- Create unique indexes to enforce only ONE global setting (supervisor_id IS NULL)
-- and only ONE override per supervisor (supervisor_id IS NOT NULL)
DROP INDEX IF EXISTS unique_admin_settings;
CREATE UNIQUE INDEX unique_admin_settings ON public.health_threshold_settings ((1)) WHERE supervisor_id IS NULL;

DROP INDEX IF EXISTS unique_supervisor_settings;
CREATE UNIQUE INDEX unique_supervisor_settings ON public.health_threshold_settings (supervisor_id) WHERE supervisor_id IS NOT NULL;

-- Make sure existing Row Level Security policies cover the new supervisor_id model
DROP POLICY IF EXISTS "Allow authenticated read health thresholds" ON public.health_threshold_settings;
CREATE POLICY "Allow authenticated read health thresholds" ON public.health_threshold_settings FOR SELECT TO authenticated USING (true);

-- Admins can manage all rows
DROP POLICY IF EXISTS "Allow admin to manage health thresholds" ON public.health_threshold_settings;
CREATE POLICY "Allow admin to manage health thresholds" ON public.health_threshold_settings FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin')
  )
);

-- Supervisors can only manage their own row
DROP POLICY IF EXISTS "Allow supervisor to manage their health thresholds" ON public.health_threshold_settings;
CREATE POLICY "Allow supervisor to manage their health thresholds" ON public.health_threshold_settings FOR ALL TO authenticated USING (
  auth.uid() = supervisor_id AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('supervisor')
  )
);

-- Force PostgREST to reload its schema cache to fix the 404 errors!
NOTIFY pgrst, reload_schema;
