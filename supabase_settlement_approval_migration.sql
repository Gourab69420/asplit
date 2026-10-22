-- Require the person receiving a payment to confirm it before balances change.
-- Run after supabase_settlement_payments_migration.sql and supabase_notifications_migration.sql.

alter table public.settlement_payments
  add column if not exists status text not null default 'pending',
  add column if not exists decided_at timestamptz,
  add column if not exists decided_by uuid references public.profiles(id) on delete set null;

alter table public.settlement_payments drop constraint if exists settlement_payments_status_check;
alter table public.settlement_payments add constraint settlement_payments_status_check
  check (status in ('pending', 'approved', 'declined'));

create index if not exists settlement_payments_pending_recipient_idx
  on public.settlement_payments (to_user_id, created_at desc)
  where status = 'pending';

create or replace function public.trip_member_net_balance(p_trip_id uuid, p_user_id uuid)
returns numeric
language plpgsql security definer
set search_path = public
as $$
declare
  v_expense record;
  v_paid numeric;
  v_share numeric;
  v_balance numeric := 0;
  v_payment_delta numeric;
begin
  for v_expense in
    select e.amount, e.paid_by, e.split_between, e.split_amounts
    from public.expenses e where e.trip_id = p_trip_id
  loop
    select coalesce(sum((payer.item->>'amount')::numeric), 0)
      into v_paid
    from jsonb_array_elements(coalesce(v_expense.paid_by, '[]'::jsonb)) as payer(item)
    where payer.item->>'memberId' = p_user_id::text;

    if jsonb_array_length(coalesce(v_expense.split_amounts, '[]'::jsonb)) > 0 then
      select coalesce(sum((share.item->>'amount')::numeric), 0)
        into v_share
      from jsonb_array_elements(v_expense.split_amounts) as share(item)
      where share.item->>'memberId' = p_user_id::text;
    elsif coalesce(v_expense.split_between, '[]'::jsonb) ? p_user_id::text then
      v_share := v_expense.amount / greatest(jsonb_array_length(coalesce(v_expense.split_between, '[]'::jsonb)), 1);
    else
      v_share := 0;
    end if;

    v_balance := v_balance + v_paid - v_share;
  end loop;

  select coalesce(sum(case
    when p.from_user_id = p_user_id then p.amount
    when p.to_user_id = p_user_id then -p.amount
  end), 0)
    into v_payment_delta
  from public.settlement_payments p
  where p.trip_id = p_trip_id and p.status = 'approved'
    and (p.from_user_id = p_user_id or p.to_user_id = p_user_id);

  return v_balance + v_payment_delta;
end;
$$;

revoke all on function public.trip_member_net_balance(uuid, uuid) from public, anon, authenticated;

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
  v_from_balance numeric;
  v_to_balance numeric;
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
  if exists (
    select 1 from public.settlement_payments p
    where p.trip_id = p_trip_id and p.from_user_id = auth.uid()
      and p.to_user_id = p_to_user_id and p.status = 'pending'
  ) then
    raise exception 'A payment request to this person is already waiting for approval';
  end if;

  v_from_balance := public.trip_member_net_balance(p_trip_id, auth.uid());
  v_to_balance := public.trip_member_net_balance(p_trip_id, p_to_user_id);
  if v_from_balance >= 0 or v_to_balance <= 0
     or p_amount > least(-v_from_balance, v_to_balance) + 0.005 then
    raise exception 'This payment is greater than the current amount owed';
  end if;

  insert into public.settlement_payments (id, trip_id, from_user_id, to_user_id, amount, status)
  values (p_payment_id, p_trip_id, auth.uid(), p_to_user_id, p_amount, 'pending');
  return p_payment_id;
end;
$$;

create or replace function public.decide_settlement_payment(p_payment_id uuid, p_approve boolean)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v_payment public.settlement_payments%rowtype;
  v_from_balance numeric;
  v_to_balance numeric;
  v_status text;
