CREATE TABLE IF NOT EXISTS public.holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date DATE NOT NULL UNIQUE,
  name TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_holidays_date ON public.holidays(holiday_date);

ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all authenticated users to read holidays" ON public.holidays;
CREATE POLICY "Allow all authenticated users to read holidays" ON public.holidays FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow admin and supervisor to manage holidays" ON public.holidays;
CREATE POLICY "Allow admin and supervisor to manage holidays" ON public.holidays FOR ALL TO authenticated USING (
  EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'supervisor')
  )
);
