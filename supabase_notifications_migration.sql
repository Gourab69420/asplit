-- ASplit in-app notifications.
-- Run in the production Supabase SQL Editor after supabase_invites_migration.sql.
-- Viewed notifications expire 24 hours after first viewing; unviewed items remain until viewed.

create extension if not exists "uuid-ossp";

create table if not exists public.app_notifications (
  id uuid primary key default uuid_generate_v4(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('expense_added', 'trip_join_request', 'trip_join_approved', 'trip_join_declined')),
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  viewed_at timestamptz
);

alter table public.app_notifications enable row level security;
revoke all on table public.app_notifications from anon, authenticated;
create index if not exists app_notifications_recipient_created_idx
  on public.app_notifications (recipient_id, created_at desc);
create index if not exists app_notifications_view_expiry_idx
  on public.app_notifications (viewed_at)
  where viewed_at is not null;

create or replace function public.get_app_notifications()
returns table (
  id uuid, type text, title text, body text, data jsonb,
  created_at timestamptz, viewed_at timestamptz
)
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;

  delete from public.app_notifications n
  where n.recipient_id = auth.uid()
    and n.viewed_at is not null
    and n.viewed_at <= now() - interval '24 hours';

  return query
    select n.id, n.type, n.title, n.body, n.data, n.created_at, n.viewed_at
    from public.app_notifications n
    where n.recipient_id = auth.uid()
    order by n.created_at desc;
end;
$$;

create or replace function public.mark_app_notifications_viewed(p_notification_ids uuid[])
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;

  update public.app_notifications n
  set viewed_at = now()
  where n.recipient_id = auth.uid()
    and n.id = any(coalesce(p_notification_ids, array[]::uuid[]))
    and n.viewed_at is null;
end;
$$;

create or replace function public.notify_trip_join_request()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_trip_name text;
  v_requester_name text;
begin
  if new.status <> 'pending'
    or (tg_op = 'UPDATE' and old.status = 'pending') then
    return new;
  end if;

  select t.name into v_trip_name from public.trips t where t.id = new.trip_id;
  select p.name into v_requester_name from public.profiles p where p.id = new.user_id;

  insert into public.app_notifications (recipient_id, type, title, body, data)
  select tm.user_id, 'trip_join_request', 'Trip join request',
    coalesce(v_requester_name, 'A user') || ' requested to join ' || coalesce(v_trip_name, 'your trip'),
    jsonb_build_object('trip_id', new.trip_id, 'request_id', new.id)
  from public.trip_members tm
  where tm.trip_id = new.trip_id
    and tm.role = 'admin'
    and tm.user_id <> new.user_id;

  return new;
end;
$$;

drop trigger if exists app_notify_trip_join_request on public.trip_join_requests;
create trigger app_notify_trip_join_request
after insert or update of status, requested_at on public.trip_join_requests
for each row execute function public.notify_trip_join_request();

create or replace function public.notify_trip_join_decision()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_trip_name text;
begin
  if old.status is not distinct from new.status
    or new.status not in ('approved', 'declined') then
    return new;
  end if;

  select t.name into v_trip_name from public.trips t where t.id = new.trip_id;

  insert into public.app_notifications (recipient_id, type, title, body, data)
  values (
    new.user_id,
    case when new.status = 'approved' then 'trip_join_approved' else 'trip_join_declined' end,
    case when new.status = 'approved' then 'Join request approved' else 'Join request declined' end,
    'Your request to join ' || coalesce(v_trip_name, 'the trip') ||
      case when new.status = 'approved' then ' was approved.' else ' was declined.' end,
    jsonb_build_object('trip_id', new.trip_id, 'request_id', new.id)
  );

  return new;
end;
$$;

drop trigger if exists app_notify_trip_join_decision on public.trip_join_requests;
create trigger app_notify_trip_join_decision
after update of status on public.trip_join_requests
for each row execute function public.notify_trip_join_decision();

create or replace function public.notify_expense_added()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_trip_name text;
  v_actor_name text;
begin
  select t.name into v_trip_name from public.trips t where t.id = new.trip_id;
  select p.name into v_actor_name from public.profiles p where p.id = new.created_by;

  insert into public.app_notifications (recipient_id, type, title, body, data)
  select tm.user_id, 'expense_added', 'New trip expense',
    coalesce(v_actor_name, 'A trip member') || ' added "' || new.title || '" to ' || coalesce(v_trip_name, 'the trip'),
    jsonb_build_object('trip_id', new.trip_id, 'expense_id', new.id)
  from public.trip_members tm
  where tm.trip_id = new.trip_id
    and tm.user_id <> coalesce(new.created_by, '00000000-0000-0000-0000-000000000000'::uuid);

  return new;
end;
$$;

drop trigger if exists app_notify_expense_added on public.expenses;
create trigger app_notify_expense_added
after insert on public.expenses
for each row execute function public.notify_expense_added();

revoke all on function public.get_app_notifications() from public, anon;
revoke all on function public.mark_app_notifications_viewed(uuid[]) from public, anon;
grant execute on function public.get_app_notifications() to authenticated;
grant execute on function public.mark_app_notifications_viewed(uuid[]) to authenticated;

-- Schedule physical cleanup. If Supabase Cron is unavailable, the inbox RPC still purges expired rows on refresh.
do $$
begin
  execute 'create extension if not exists pg_cron';
  perform cron.schedule(
    'asplit-notification-retention',
    '*/5 * * * *',
    'delete from public.app_notifications where viewed_at is not null and viewed_at <= now() - interval ''24 hours'''
  );
exception when others then
  raise warning 'Could not schedule notification cleanup. Enable Supabase Cron; expired notifications will still be deleted when the inbox is next refreshed. Details: %', sqlerrm;
end;
$$;

