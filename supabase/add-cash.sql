-- 현금 자금을 추가합니다. 기존 잔액과 지출 내역은 유지됩니다.
-- Supabase SQL Editor에서 파일 전체를 실행하세요. 재실행해도 됩니다.
begin;
alter table public.little_plan_ledger
  drop constraint if exists little_plan_ledger_account_check;
alter table public.little_plan_ledger
  add constraint little_plan_ledger_account_check
  check (account in ('bank','credit','paypay','cash'));
notify pgrst, 'reload schema';
commit;
