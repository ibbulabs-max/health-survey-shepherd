-- Add analytics_preferences to profiles table
ALTER TABLE public.profiles
ADD COLUMN analytics_preferences jsonb DEFAULT '{}'::jsonb;
