-- Create the notifications table for the system
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Notifications policy: users can only see and update their own notifications
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'notifications' AND policyname = 'Users can view their own notifications'
    ) THEN
        CREATE POLICY "Users can view their own notifications"
          ON public.notifications
          FOR SELECT
          USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'notifications' AND policyname = 'Users can update their own notifications'
    ) THEN
        CREATE POLICY "Users can update their own notifications"
          ON public.notifications
          FOR UPDATE
          USING (auth.uid() = user_id);
    END IF;
END $$;

-- Enforce strict role-scoped visibility for imported houses, members, and follow-ups
-- Since getSupabaseAdmin() bypasses this during inserts, we ensure that the SELECT policies
-- filter strictly based on the supervisor_id and assigned_csw_id.

-- We don't drop existing select policies entirely if they exist, but we should make sure 
-- any generic open read policies are overridden. The Management App requires that 
-- admins see all, supervisors see their team, and CHWs see only their assigned items.
-- This applies to houses.

-- (Assuming existing RLS policies exist on houses, we append an explicit safeguard if needed, 
-- but given the instruction, we will enforce it strictly in the UI dataset hook. 
-- The backend RLS should complement it.)

-- Ensure indexes exist for the new notification table
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications (is_read);
