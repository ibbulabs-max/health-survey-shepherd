-- Migration: Settings Audit and UI Consistency
-- Description: Creates the health_threshold_settings_audit table.

CREATE TABLE IF NOT EXISTS public.health_threshold_settings_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settings_id UUID REFERENCES public.health_threshold_settings(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  previous_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS for audit table (Admins only)
ALTER TABLE public.health_threshold_settings_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow admin to read audit" ON public.health_threshold_settings_audit
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin')
    )
  );

CREATE POLICY "Allow service role to insert audit" ON public.health_threshold_settings_audit
  FOR INSERT TO service_role
  WITH CHECK (true);

-- We need a policy to allow the server function (which runs as service_role usually, but maybe it runs as anon/authenticated if RLS applies to the client? No, settingsService uses `getSupabaseAdmin()`)
-- If it uses `getSupabaseAdmin()`, it has bypass RLS. But let's add one just in case it uses a regular client.
CREATE POLICY "Allow authenticated to insert audit" ON public.health_threshold_settings_audit
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'supervisor')
    )
  );

NOTIFY pgrst, reload_schema;
