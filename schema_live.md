# Supabase Live Schema

## Tables/Views

### import_batches

- id: string (uuid)
- file_names: undefined (jsonb)
- uploaded_by: string (uuid)
- uploaded_by_name: string (text)
- uploaded_role: string (public.app_role)
- assigned_to: string (uuid)
- assigned_to_name: string (text)
- supervisor_id: string (uuid)
- total_rows: integer (integer)
- unique_houses: integer (integer)
- houses_added: integer (integer)
- houses_updated: integer (integer)
- members_added: integer (integer)
- members_merged: integer (integer)
- merged_records: integer (integer)
- conflicts: integer (integer)
- unmapped_houses: integer (integer)
- new_fields: undefined (jsonb)
- status: string (text)
- created_at: string (timestamp with time zone)
- updated_at: string (timestamp with time zone)

### push_subscriptions

- id: string (uuid)
- user_id: string (uuid)
- endpoint: string (text)
- p256dh: string (text)
- auth: string (text)
- created_at: string (timestamp with time zone)
- updated_at: string (timestamp with time zone)

### pins

- id: string (uuid)
- user_id: string (uuid)
- username: string (text)
- latitude: number (double precision)
- longitude: number (double precision)
- accuracy: number (double precision)
- pin_type: string (text)
- custom_type: string (text)
- house_id: string (text)
- house_number: string (text)
- owner_name: string (text)
- notes: string (text)
- device_time: string (timestamp with time zone)
- device_id: string (text)
- surveyor: string (text)
- source: string (text)
- import_key: string (text)
- external_created_at: string (timestamp with time zone)
- house_uuid: string (uuid)
- created_at: string (timestamp with time zone)
- updated_at: string (timestamp with time zone)

### tasks

- id: string (uuid)
- house_uuid: string (uuid)
- member_uuid: string (uuid)
- follow_up_id: string (uuid)
- task_type: string (text)
- status: string (text)
- due_date: string (date)
- assigned_to: string (uuid)
- created_by: string (uuid)
- completed_at: string (timestamp with time zone)
- created_at: string (timestamp with time zone)
- updated_at: string (timestamp with time zone)

### profiles

- id: string (uuid)
- username: string (text)
- full_name: string (text)
- phone: string (text)
- email: string (text)
- avatar_url: string (text)
- is_active: boolean (boolean)
- created_at: string (timestamp with time zone)
- updated_at: string (timestamp with time zone)

### health_threshold_settings_audit

- id: string (uuid)
- settings_id: string (uuid)
- changed_by: string (uuid)
- previous_values: undefined (jsonb)
- new_values: undefined (jsonb)
- created_at: string (timestamp with time zone)

### activity_logs

- id: string (uuid)
- user_id: string (uuid)
- username: string (text)
- action: string (text)
- details: undefined (jsonb)
- created_at: string (timestamp with time zone)

### houses

- id: string (uuid)
- house_id: string (text)
- house_number: string (text)
- address: string (text)
- owner_name: string (text)
- status: string (text)
- latitude: number (double precision)
- longitude: number (double precision)
- accuracy: number (double precision)
- location_status: string (text)
- location_source: string (text)
- mapped_by: string (uuid)
- mapped_at: string (timestamp with time zone)
- pin_type: string (text)
- custom_type: string (text)
- assigned_csw_id: string (uuid)
- supervisor_id: string (uuid)
- monthly_income: number (numeric)
- earning_members: integer (integer)
- total_members: integer (integer)
- data: undefined (jsonb)
- created_by: string (uuid)
- uploaded_by: string (uuid)
- uploaded_at: string (timestamp with time zone)
- source_files: undefined (jsonb)
- created_at: string (timestamp with time zone)
- updated_at: string (timestamp with time zone)
- pin_id: string (uuid)

### login_attempts

- username: string (text)
- fail_count: integer (integer)
- locked_until: string (timestamp with time zone)
- updated_at: string (timestamp with time zone)

### member_assessments

