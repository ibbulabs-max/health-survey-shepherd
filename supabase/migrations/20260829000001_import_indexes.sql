-- Non-destructive indexes for high-speed Smart Import, conflict detection, and duplicate prevention

-- 1. House lookup indexes
create index if not exists idx_houses_house_id on public.houses(house_id);
create index if not exists idx_houses_house_number on public.houses(house_number);
create index if not exists idx_houses_assigned_csw on public.houses(assigned_csw_id);

-- 2. Member lookup & multi-member house relationship indexes
create index if not exists idx_house_members_house_uuid on public.house_members(house_uuid);
create index if not exists idx_house_members_member_id on public.house_members(member_id);
create index if not exists idx_house_members_member_name on public.house_members(member_name);

-- 3. Clinical assessment & follow-up relationship indexes
create index if not exists idx_member_assessments_member_uuid on public.member_assessments(member_uuid);
create index if not exists idx_member_assessments_house_uuid on public.member_assessments(house_uuid);
create index if not exists idx_follow_ups_member_uuid on public.follow_ups(member_uuid);
create index if not exists idx_follow_ups_status on public.follow_ups(status);

-- 4. Import batch status & date indexes
create index if not exists idx_import_batches_status on public.import_batches(status);
create index if not exists idx_import_batches_created_at on public.import_batches(created_at desc);
create index if not exists idx_import_conflicts_batch_id on public.import_conflicts(batch_id);
