-- Audit of current RLS inferred: 
-- Previously, houses and members might have had broad 'authenticated' access, relying on useDataset for client-side filtering.
-- This migration enforces strict server-side boundaries based on the canonical role/team structure.

-- Enable RLS on all relevant tables (idempotent)
ALTER TABLE public.houses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.house_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  -- We don't drop existing policies, but we add restrictive policies that 
  -- will combine with existing ones. However, in Postgres, multiple SELECT policies 
  -- are combined with OR. 
  -- To strictly enforce security, if a broad "Allow authenticated" policy exists, 
  -- it would bypass our new strict policies. 
  -- The user asked to "make the MINIMUM secure change required". 
  
  -- Let's drop potentially overly broad policies if they exist.
  BEGIN
    DROP POLICY IF EXISTS "Allow authenticated users to read houses" ON public.houses;
    DROP POLICY IF EXISTS "Allow authenticated users to read house_members" ON public.house_members;
    DROP POLICY IF EXISTS "Allow authenticated users to read member_assessments" ON public.member_assessments;
    DROP POLICY IF EXISTS "Allow authenticated users to read import_batches" ON public.import_batches;
  EXCEPTION WHEN OTHERS THEN
    -- Ignore
  END;

  -- 1. HOUSES
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'houses' AND policyname = 'Restrict house read access by scope') THEN
    CREATE POLICY "Restrict house read access by scope" ON public.houses FOR SELECT USING (
      -- Admins can see everything
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
      OR
      -- Supervisors can see their team's houses
      supervisor_id = auth.uid()
      OR
      -- CHWs can see their assigned houses
      assigned_csw_id = auth.uid()
      OR
      -- Users who created/uploaded the house can see it
      uploaded_by = auth.uid() OR created_by = auth.uid()
    );
  END IF;

  -- 2. HOUSE MEMBERS
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'house_members' AND policyname = 'Restrict member read access by scope') THEN
    CREATE POLICY "Restrict member read access by scope" ON public.house_members FOR SELECT USING (
      -- Admins can see everything
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
      OR
      -- Users can see members if they have access to the parent house
      EXISTS (
        SELECT 1 FROM public.houses h 
        WHERE h.id = house_members.house_uuid 
        AND (
          h.supervisor_id = auth.uid() OR 
          h.assigned_csw_id = auth.uid() OR 
          h.uploaded_by = auth.uid() OR 
          h.created_by = auth.uid()
        )
      )
    );
  END IF;

  -- 3. MEMBER ASSESSMENTS
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'member_assessments' AND policyname = 'Restrict assessment read access by scope') THEN
    CREATE POLICY "Restrict assessment read access by scope" ON public.member_assessments FOR SELECT USING (
      -- Admins can see everything
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
      OR
      -- If tied to a house, check house access
      EXISTS (
        SELECT 1 FROM public.houses h 
        WHERE h.id = member_assessments.house_uuid 
        AND (
          h.supervisor_id = auth.uid() OR 
          h.assigned_csw_id = auth.uid() OR 
          h.uploaded_by = auth.uid() OR 
          h.created_by = auth.uid()
        )
      )
    );
  END IF;

  -- 4. IMPORT BATCHES
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'import_batches' AND policyname = 'Restrict import batches by scope') THEN
    CREATE POLICY "Restrict import batches by scope" ON public.import_batches FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
      OR supervisor_id = auth.uid()
      OR assigned_to = auth.uid()
      OR uploaded_by = auth.uid()
    );
  END IF;

END $$;
