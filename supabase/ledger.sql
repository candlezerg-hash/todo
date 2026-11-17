-- 기존 프로젝트의 SQL Editor에서 한 번 실행하세요. 할 일 테이블은 변경하지 않습니다.
begin;
create table if not exists public.little_plan_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account text not null check (account in ('bank','credit','paypay','cash')),
  kind text not null check (kind in ('expense','adjustment')),
  amount bigint not null check (abs(amount::numeric) <= 1000000000000),
  spent_on date not null,
  merchant text not null check (char_length(btrim(merchant)) between 1 and 120),
  category text,
  created_at timestamptz not null default now(),
  check ((kind='adjustment' and category is null) or
    (kind='expense' and amount<0 and category is not null and category in ('fixed','food','hobby','transport','shopping','other')))
);
create index if not exists little_plan_ledger_owner_date on public.little_plan_ledger(user_id,spent_on,created_at,id);
alter table public.little_plan_ledger enable row level security;
revoke all on public.little_plan_ledger from anon, authenticated;
grant select on public.little_plan_ledger to authenticated;
drop policy if exists "read own ledger" on public.little_plan_ledger;
create policy "read own ledger" on public.little_plan_ledger for select to authenticated
using ((select auth.uid())=user_id);

-- 残高確認と記録を同じトランザクションで実行。
create or replace function public.little_plan_record(p_account text,p_amount bigint,p_date date,p_merchant text,p_category text,p_kind text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare owner uuid:=auth.uid(); current_balance bigint; delta bigint; entry_id uuid;
begin
  if owner is null then raise exception 'Login required'; end if;
  if p_amount is null or p_amount<0 or p_amount>1000000000000 then raise exception 'Invalid amount'; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner::text,0));
  select coalesce(sum(amount),0) into current_balance from public.little_plan_ledger where user_id=owner and account=p_account;
  if p_kind='adjustment' then delta:=p_amount-current_balance;
  elsif p_kind='expense' then
    if p_amount=0 or p_amount>current_balance then raise exception 'Insufficient balance'; end if;
    delta:=-p_amount;
  else raise exception 'Invalid kind'; end if;
  insert into public.little_plan_ledger(user_id,account,kind,amount,spent_on,merchant,category)
    values(owner,p_account,p_kind,delta,p_date,btrim(p_merchant),p_category) returning id into entry_id;
  return entry_id;
end $$;
create or replace function public.little_plan_cancel_expense(p_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare owner uuid:=auth.uid();
begin
  if owner is null then raise exception 'Login required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner::text,0));
  delete from public.little_plan_ledger where id=p_id and user_id=owner and kind='expense';
  if not found then raise exception 'Expense not found'; end if;
end $$;
revoke all on function public.little_plan_record(text,bigint,date,text,text,text) from public,anon;
revoke all on function public.little_plan_cancel_expense(uuid) from public,anon;
grant execute on function public.little_plan_record(text,bigint,date,text,text,text) to authenticated;
grant execute on function public.little_plan_cancel_expense(uuid) to authenticated;
commit;
