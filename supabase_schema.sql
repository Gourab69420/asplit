-- ============================================================
-- ASplit — Supabase Schema  (safe to re-run, fixes all RLS issues)
-- Supabase Dashboard → SQL Editor → New Query → Run ALL
-- ============================================================

create extension if not exists "uuid-ossp";

-- ── profiles ─────────────────────────────────────────────────
create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  name         text not null default '',
  email        text not null default '',
  upi_id       text not null default '',
  avatar_color text not null default '#2563eb',
  created_at   timestamptz default now()
);

-- ── trips ─────────────────────────────────────────────────────
create table if not exists trips (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  description text default '',
  currency    text not null default 'INR',
  start_date  date,
  end_date    date,
  status      text not null default 'upcoming',
  cover_color text not null default '#2563eb',
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz default now()
);

-- ── trip_members ──────────────────────────────────────────────
create table if not exists trip_members (
  id        uuid primary key default uuid_generate_v4(),
  trip_id   uuid not null references trips(id) on delete cascade,
  user_id   uuid not null references profiles(id) on delete cascade,
  role      text not null default 'member',
  joined_at timestamptz default now(),
  unique(trip_id, user_id)
);

-- ── expenses ──────────────────────────────────────────────────
create table if not exists expenses (
  id            uuid primary key default uuid_generate_v4(),
  trip_id       uuid not null references trips(id) on delete cascade,
  title         text not null,
  amount        numeric(12,2) not null,
  category      text not null default 'other',
  split_type    text not null default 'equal',
  paid_by       jsonb not null default '[]',
  split_between jsonb not null default '[]',
  notes         text default '',
  expense_date  date not null default current_date,
  expense_time  time not null default current_time,
  created_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz default now()
);

-- ── Trigger: auto-create profile on signup ────────────────────
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    coalesce(new.email, '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ── Enable RLS ────────────────────────────────────────────────
alter table profiles     enable row level security;
alter table trips        enable row level security;
alter table trip_members enable row level security;
alter table expenses     enable row level security;

-- ── Drop ALL existing policies (safe re-run) ──────────────────
drop policy if exists "profiles_self"           on profiles;
drop policy if exists "profiles_select"         on profiles;
drop policy if exists "profiles_insert"         on profiles;
drop policy if exists "profiles_update"         on profiles;
drop policy if exists "profiles_delete"         on profiles;
drop policy if exists "trips_member_read"       on trips;
drop policy if exists "trips_creator_write"     on trips;
drop policy if exists "trips_creator_update"    on trips;
drop policy if exists "trips_creator_delete"    on trips;
drop policy if exists "trip_members_read"       on trip_members;
drop policy if exists "trip_members_insert"     on trip_members;
drop policy if exists "trip_members_delete"     on trip_members;
drop policy if exists "expenses_member_read"    on expenses;
drop policy if exists "expenses_creator_write"  on expenses;
drop policy if exists "expenses_creator_delete" on expenses;

-- ── profiles policies ─────────────────────────────────────────
-- Split into separate policies per operation to avoid conflicts
create policy "profiles_select" on profiles
  for select using (auth.uid() = id);

create policy "profiles_insert" on profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "profiles_delete" on profiles
  for delete using (auth.uid() = id);

-- ── Helper function to check trip membership (breaks recursion) 
-- security definer = runs as the function owner, bypasses RLS
drop function if exists is_trip_member(uuid, uuid);
create function is_trip_member(p_trip_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from trip_members
    where trip_id = p_trip_id
      and user_id = p_user_id
  );
$$;

-- ── trips policies ────────────────────────────────────────────
-- Use the helper function — NO direct subquery on trip_members here
create policy "trips_member_read" on trips
  for select using (
    created_by = auth.uid()
    or is_trip_member(id, auth.uid())
  );

create policy "trips_creator_write" on trips
  for insert with check (created_by = auth.uid());

create policy "trips_creator_update" on trips
  for update using (created_by = auth.uid());

create policy "trips_creator_delete" on trips
  for delete using (created_by = auth.uid());

-- ── trip_members policies ─────────────────────────────────────
-- IMPORTANT: NO reference back to trips table here (would cause recursion)
create policy "trip_members_read" on trip_members
  for select using (user_id = auth.uid());

create policy "trip_members_insert" on trip_members
  for insert with check (user_id = auth.uid());

create policy "trip_members_delete" on trip_members
  for delete using (user_id = auth.uid());

-- ── expenses policies ─────────────────────────────────────────
create policy "expenses_member_read" on expenses
  for select using (is_trip_member(trip_id, auth.uid()));

create policy "expenses_creator_write" on expenses
  for insert with check (created_by = auth.uid());

create policy "expenses_creator_delete" on expenses
  for delete using (created_by = auth.uid());
