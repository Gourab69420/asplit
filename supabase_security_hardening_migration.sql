-- Harden trip membership and expense writes.
-- Run in the Supabase SQL Editor for each deployed environment.

-- A user may only create the initial admin membership for a trip they created.
-- Invite approvals continue to add members through the admin-checked SECURITY DEFINER RPC.
drop policy if exists "trip_members_insert" on public.trip_members;
create policy "trip_creator_initial_admin_membership" on public.trip_members
  for insert
  with check (
    user_id = auth.uid()
    and role = 'admin'
    and exists (
      select 1
      from public.trips t
      where t.id = trip_members.trip_id
        and t.created_by = auth.uid()
    )
  );

-- Only current trip members may add expenses to that trip.
drop policy if exists "expenses_creator_write" on public.expenses;
create policy "expenses_member_creator_insert" on public.expenses
  for insert
  with check (
    created_by = auth.uid()
    and public.is_trip_member(trip_id, auth.uid())
  );

-- Avoid exposing a SECURITY DEFINER membership oracle to anonymous clients.
-- RLS and SECURITY DEFINER RPCs evaluate these helpers for the signed-in user.
create or replace function public.is_trip_member(p_trip_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select p_user_id = auth.uid() and exists (
    select 1 from public.trip_members
    where trip_id = p_trip_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_trip_admin(p_trip_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select p_user_id = auth.uid() and exists (
    select 1 from public.trip_members
    where trip_id = p_trip_id and user_id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_trip_member(uuid, uuid) from public, anon;
revoke all on function public.is_trip_admin(uuid, uuid) from public, anon;
grant execute on function public.is_trip_member(uuid, uuid) to authenticated;
grant execute on function public.is_trip_admin(uuid, uuid) to authenticated;

-- This SECURITY DEFINER cleanup is meant for trusted maintenance only.
revoke all on function public.cleanup_deleted_trips() from public, anon, authenticated;
