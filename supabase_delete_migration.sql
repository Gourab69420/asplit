-- Add soft-delete support without changing or removing existing trip data.
-- Safe to run more than once in the Supabase SQL Editor.

alter table public.trips
  add column if not exists deleted_at timestamptz default null;

create or replace function public.is_trip_admin(p_trip_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = p_trip_id
      and user_id = p_user_id
      and role = 'admin'
  );
$$;

drop policy if exists "trips_creator_update" on public.trips;
drop policy if exists "trips_admin_update" on public.trips;
create policy "trips_admin_update" on public.trips
  for update using (public.is_trip_admin(id, auth.uid()))
  with check (public.is_trip_admin(id, auth.uid()));

drop policy if exists "trips_creator_delete" on public.trips;
drop policy if exists "trips_admin_delete" on public.trips;
create policy "trips_admin_delete" on public.trips
  for delete using (public.is_trip_admin(id, auth.uid()));

create or replace function public.cleanup_deleted_trips()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.trips
  where deleted_at is not null
    and deleted_at < now() - interval '48 hours';
$$;

-- Enable pg_cron separately in Supabase if automatic cleanup is desired.
-- Otherwise cleanup_deleted_trips() can be run manually.
