-- Safely add master_admin to the existing app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'master_admin';
