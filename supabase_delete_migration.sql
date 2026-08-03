-- ============================================================
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Clear all existing trip data (expenses, members, trips)
truncate table expenses restart identity cascade;
truncate table trip_members restart identity cascade;
truncate table trips restart identity cascade;

-- 2. Add soft-delete column to trips
alter table trips add column if not exists deleted_at timestamptz default null;

-- 3. Function to hard-delete trips after 48 hours (run via pg_cron or manually)
create or replace function cleanup_deleted_trips()
returns void language plpgsql security definer as $$
begin
  delete from trips
  where deleted_at is not null
    and deleted_at < now() - interval '48 hours';
end;
$$;

-- 4. Schedule auto-cleanup every hour (requires pg_cron extension)
-- Enable pg_cron in Supabase: Dashboard → Database → Extensions → pg_cron
select cron.schedule(
  'cleanup-deleted-trips',
  '0 * * * *',
  'select cleanup_deleted_trips()'
);

-- 5. Update RLS: members can still read soft-deleted trips for 48h
drop policy if exists "trips_member_read" on trips;
create policy "trips_member_read" on trips
  for select using (
    created_by = auth.uid()
    or is_trip_member(id, auth.uid())
  );

-- Creator can soft-delete (update deleted_at)
drop policy if exists "trips_creator_update" on trips;
create policy "trips_creator_update" on trips
  for update using (created_by = auth.uid());
