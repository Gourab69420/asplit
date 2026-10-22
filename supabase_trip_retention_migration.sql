-- Restore the 48-hour recovery window for deleted trips and schedule automatic
-- permanent cleanup. Run this in the production Supabase SQL Editor.

alter table public.trips
  add column if not exists deleted_at timestamptz default null;

create or replace function public.cleanup_deleted_trips()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.trips
  where deleted_at is not null
    and deleted_at <= now() - interval '48 hours';
$$;

revoke all on function public.cleanup_deleted_trips() from public, anon, authenticated;

-- Trip members, expenses, invites, join requests, and settlement payments have
-- ON DELETE CASCADE references. Notifications store trip IDs in JSON instead,
-- so delete them explicitly when the trip is permanently purged.
create or replace function public.delete_trip_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.app_notifications
  where data->>'trip_id' = old.id::text;
  return old;
end;
$$;

revoke all on function public.delete_trip_notifications() from public, anon, authenticated;

drop trigger if exists delete_trip_notifications_after_delete on public.trips;
create trigger delete_trip_notifications_after_delete
  after delete on public.trips
  for each row execute function public.delete_trip_notifications();

-- Remove any older copy of this scheduled job before recreating it. The job
-- runs once a minute and deletes only trips whose 48-hour window has elapsed.
create extension if not exists pg_cron;

do $$
declare
  v_job record;
begin
  for v_job in select jobid from cron.job where jobname = 'asplit-trip-retention' loop
    perform cron.unschedule(v_job.jobid);
  end loop;

  perform cron.schedule(
    'asplit-trip-retention',
    '* * * * *',
    'select public.cleanup_deleted_trips();'
  );
end;
$$;
