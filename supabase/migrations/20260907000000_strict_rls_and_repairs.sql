-- Phase 2: RLS and Role-Based Access Control
-- Re-assert strict RLS on all used tables without dropping existing tables, just enforcing policies.

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS public.houses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.house_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.member_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  -- Drop overly permissive policies if they exist (to ensure strictly role-based policies aren't bypassed)
  BEGIN
    DROP POLICY IF EXISTS "Allow authenticated users to read houses" ON public.houses;
    DROP POLICY IF EXISTS "Allow authenticated users to read house_members" ON public.house_members;
    DROP POLICY IF EXISTS "Allow authenticated users to read member_assessments" ON public.member_assessments;
    DROP POLICY IF EXISTS "Allow authenticated users to read import_batches" ON public.import_batches;
  EXCEPTION WHEN OTHERS THEN
    -- Ignore
  END;

  -- 1. HOUSES
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'houses' AND policyname = 'Restrict house access by role') THEN
    CREATE POLICY "Restrict house access by role" ON public.houses FOR ALL USING (
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
      OR supervisor_id = auth.uid()
      OR assigned_csw_id = auth.uid()
      OR uploaded_by = auth.uid()
      OR created_by = auth.uid()
    );
  END IF;

  -- 2. HOUSE MEMBERS
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'house_members' AND policyname = 'Restrict member access by role') THEN
    CREATE POLICY "Restrict member access by role" ON public.house_members FOR ALL USING (
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
      OR EXISTS (
        SELECT 1 FROM public.houses h 
        WHERE h.id = house_members.house_uuid 
        AND (
          h.supervisor_id = auth.uid() OR h.assigned_csw_id = auth.uid() OR h.uploaded_by = auth.uid() OR h.created_by = auth.uid()
        )
      )
    );
  END IF;

  -- 3. MEMBER ASSESSMENTS
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'member_assessments' AND policyname = 'Restrict assessment access by role') THEN
    CREATE POLICY "Restrict assessment access by role" ON public.member_assessments FOR ALL USING (
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
      OR EXISTS (
        SELECT 1 FROM public.houses h 
        WHERE h.id = member_assessments.house_uuid 
        AND (
          h.supervisor_id = auth.uid() OR h.assigned_csw_id = auth.uid() OR h.uploaded_by = auth.uid() OR h.created_by = auth.uid()
        )
      )
    );
  END IF;

  -- 4. FOLLOW UPS
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'follow_ups' AND policyname = 'Restrict follow_up access by role') THEN
    CREATE POLICY "Restrict follow_up access by role" ON public.follow_ups FOR ALL USING (
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
      OR EXISTS (
        SELECT 1 FROM public.house_members m
        JOIN public.houses h ON m.house_uuid = h.id
        WHERE m.id = follow_ups.member_uuid
        AND (
          h.supervisor_id = auth.uid() OR h.assigned_csw_id = auth.uid() OR h.uploaded_by = auth.uid() OR h.created_by = auth.uid()
        )
      )
    );
  END IF;

  -- 5. TASKS
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tasks' AND policyname = 'Restrict tasks access by role') THEN
    CREATE POLICY "Restrict tasks access by role" ON public.tasks FOR ALL USING (
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
      OR assigned_to = auth.uid()
      OR created_by = auth.uid()
    );
  END IF;

  -- 6. IMPORT BATCHES
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'import_batches' AND policyname = 'Restrict import batches by role') THEN
    CREATE POLICY "Restrict import batches by role" ON public.import_batches FOR ALL USING (
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
      OR supervisor_id = auth.uid()
      OR assigned_to = auth.uid()
      OR uploaded_by = auth.uid()
    );
  END IF;

  -- 7. NOTIFICATIONS
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Restrict notifications access') THEN
    CREATE POLICY "Restrict notifications access" ON public.notifications FOR ALL USING (
      user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
    );
  END IF;

END $$;
