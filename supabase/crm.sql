-- 개인 인물 노트. Supabase SQL Editor에서 전체 실행하세요. 재실행 가능합니다.
begin;
create table if not exists public.little_plan_people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  summary text not null default '' check (char_length(summary)<=2000),
  photo text not null default '' check (char_length(photo)<=250000 and (photo='' or photo ~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$')),
  created_at timestamptz not null default now(),
  unique(user_id,id)
);
create table if not exists public.little_plan_relations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  person_id uuid not null,
  related_id uuid not null,
  label text not null check (char_length(btrim(label)) between 1 and 120),
  reverse_label text not null check (char_length(btrim(reverse_label)) between 1 and 120),
  note text not null default '' check (char_length(note)<=1000),
  created_at timestamptz not null default now(),
  foreign key(user_id,person_id) references public.little_plan_people(user_id,id) on delete cascade,
  foreign key(user_id,related_id) references public.little_plan_people(user_id,id) on delete cascade,
  check(person_id<>related_id)
);
create table if not exists public.little_plan_person_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  person_id uuid not null,
  category text not null check(category in ('schedule','event','journal','info')),
  title text not null check(char_length(btrim(title)) between 1 and 200),
  body text not null default '' check(char_length(body)<=10000),
  happened_on date not null default current_date,
  created_at timestamptz not null default now(),
  foreign key(user_id,person_id) references public.little_plan_people(user_id,id) on delete cascade
);
create index if not exists little_plan_people_owner on public.little_plan_people(user_id,created_at,id);
create index if not exists little_plan_relations_owner on public.little_plan_relations(user_id,person_id,related_id);
create index if not exists little_plan_entries_owner on public.little_plan_person_entries(user_id,person_id,happened_on);
alter table public.little_plan_people enable row level security;
alter table public.little_plan_relations enable row level security;
alter table public.little_plan_person_entries enable row level security;
revoke all on public.little_plan_people,public.little_plan_relations,public.little_plan_person_entries from anon,authenticated;
grant select,delete on public.little_plan_people,public.little_plan_relations,public.little_plan_person_entries to authenticated;
grant insert(name,summary,photo),update(name,summary,photo) on public.little_plan_people to authenticated;
grant insert(person_id,related_id,label,reverse_label,note),update(label,reverse_label,note) on public.little_plan_relations to authenticated;
grant insert(person_id,category,title,body,happened_on),update(category,title,body,happened_on) on public.little_plan_person_entries to authenticated;
drop policy if exists "own people" on public.little_plan_people;
create policy "own people" on public.little_plan_people for all to authenticated
  using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
drop policy if exists "own relations" on public.little_plan_relations;
create policy "own relations" on public.little_plan_relations for all to authenticated
  using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
drop policy if exists "own person entries" on public.little_plan_person_entries;
create policy "own person entries" on public.little_plan_person_entries for all to authenticated
  using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
notify pgrst, 'reload schema';
commit;
