-- Persist payments that a trip debtor has marked as paid.
-- Run in the Supabase SQL Editor after supabase_schema.sql.

create table if not exists public.settlement_payments (
  id uuid primary key,
  trip_id uuid not null references public.trips(id) on delete cascade,
  from_user_id uuid not null references public.profiles(id) on delete cascade,
  to_user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  check (from_user_id <> to_user_id)
);

create index if not exists settlement_payments_trip_idx
  on public.settlement_payments (trip_id, created_at desc);

alter table public.settlement_payments enable row level security;
revoke all on table public.settlement_payments from anon, authenticated;
grant select on table public.settlement_payments to authenticated;

drop policy if exists settlement_payments_read_members on public.settlement_payments;
create policy settlement_payments_read_members on public.settlement_payments
  for select to authenticated
  using (exists (
    select 1 from public.trip_members tm
    where tm.trip_id = settlement_payments.trip_id and tm.user_id = auth.uid()
  ));

create or replace function public.mark_settlement_paid(
  p_payment_id uuid,
  p_trip_id uuid,
  p_to_user_id uuid,
  p_amount numeric
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_existing public.settlement_payments%rowtype;
  v_expense record;
  v_user_id uuid;
  v_user_balance numeric := 0;
  v_paid numeric;
  v_share numeric;
  v_payments_delta numeric;
  v_from_balance numeric := 0;
  v_to_balance numeric := 0;
begin
  if auth.uid() is null then raise exception 'Sign in before recording a payment'; end if;
  if p_payment_id is null or p_trip_id is null or p_to_user_id is null
     or p_amount is null or p_amount <= 0 or round(p_amount, 2) <> p_amount then
    raise exception 'Payment details are invalid';
  end if;
  if p_to_user_id = auth.uid() then raise exception 'You cannot pay yourself'; end if;

  select * into v_existing from public.settlement_payments where id = p_payment_id;
  if found then
    if v_existing.from_user_id <> auth.uid()
       or v_existing.trip_id <> p_trip_id
       or v_existing.to_user_id <> p_to_user_id
       or v_existing.amount <> p_amount then
      raise exception 'Payment reference was already used';
    end if;
    return v_existing.id;
  end if;

  if not exists (select 1 from public.trip_members where trip_id = p_trip_id and user_id = auth.uid())
     or not exists (select 1 from public.trip_members where trip_id = p_trip_id and user_id = p_to_user_id) then
    raise exception 'Both people must belong to this trip';
  end if;
  perform 1 from public.trips where id = p_trip_id and deleted_at is null for update;
  if not found then raise exception 'Trip not found or deleted'; end if;

  for v_expense in
    select e.amount, e.paid_by, e.split_between, e.split_amounts
    from public.expenses e where e.trip_id = p_trip_id
  loop
    foreach v_user_id in array array[auth.uid(), p_to_user_id] loop
      v_user_balance := 0;
      select coalesce(sum((payer.item->>'amount')::numeric), 0)
        into v_paid
      from jsonb_array_elements(coalesce(v_expense.paid_by, '[]'::jsonb)) as payer(item)
      where payer.item->>'memberId' = v_user_id::text;

      if jsonb_array_length(coalesce(v_expense.split_amounts, '[]'::jsonb)) > 0 then
        select coalesce(sum((share.item->>'amount')::numeric), 0)
          into v_share
        from jsonb_array_elements(v_expense.split_amounts) as share(item)
        where share.item->>'memberId' = v_user_id::text;
      elsif coalesce(v_expense.split_between, '[]'::jsonb) ? v_user_id::text then
        v_share := v_expense.amount / greatest(jsonb_array_length(coalesce(v_expense.split_between, '[]'::jsonb)), 1);
      else
        v_share := 0;
      end if;

      v_user_balance := v_user_balance + v_paid - v_share;
      if v_user_id = auth.uid() then
        v_from_balance := v_from_balance + v_user_balance;
      else
        v_to_balance := v_to_balance + v_user_balance;
      end if;
    end loop;
  end loop;

  -- Previous transfers increase the payer's balance and reduce the receiver's.
  select coalesce(sum(case
    when p.from_user_id = auth.uid() then p.amount
    when p.to_user_id = auth.uid() then -p.amount end), 0)
    into v_payments_delta
  from public.settlement_payments p where p.trip_id = p_trip_id
    and (p.from_user_id = auth.uid() or p.to_user_id = auth.uid());
  v_from_balance := v_from_balance + v_payments_delta;

  select coalesce(sum(case
    when p.from_user_id = p_to_user_id then p.amount
    when p.to_user_id = p_to_user_id then -p.amount end), 0)
    into v_payments_delta
  from public.settlement_payments p where p.trip_id = p_trip_id
    and (p.from_user_id = p_to_user_id or p.to_user_id = p_to_user_id);
  v_to_balance := v_to_balance + v_payments_delta;

  if v_from_balance >= 0 or v_to_balance <= 0
     or p_amount > least(-v_from_balance, v_to_balance) + 0.005 then
    raise exception 'This payment is greater than the current amount owed';
  end if;

  insert into public.settlement_payments (id, trip_id, from_user_id, to_user_id, amount)
  values (p_payment_id, p_trip_id, auth.uid(), p_to_user_id, p_amount);

  return p_payment_id;
end;
$$;

revoke all on function public.mark_settlement_paid(uuid, uuid, uuid, numeric) from public, anon;
grant execute on function public.mark_settlement_paid(uuid, uuid, uuid, numeric) to authenticated;
