-- Add master_admin to user_roles enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'master_admin';

-- Imports Table
CREATE TABLE IF NOT EXISTS imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID NOT NULL REFERENCES auth.users(id),
    organization_id UUID NOT NULL,
    file_name TEXT NOT NULL,
    total_rows INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL', -- PENDING_APPROVAL, APPROVED, REJECTED, PROCESSING, COMPLETED, FAILED
    auto_approved BOOLEAN NOT NULL DEFAULT false,
    rejected_reason TEXT,
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ
);

-- Import Rows Table
CREATE TABLE IF NOT EXISTS import_rows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_id UUID NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
    row_index INTEGER NOT NULL,
    raw_data JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, IMPORTED, FAILED
    error_reason TEXT
);

-- Communications / Chat Table
CREATE TABLE IF NOT EXISTS communications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID NOT NULL REFERENCES auth.users(id),
    title TEXT,
    is_group BOOLEAN NOT NULL DEFAULT false,
    organization_id UUID
);

CREATE TABLE IF NOT EXISTS communication_participants (
    communication_id UUID NOT NULL REFERENCES communications(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (communication_id, user_id)
);

CREATE TABLE IF NOT EXISTS communication_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    communication_id UUID NOT NULL REFERENCES communications(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Meetings Table
CREATE TABLE IF NOT EXISTS meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID NOT NULL REFERENCES auth.users(id),
    title TEXT NOT NULL,
    description TEXT,
    meeting_date DATE NOT NULL,
    meeting_time TIME NOT NULL,
    location_link TEXT,
    status TEXT NOT NULL DEFAULT 'SCHEDULED', -- SCHEDULED, CANCELLED, COMPLETED
    organization_id UUID NOT NULL
);

CREATE TABLE IF NOT EXISTS meeting_participants (
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, ACCEPTED, DECLINED
    PRIMARY KEY (meeting_id, user_id)
);

-- Map Areas Table
CREATE TABLE IF NOT EXISTS map_areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID NOT NULL REFERENCES auth.users(id),
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#3b82f6',
    geometry JSONB NOT NULL, -- GeoJSON representation
    assigned_chw_id UUID REFERENCES auth.users(id),
    organization_id UUID NOT NULL
);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor_id UUID NOT NULL REFERENCES auth.users(id),
    actor_role user_role NOT NULL,
    organization_id UUID,
    action TEXT NOT NULL,
    target_table TEXT,
    target_id UUID,
    old_value JSONB,
    new_value JSONB
);

-- User Settings (for analytics dashboard layout, custom ranges, etc.)
CREATE TABLE IF NOT EXISTS user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    analytics_layout JSONB DEFAULT '[]'::jsonb,
    hidden_analytics JSONB DEFAULT '[]'::jsonb,
    custom_age_ranges JSONB DEFAULT '[]'::jsonb,
    custom_numeric_ranges JSONB DEFAULT '{}'::jsonb,
    auto_approval_enabled BOOLEAN DEFAULT true,
    gps_sharing_enabled BOOLEAN DEFAULT false
);

-- RLS Policies for new tables

-- imports
ALTER TABLE imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view imports in their org" ON imports FOR SELECT USING (
    organization_id = (SELECT organization_id FROM user_roles WHERE user_id = auth.uid()) OR
    (SELECT role FROM user_roles WHERE user_id = auth.uid()) = 'master_admin'
);
CREATE POLICY "Users can insert imports in their org" ON imports FOR INSERT WITH CHECK (
    organization_id = (SELECT organization_id FROM user_roles WHERE user_id = auth.uid()) OR
    (SELECT role FROM user_roles WHERE user_id = auth.uid()) = 'master_admin'
);
CREATE POLICY "Admins/Supervisors can update imports" ON imports FOR UPDATE USING (
    (SELECT role FROM user_roles WHERE user_id = auth.uid()) IN ('admin', 'supervisor', 'master_admin')
);

