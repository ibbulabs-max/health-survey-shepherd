/**
 * Types for the EXISTING Supabase schema (scanned from the live project).
 * Kept in one file so a schema change is a single-file update.
 */
import type { AppRole } from "@/config/roles";

export type Json = string | number | boolean | null | { [k: string]: Json } | Json[];
export type JsonObject = Record<string, Json>;

export interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  is_active: boolean | null;
  analytics_preferences: JsonObject | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface UserRoleRow {
  id: string;
  user_id: string | null;
  role: AppRole;
}

export interface TeamMembership {
  id: string;
  supervisor_id: string | null;
  csw_id: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface House {
  id: string;
  house_id: string | null;
  house_number: string | null;
  address: string | null;
  owner_name: string | null;
  status: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  location_status: string | null;
  location_source: string | null;
  mapped_by: string | null;
  mapped_at: string | null;
  pin_type: string | null;
  custom_type: string | null;
  assigned_csw_id: string | null;
  supervisor_id: string | null;
  monthly_income: number | null;
  earning_members: number | null;
  total_members: number | null;
  data: JsonObject | null;
  created_by: string | null;
  uploaded_by: string | null;
  uploaded_at: string | null;
  source_files: Json | null;
  created_at: string | null;
  updated_at: string | null;
  pin_id: string | null;
}

export interface HouseMember {
  id: string;
  house_uuid: string | null;
  member_id: string | null;
  member_name: string | null;
  data: JsonObject | null;
  source_files: Json | null;
  uploaded_by: string | null;
  uploaded_at: string | null;
  possible_duplicate: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface MemberAssessment {
  id: string;
  house_uuid: string | null;
  member_uuid: string | null;
  available: boolean | null;
  known_history: Json | null;
  medication: Json | null;
  medical_details: string | null;
  alcohol: string | null;
  alcohol_frequency: string | null;
  smoking: string | null;
  smoking_frequency: string | null;
  tobacco: string | null;
  tobacco_frequency: string | null;
  waist: string | null;
  physical_activity: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  bmi: number | null;
  bmi_category: string | null;
  systolic: number | null;
  diastolic: number | null;
  bp_symptoms: Json | null;
  blood_sugar: number | null;
  sugar_symptoms: Json | null;
  referral_needed: boolean | null;
  referral: Json | null;
  notes: string | null;
  risk_level: string | null;
  risk_reasons: Json | null;
  extra: JsonObject | null;
  assessed_by: string | null;
  assessed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface FollowUp {
  id: string;
  house_uuid: string | null;
  member_uuid: string | null;
  due_date: string | null;
  reason: string | null;
  status: string | null;
  risk_level: string | null;
  notes: string | null;
  created_by: string | null;
  completed_by?: string | null;
  completed_at?: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface Pin {
  id: string;
  user_id: string | null;
  username: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  pin_type: string | null;
  custom_type: string | null;
  house_id: string | null;
  house_number: string | null;
  owner_name: string | null;
  notes: string | null;
  device_time: string | null;
  device_id: string | null;
  surveyor: string | null;
  source: string | null;
  import_key: string | null;
  external_created_at: string | null;
  house_uuid: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ImportBatch {
  id: string;
  file_names: Json | null;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  uploaded_role: AppRole | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  supervisor_id: string | null;
  total_rows: number | null;
  unique_houses: number | null;
  houses_added: number | null;
  houses_updated: number | null;
  members_added: number | null;
  members_merged: number | null;
  merged_records: number | null;
  conflicts: number | null;
  unmapped_houses: number | null;
  new_fields: Json | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ImportConflict {
  id: string;
  batch_id: string | null;
  house_uuid: string | null;
  house_id: string | null;
  entity: string | null;
  member_ref: string | null;
  field: string | null;
  existing_value: string | null;
  new_value: string | null;
  source_file: string | null;
  status: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ActivityLog {
  id: string;
  user_id: string | null;
  username: string | null;
  action: string | null;
  details: Json | null;
  created_at: string | null;
}

export interface Task {
  id: string;
  house_uuid: string | null;
  member_uuid: string | null;
  follow_up_id: string | null;
  task_type: string | null;
  status: string | null;
  due_date: string | null;
  assigned_to: string | null;
  created_by: string | null;
  completed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}
