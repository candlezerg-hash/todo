-- Supabase SQL Editor에서 새 프로젝트에 한 번 실행하세요.
-- 기존 little_plan_tasks가 있으면 덮어쓰지 않고 오류로 중단합니다.
begin;

create table public.little_plan_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  task_date date not null,
  text text not null check (
    char_length(text) between 1 and 120 and char_length(btrim(text)) > 0
  ),
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index little_plan_tasks_owner_date_idx
  on public.little_plan_tasks(user_id, task_date, created_at, id);

alter table public.little_plan_tasks enable row level security;
revoke all on public.little_plan_tasks from anon;
grant select, insert, update, delete
  on public.little_plan_tasks to authenticated;

create policy "read own tasks"
on public.little_plan_tasks for select to authenticated
using ((select auth.uid()) = user_id);

create policy "create own tasks"
on public.little_plan_tasks for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "update own tasks"
on public.little_plan_tasks for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "delete own tasks"
on public.little_plan_tasks for delete to authenticated
using ((select auth.uid()) = user_id);

commit;
