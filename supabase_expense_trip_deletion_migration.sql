-- Restrict expense deletion and remove all trip-linked data immediately.
-- Run in the Supabase SQL Editor after the existing app migrations.

drop policy if exists "expenses_creator_delete" on public.expenses;
drop policy if exists "expenses_creator_or_admin_delete" on public.expenses;
create policy "expenses_creator_or_admin_delete" on public.expenses
  for delete
  using (
    created_by = auth.uid()
    or public.is_trip_admin(trip_id, auth.uid())
  );

-- Most trip data is removed by ON DELETE CASCADE foreign keys. Notifications
-- store trip IDs inside JSON, so remove those explicitly when the trip is deleted.
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