- id: string (uuid)
- house_uuid: string (uuid)
- member_uuid: string (uuid)
- available: boolean (boolean)
- known_history: undefined (jsonb)
- medication: undefined (jsonb)
- medical_details: string (text)
- alcohol: string (text)
- alcohol_frequency: string (text)
- smoking: string (text)
- smoking_frequency: string (text)
- tobacco: string (text)
- tobacco_frequency: string (text)
- waist: string (text)
- physical_activity: string (text)
- height_cm: number (numeric)
- weight_kg: number (numeric)
- bmi: number (numeric)
- bmi_category: string (text)
- systolic: integer (integer)
- diastolic: integer (integer)
- bp_symptoms: undefined (jsonb)
- blood_sugar: number (numeric)
- sugar_symptoms: undefined (jsonb)
- referral_needed: boolean (boolean)
- referral: undefined (jsonb)
- notes: string (text)
- risk_level: string (text)
- risk_reasons: undefined (jsonb)
- extra: undefined (jsonb)
- assessed_by: string (uuid)
- assessed_at: string (timestamp with time zone)
- created_at: string (timestamp with time zone)
- updated_at: string (timestamp with time zone)

### team_memberships

- id: string (uuid)
- supervisor_id: string (uuid)
- csw_id: string (uuid)
- status: string (text)
- created_at: string (timestamp with time zone)
- updated_at: string (timestamp with time zone)

### health_threshold_settings

- id: string (uuid)
- minimum_eligible_age: integer (integer)
- systolic_normal_max: integer (integer)
- systolic_moderate_min: integer (integer)
- systolic_high_min: integer (integer)
- diastolic_normal_max: integer (integer)
- diastolic_moderate_min: integer (integer)
- diastolic_high_min: integer (integer)
- sugar_normal_max: integer (integer)
- sugar_moderate_min: integer (integer)
- sugar_moderate_max: integer (integer)
- sugar_high_min: integer (integer)
- interval_high: integer (integer)
- interval_moderate: integer (integer)
- interval_low: integer (integer)
- supervisor_id: string (uuid)
- vitals_config: undefined (jsonb)
- working_days: undefined (jsonb)
- working_hours: undefined (jsonb)
- created_by: string (uuid)
- created_at: string (timestamp with time zone)
- updated_at: string (timestamp with time zone)

### import_conflicts

- id: string (uuid)
- batch_id: string (uuid)
- house_uuid: string (uuid)
- house_id: string (text)
- entity: string (text)
- member_ref: string (text)
- field: string (text)
- existing_value: string (text)
- new_value: string (text)
- source_file: string (text)
- status: string (text)
- resolved_by: string (uuid)
- resolved_at: string (timestamp with time zone)
- created_at: string (timestamp with time zone)
- updated_at: string (timestamp with time zone)

### house_members

- id: string (uuid)
- house_uuid: string (uuid)
- member_id: string (text)
- member_name: string (text)
- data: undefined (jsonb)
- source_files: undefined (jsonb)
- uploaded_by: string (uuid)
- uploaded_at: string (timestamp with time zone)
- possible_duplicate: boolean (boolean)
- created_at: string (timestamp with time zone)
- updated_at: string (timestamp with time zone)

### holidays

- id: string (uuid)
- holiday_date: string (date)
- name: string (text)
- created_by: string (uuid)
- created_at: string (timestamp with time zone)
- updated_at: string (timestamp with time zone)

### user_roles

- id: string (uuid)
- user_id: string (uuid)
- role: string (public.app_role)

### follow_ups

- id: string (uuid)
- house_uuid: string (uuid)
- member_uuid: string (uuid)
- due_date: string (date)
- reason: string (text)
- status: string (text)
- risk_level: string (text)
- notes: string (text)
- created_by: string (uuid)
- created_at: string (timestamp with time zone)
- updated_at: string (timestamp with time zone)
- completed_by: string (uuid)
- completed_at: string (timestamp with time zone)

### notifications

- id: string (uuid)
- user_id: string (uuid)
- sender_user_id: string (uuid)
- title: string (text)
- message: string (text)
- is_read: boolean (boolean)
- metadata: undefined (jsonb)
- type: string (text)
- related_entity_type: string (text)
- related_entity_id: string (text)
- read_at: string (timestamp with time zone)
- created_at: string (timestamp with time zone)

## RPC Functions

- rls_auto_enable
- is_admin_like
- is_supervisor_of
- has_role
- can_access_house
