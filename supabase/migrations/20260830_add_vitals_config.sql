-- Migration: Add vitals_config to health_threshold_settings

-- Add vitals_config column
ALTER TABLE public.health_threshold_settings 
ADD COLUMN IF NOT EXISTS vitals_config JSONB DEFAULT '{
  "bloodPressure": true,
  "bloodSugar": true,
  "weight": true,
  "height": true,
  "bmi": true,
  "pulse": true,
  "spo2": true,
  "temperature": true
}'::jsonb;

-- Update existing rows with the default configuration if it's null
UPDATE public.health_threshold_settings 
SET vitals_config = '{
  "bloodPressure": true,
  "bloodSugar": true,
  "weight": true,
  "height": true,
  "bmi": true,
  "pulse": true,
  "spo2": true,
  "temperature": true
}'::jsonb 
WHERE vitals_config IS NULL;
