-- Extend the existing notifications table
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS sender_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS related_entity_type TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS related_entity_id TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- Create push subscriptions table for Web Push
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'push_subscriptions' AND policyname = 'Users can view their own push subscriptions'
    ) THEN
        CREATE POLICY "Users can view their own push subscriptions"
            ON public.push_subscriptions
            FOR SELECT
            USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'push_subscriptions' AND policyname = 'Users can insert their own push subscriptions'
    ) THEN
        CREATE POLICY "Users can insert their own push subscriptions"
            ON public.push_subscriptions
            FOR INSERT
            WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'push_subscriptions' AND policyname = 'Users can update their own push subscriptions'
    ) THEN
        CREATE POLICY "Users can update their own push subscriptions"
            ON public.push_subscriptions
            FOR UPDATE
            USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'push_subscriptions' AND policyname = 'Users can delete their own push subscriptions'
    ) THEN
        CREATE POLICY "Users can delete their own push subscriptions"
            ON public.push_subscriptions
            FOR DELETE
            USING (auth.uid() = user_id);
    END IF;
END $$;
