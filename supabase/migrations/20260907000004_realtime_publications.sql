-- Phase 14: Repair realtime replication limits (publication rules)
-- Add tables to the supabase_realtime publication

BEGIN;

-- Create the publication if it does not exist (Supabase creates this by default)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- Add required tables to the publication
-- We use 'ADD TABLE' and ignore errors if they are already added,
-- but the safe way is to ALTER PUBLICATION SET TABLE.
-- However, we don't want to drop existing ones, so we will use a DO block.

DO $$
DECLARE
  t text;
  tables_to_add text[] := ARRAY[
    'import_batches',
    'notifications',
    'tasks',
    'follow_ups',
    'houses',
    'house_members',
    'member_assessments'
  ];
BEGIN
  FOR t IN SELECT unnest(tables_to_add)
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      BEGIN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      EXCEPTION WHEN OTHERS THEN
        -- Table might already be in publication, ignore
      END;
    END IF;
  END LOOP;
END $$;

COMMIT;