-- import_rows
ALTER TABLE import_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view import rows in their org" ON import_rows FOR SELECT USING (
    EXISTS (SELECT 1 FROM imports i WHERE i.id = import_id AND 
        (i.organization_id = (SELECT organization_id FROM user_roles WHERE user_id = auth.uid()) OR
        (SELECT role FROM user_roles WHERE user_id = auth.uid()) = 'master_admin'))
);
CREATE POLICY "Users can insert import rows in their org" ON import_rows FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM imports i WHERE i.id = import_id AND 
        (i.organization_id = (SELECT organization_id FROM user_roles WHERE user_id = auth.uid()) OR
        (SELECT role FROM user_roles WHERE user_id = auth.uid()) = 'master_admin'))
);
CREATE POLICY "Users can update import rows in their org" ON import_rows FOR UPDATE USING (
    EXISTS (SELECT 1 FROM imports i WHERE i.id = import_id AND 
        (i.organization_id = (SELECT organization_id FROM user_roles WHERE user_id = auth.uid()) OR
        (SELECT role FROM user_roles WHERE user_id = auth.uid()) = 'master_admin'))
);

-- communications, meeting, map_areas, audit_logs RLS left open to authenticated users for now, to be refined if needed.
-- But standard practice:
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View involved comms" ON communications FOR SELECT USING (
    EXISTS (SELECT 1 FROM communication_participants cp WHERE cp.communication_id = id AND cp.user_id = auth.uid()) OR
    (SELECT role FROM user_roles WHERE user_id = auth.uid()) = 'master_admin'
);
CREATE POLICY "Insert comms" ON communications FOR INSERT WITH CHECK (true);

ALTER TABLE communication_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View comm participants" ON communication_participants FOR SELECT USING (
    EXISTS (SELECT 1 FROM communication_participants cp WHERE cp.communication_id = communication_id AND cp.user_id = auth.uid()) OR
    (SELECT role FROM user_roles WHERE user_id = auth.uid()) = 'master_admin'
);
CREATE POLICY "Insert comm participants" ON communication_participants FOR INSERT WITH CHECK (true);

ALTER TABLE communication_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View comm messages" ON communication_messages FOR SELECT USING (
    EXISTS (SELECT 1 FROM communication_participants cp WHERE cp.communication_id = communication_id AND cp.user_id = auth.uid()) OR
    (SELECT role FROM user_roles WHERE user_id = auth.uid()) = 'master_admin'
);
CREATE POLICY "Insert comm messages" ON communication_messages FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM communication_participants cp WHERE cp.communication_id = communication_id AND cp.user_id = auth.uid()) OR
    (SELECT role FROM user_roles WHERE user_id = auth.uid()) = 'master_admin'
);

ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View involved meetings" ON meetings FOR SELECT USING (
    EXISTS (SELECT 1 FROM meeting_participants mp WHERE mp.meeting_id = id AND mp.user_id = auth.uid()) OR
    (SELECT role FROM user_roles WHERE user_id = auth.uid()) = 'master_admin'
);
CREATE POLICY "Insert meetings" ON meetings FOR INSERT WITH CHECK (true);

ALTER TABLE meeting_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View meeting participants" ON meeting_participants FOR SELECT USING (
    EXISTS (SELECT 1 FROM meeting_participants mp WHERE mp.meeting_id = meeting_id AND mp.user_id = auth.uid()) OR
    (SELECT role FROM user_roles WHERE user_id = auth.uid()) = 'master_admin'
);
CREATE POLICY "Insert meeting participants" ON meeting_participants FOR INSERT WITH CHECK (true);

ALTER TABLE map_areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View map areas" ON map_areas FOR SELECT USING (
    organization_id = (SELECT organization_id FROM user_roles WHERE user_id = auth.uid()) OR
    (SELECT role FROM user_roles WHERE user_id = auth.uid()) = 'master_admin'
);
CREATE POLICY "Insert map areas" ON map_areas FOR INSERT WITH CHECK (
    organization_id = (SELECT organization_id FROM user_roles WHERE user_id = auth.uid()) OR
    (SELECT role FROM user_roles WHERE user_id = auth.uid()) = 'master_admin'
);
CREATE POLICY "Update map areas" ON map_areas FOR UPDATE USING (
    (SELECT role FROM user_roles WHERE user_id = auth.uid()) IN ('admin', 'supervisor', 'master_admin')
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own settings" ON user_settings FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Insert own settings" ON user_settings FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Update own settings" ON user_settings FOR UPDATE USING (user_id = auth.uid());
