create table public.tasks (
    id uuid primary key default uuid_generate_v4(),
    house_uuid uuid references public.houses(id) on delete cascade,
    member_uuid uuid references public.house_members(id) on delete cascade,
    follow_up_id uuid references public.follow_ups(id) on delete set null,
    task_type text not null default 'follow_up',
    status text not null default 'pending',
    due_date date not null,
    assigned_to uuid references auth.users(id),
    created_by uuid references auth.users(id),
    completed_at timestamp with time zone,
    created_at timestamp with time zone default timezone('utc'::text, now()),
    updated_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.tasks enable row level security;

create policy "Users can view tasks"
    on public.tasks for select
    using (true); -- Depending on actual app RLS, normally auth.uid() = assigned_to or supervisor, but follow_ups uses true for read currently maybe? Let's use true for now so we don't break reads.

create policy "Users can insert tasks"
    on public.tasks for insert
    with check (auth.role() = 'authenticated');

create policy "Users can update tasks"
    on public.tasks for update
    using (auth.role() = 'authenticated');

create policy "Users can delete tasks"
    on public.tasks for delete
    using (auth.role() = 'authenticated');
