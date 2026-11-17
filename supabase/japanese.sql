-- 일본어 한마디: 기존 할 일·가계부 데이터는 변경하지 않습니다.
-- Supabase SQL Editor에서 파일 전체를 실행하세요. 재실행할 수 있습니다.
begin;
create table if not exists public.little_plan_japanese (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  expression text not null check(char_length(btrim(expression)) between 1 and 500),
  meaning text not null check(char_length(btrim(meaning)) between 1 and 500),
  reading text not null default '' check(char_length(reading)<=500),
  read_count bigint not null default 0 check(read_count>=0),
  created_at timestamptz not null default now()
);
create index if not exists little_plan_japanese_owner on public.little_plan_japanese(user_id,created_at,id);
alter table public.little_plan_japanese enable row level security;
revoke all on public.little_plan_japanese from anon,authenticated;
grant select on public.little_plan_japanese to authenticated;
grant insert(expression,meaning,reading) on public.little_plan_japanese to authenticated;
drop policy if exists "read own japanese" on public.little_plan_japanese;
create policy "read own japanese" on public.little_plan_japanese for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists "create own japanese" on public.little_plan_japanese;
create policy "create own japanese" on public.little_plan_japanese for insert to authenticated with check ((select auth.uid())=user_id);
create or replace function public.little_plan_read_japanese(p_id uuid)
returns setof public.little_plan_japanese language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Login required'; end if;
  return query update public.little_plan_japanese set read_count=read_count+1
    where id=p_id and user_id=auth.uid() returning *;
  if not found then raise exception 'Expression not found'; end if;
end $$;
revoke all on function public.little_plan_read_japanese(uuid) from public,anon;
grant execute on function public.little_plan_read_japanese(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
