-- Add an optional phone number to user profiles for settlement contact actions.
-- Run this once in the Supabase SQL Editor for existing deployments.
alter table public.profiles
  add column if not exists phone text not null default '';
