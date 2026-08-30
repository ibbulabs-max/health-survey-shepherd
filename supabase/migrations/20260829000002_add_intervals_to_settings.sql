-- Migration: Add follow up intervals to health_threshold_settings

ALTER TABLE public.health_threshold_settings
ADD COLUMN IF NOT EXISTS interval_high INTEGER NOT NULL DEFAULT 15,
ADD COLUMN IF NOT EXISTS interval_moderate INTEGER NOT NULL DEFAULT 30,
ADD COLUMN IF NOT EXISTS interval_low INTEGER NOT NULL DEFAULT 180;
