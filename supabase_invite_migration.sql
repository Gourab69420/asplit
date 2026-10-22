-- ============================================================
-- Add invite_code + join_requests for approval workflow
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Add invite_code column (unique, indexed)
alter table public.trips
add column if not exists invite_code text unique;

-- 2. Create index for fast lookup
create index if not exists trips_invite_code_idx on public.trips (invite_code);

-- 3. Function to generate invite code
create or replace function generate_invite_code()
returns text
language sql
volatile
as $$
  select substr(encode(gen_random_bytes(6), 'base64url'), 1, 8);
$$;

-- 4. Trigger to auto-generate invite_code on trip insert
create or replace function set_invite_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.invite_code is null then
    new.invite_code := generate_invite_code();
    -- Ensure uniqueness (retry once if collision)
    if exists (select 1 from trips where invite_code = new.invite_code) then
      new.invite_code := generate_invite_code();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trigger_set_invite_code on public.trips;
create trigger trigger_set_invite_code
before insert on public.trips
for each row execute procedure set_invite_code();

-- 5. Backfill existing trips
update public.trips
set invite_code = generate_invite_code()
where invite_code is null;

-- 6. Create join_requests table for approval workflow
create table if not exists public.join_requests (
  id            uuid primary key default uuid_generate_v4(),
  trip_id       uuid not null references public.trips(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_at  timestamptz default now(),
  decided_at    timestamptz,
  decided_by    uuid references public.profiles(id) on delete set null,
  unique(trip_id, user_id)
);

-- 7. Indexes
create index if not exists join_requests_trip_idx on public.join_requests (trip_id);
create index if not exists join_requests_user_idx on public.join_requests (user_id);
create index if not exists join_requests_status_idx on public.join_requests (status);

-- 8. Enable RLS
alter table public.join_requests enable row level security;

-- 9. Drop existing policies (safe re-run)
drop policy if exists "join_requests_select" on public.join_requests;
drop policy if exists "join_requests_insert" on public.join_requests;
drop policy if exists "join_requests_update" on public.join_requests;

-- 10. Policies for join_requests
-- User can see their own requests
create policy "join_requests_select" on public.join_requests
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from trip_members tm
      where tm.trip_id = join_requests.trip_id
        and tm.user_id = auth.uid()
        and tm.role = 'admin'
    )
  );

-- User can create a request for themselves
create policy "join_requests_insert" on public.join_requests
  for insert with check (user_id = auth.uid());

-- Admin can update (approve/reject) requests for their trips
create policy "join_requests_update" on public.join_requests
  for update using (
    exists (
      select 1 from trip_members tm
      where tm.trip_id = join_requests.trip_id
        and tm.user_id = auth.uid()
        and tm.role = 'admin'
    )
  );

-- 11. Grant permissions
grant select on public.trips to anon;
grant select, insert, update, delete on public.trips to authenticated;
grant select, insert, update, delete on public.trips to service_role;

grant select on public.join_requests to anon;
grant select, insert, update, delete on public.join_requests to authenticated;
grant select, insert, update, delete on public.join_requests to service_role;

-- 12. Function to approve a join request (adds to trip_members)
create or replace function approve_join_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip_id uuid;
  v_user_id uuid;
  v_admin_id uuid := auth.uid();
begin
  -- Get request details and verify admin
  select trip_id, user_id into v_trip_id, v_user_id
  from join_requests
  where id = p_request_id
    and status = 'pending'
    and exists (
      select 1 from trip_members
      where trip_id = join_requests.trip_id
        and user_id = v_admin_id
        and role = 'admin'
    );

  if not found then
    raise exception 'Request not found or not authorized';
  end if;

  -- Add to trip_members
  insert into trip_members (trip_id, user_id, role)
  values (v_trip_id, v_user_id, 'member')
  on conflict (trip_id, user_id) do update set role = 'member';

  -- Update request
  update join_requests
  set status = 'approved', decided_at = now(), decided_by = v_admin_id
  where id = p_request_id;
end;
$$;

-- 13. Function to reject a join request
create or replace function reject_join_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
begin
  update join_requests
  set status = 'rejected', decided_at = now(), decided_by = v_admin_id
  where id = p_request_id
    and status = 'pending'
    and exists (
      select 1 from trip_members
      where trip_id = join_requests.trip_id
        and user_id = v_admin_id
        and role = 'admin'
    );

  if not found then
    raise exception 'Request not found or not authorized';
  end if;
end;
$$;