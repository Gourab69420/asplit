-- Invite links and admin-approved trip join requests.
-- Safe to run more than once in the Supabase SQL Editor.

create extension if not exists "uuid-ossp";

alter table public.trips add column if not exists deleted_at timestamptz default null;

-- Repair defaults on tables that may have been created with gen_random_uuid().
-- On projects without pgcrypto's gen_random_bytes, those defaults fail on insert.
alter table public.trips alter column id set default uuid_generate_v4();
alter table public.trip_members alter column id set default uuid_generate_v4();
alter table public.expenses alter column id set default uuid_generate_v4();

create or replace function public.is_trip_admin(p_trip_id uuid, p_user_id uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = p_trip_id and user_id = p_user_id and role = 'admin'
  );
$$;

create or replace function public.is_trip_member(p_trip_id uuid, p_user_id uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = p_trip_id and user_id = p_user_id
  );
$$;

drop policy if exists "trip_members_read" on public.trip_members;
create policy "trip_members_read" on public.trip_members
  for select using (user_id = auth.uid() or public.is_trip_member(trip_id, auth.uid()));

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (
    auth.uid() = id
    or exists (
      select 1 from public.trip_members tm
      where tm.user_id = profiles.id
        and public.is_trip_member(tm.trip_id, auth.uid())
    )
  );

create table if not exists public.trip_invites (
  token uuid primary key default uuid_generate_v4(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.trip_join_requests (
  id uuid primary key default uuid_generate_v4(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id) on delete set null,
  unique (trip_id, user_id)
);

alter table public.trip_invites alter column token set default uuid_generate_v4();
alter table public.trip_join_requests alter column id set default uuid_generate_v4();

alter table public.trip_invites enable row level security;
alter table public.trip_join_requests enable row level security;

create or replace function public.create_trip_invite(p_trip_id uuid)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare v_token uuid;
begin
  if auth.uid() is null or not public.is_trip_admin(p_trip_id, auth.uid()) then
    raise exception 'Only trip admins can create invite links';
  end if;
  if not exists (select 1 from public.trips where id = p_trip_id and deleted_at is null) then
    raise exception 'Trip not found or deleted';
  end if;
  select token into v_token from public.trip_invites
    where trip_id = p_trip_id and active = true order by created_at desc limit 1;
  if v_token is null then
    insert into public.trip_invites (trip_id, created_by)
    values (p_trip_id, auth.uid()) returning token into v_token;
  end if;
  return v_token;
end;
$$;

create or replace function public.get_trip_invite(p_token uuid)
returns table (trip_id uuid, trip_name text)
language sql stable security definer
set search_path = public
as $$
  select t.id, t.name
  from public.trip_invites i
  join public.trips t on t.id = i.trip_id
  where i.token = p_token and i.active and t.deleted_at is null;
$$;

create or replace function public.request_trip_join(p_token uuid)
returns text
language plpgsql security definer
set search_path = public
as $$
declare v_trip_id uuid; v_status text;
begin
  if auth.uid() is null then raise exception 'Sign in before requesting to join'; end if;
  select trip_id into v_trip_id from public.trip_invites
    where token = p_token and active = true;
  if v_trip_id is null or exists (select 1 from public.trips where id = v_trip_id and deleted_at is not null) then
    raise exception 'This invite link is invalid or expired';
  end if;
  if exists (select 1 from public.trip_members where trip_id = v_trip_id and user_id = auth.uid()) then
    return 'already_member';
  end if;
  select status into v_status from public.trip_join_requests
    where trip_id = v_trip_id and user_id = auth.uid();
  if v_status = 'pending' or v_status = 'approved' then return v_status; end if;
  if v_status = 'declined' then
    update public.trip_join_requests set status = 'pending', requested_at = now(), decided_at = null, decided_by = null
      where trip_id = v_trip_id and user_id = auth.uid();
  else
    insert into public.trip_join_requests (trip_id, user_id) values (v_trip_id, auth.uid());
  end if;
  return 'pending';
end;
$$;

create or replace function public.list_trip_join_requests(p_trip_id uuid)
returns table (request_id uuid, user_id uuid, name text, email text, requested_at timestamptz)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_trip_admin(p_trip_id, auth.uid()) then
    raise exception 'Only trip admins can review join requests';
  end if;
  return query
    select r.id, r.user_id, p.name, p.email, r.requested_at
    from public.trip_join_requests r
    join public.profiles p on p.id = r.user_id
    where r.trip_id = p_trip_id and r.status = 'pending'
    order by r.requested_at;
end;
$$;

create or replace function public.decide_trip_join_request(p_request_id uuid, p_approve boolean)
returns text
language plpgsql security definer
set search_path = public
as $$
declare v_request public.trip_join_requests%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into v_request from public.trip_join_requests where id = p_request_id for update;
  if not found then raise exception 'Join request not found'; end if;
  if not public.is_trip_admin(v_request.trip_id, auth.uid()) then
    raise exception 'Only trip admins can review join requests';
  end if;
  if v_request.status <> 'pending' then raise exception 'This request has already been handled'; end if;
  if p_approve then
    insert into public.trip_members (trip_id, user_id, role)
      values (v_request.trip_id, v_request.user_id, 'member')
      on conflict (trip_id, user_id) do nothing;
  end if;
  update public.trip_join_requests
    set status = case when p_approve then 'approved' else 'declined' end,
        decided_at = now(), decided_by = auth.uid()
    where id = p_request_id;
  return case when p_approve then 'approved' else 'declined' end;
end;
$$;

revoke all on function public.create_trip_invite(uuid) from public, anon;
revoke all on function public.get_trip_invite(uuid) from public, anon;
revoke all on function public.request_trip_join(uuid) from public, anon;
revoke all on function public.list_trip_join_requests(uuid) from public, anon;
revoke all on function public.decide_trip_join_request(uuid, boolean) from public, anon;
grant execute on function public.create_trip_invite(uuid) to authenticated;
grant execute on function public.get_trip_invite(uuid) to authenticated;
grant execute on function public.request_trip_join(uuid) to authenticated;
grant execute on function public.list_trip_join_requests(uuid) to authenticated;
grant execute on function public.decide_trip_join_request(uuid, boolean) to authenticated;