begin
  if auth.uid() is null then raise exception 'Sign in before reviewing a payment'; end if;
  if p_approve is null then raise exception 'Choose whether to approve or decline this payment'; end if;
  select * into v_payment from public.settlement_payments where id = p_payment_id for update;
  if not found then raise exception 'Payment request not found'; end if;
  if v_payment.to_user_id <> auth.uid() then
    raise exception 'Only the payment recipient can approve or decline it';
  end if;
  if not exists (
    select 1 from public.trip_members tm
    where tm.trip_id = v_payment.trip_id and tm.user_id = auth.uid()
  ) then raise exception 'You are no longer a member of this trip'; end if;
  if v_payment.status <> 'pending' then return v_payment.status; end if;

  perform 1 from public.trips where id = v_payment.trip_id and deleted_at is null for update;
  if not found then raise exception 'Trip not found or deleted'; end if;

  if p_approve then
    v_from_balance := public.trip_member_net_balance(v_payment.trip_id, v_payment.from_user_id);
    v_to_balance := public.trip_member_net_balance(v_payment.trip_id, v_payment.to_user_id);
    if v_from_balance >= 0 or v_to_balance <= 0
       or v_payment.amount > least(-v_from_balance, v_to_balance) + 0.005 then
      raise exception 'The trip balance changed. This payment can no longer be approved';
    end if;
    v_status := 'approved';
  else
    v_status := 'declined';
  end if;

  update public.settlement_payments
  set status = v_status, decided_at = now(), decided_by = auth.uid()
  where id = p_payment_id;
  return v_status;
end;
$$;

revoke all on function public.mark_settlement_paid(uuid, uuid, uuid, numeric) from public, anon;
grant execute on function public.mark_settlement_paid(uuid, uuid, uuid, numeric) to authenticated;
revoke all on function public.decide_settlement_payment(uuid, boolean) from public, anon;
grant execute on function public.decide_settlement_payment(uuid, boolean) to authenticated;

-- Add payment approval events to the existing in-app notification inbox.
alter table public.app_notifications drop constraint if exists app_notifications_type_check;
alter table public.app_notifications add constraint app_notifications_type_check
  check (type in (
    'expense_added', 'trip_join_request', 'trip_join_approved', 'trip_join_declined',
    'settlement_payment_request', 'settlement_payment_approved', 'settlement_payment_declined'
  ));

create or replace function public.notify_settlement_payment()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_trip_name text;
  v_from_name text;
  v_to_name text;
  v_title text;
  v_body text;
begin
  select t.name into v_trip_name from public.trips t where t.id = new.trip_id;
  select p.name into v_from_name from public.profiles p where p.id = new.from_user_id;
  select p.name into v_to_name from public.profiles p where p.id = new.to_user_id;

  if tg_op = 'INSERT' and new.status = 'pending' then
    insert into public.app_notifications (recipient_id, type, title, body, data)
    values (
      new.to_user_id, 'settlement_payment_request', 'Payment approval requested',
      coalesce(v_from_name, 'A trip member') || ' says they paid ' || new.amount::text || ' for ' || coalesce(v_trip_name, 'your trip'),
      jsonb_build_object('trip_id', new.trip_id, 'payment_id', new.id)
    );
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status in ('approved', 'declined') then
    v_title := case when new.status = 'approved' then 'Payment approved' else 'Payment declined' end;
    v_body := coalesce(v_to_name, 'The recipient') || ' ' ||
      case when new.status = 'approved' then 'approved your payment of ' else 'declined your payment of ' end ||
      new.amount::text || ' for ' || coalesce(v_trip_name, 'the trip');

    update public.app_notifications n
    set title = case when new.status = 'approved' then 'Payment approved' else 'Payment declined' end,
        body = coalesce(v_from_name, 'The payer') || ' marked ' || new.amount::text ||
          case when new.status = 'approved' then ' as paid. You approved it.' else ' as paid. You declined it.' end,
        data = n.data || jsonb_build_object('decision', new.status)
    where n.recipient_id = new.to_user_id and n.type = 'settlement_payment_request'
      and n.data->>'payment_id' = new.id::text;

    insert into public.app_notifications (recipient_id, type, title, body, data)
    values (
      new.from_user_id,
      case when new.status = 'approved' then 'settlement_payment_approved' else 'settlement_payment_declined' end,
      v_title, v_body,
      jsonb_build_object('trip_id', new.trip_id, 'payment_id', new.id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists app_notify_settlement_payment on public.settlement_payments;
create trigger app_notify_settlement_payment
after insert or update of status on public.settlement_payments
for each row execute function public.notify_settlement_payment();

-- Give recipients an inbox item for requests created before this migration ran.
insert into public.app_notifications (recipient_id, type, title, body, data)
select p.to_user_id, 'settlement_payment_request', 'Payment approval requested',
  coalesce(sender.name, 'A trip member') || ' says they paid ' || p.amount::text || ' for ' || coalesce(t.name, 'your trip'),
  jsonb_build_object('trip_id', p.trip_id, 'payment_id', p.id)
from public.settlement_payments p
left join public.profiles sender on sender.id = p.from_user_id
left join public.trips t on t.id = p.trip_id
where p.status = 'pending'
  and not exists (
    select 1 from public.app_notifications n
    where n.recipient_id = p.to_user_id and n.type = 'settlement_payment_request'
      and n.data->>'payment_id' = p.id::text
  );
