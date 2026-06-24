-- Web V1.3 用户登录与个人功能基础表
-- 执行前请确认 Supabase Auth 已开启 Phone OTP。

create extension if not exists pgcrypto;

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  phone text,
  wechat_openid text unique,
  nickname text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_plans (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null,
  title text,
  input_text text,
  recommended_village_id text,
  recommended_village_name text,
  plan_payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_favorites (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null,
  favorite_type text not null check (favorite_type in ('village', 'plan', 'poi')),
  target_id text,
  target_name text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.user_trips (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null,
  plan_id uuid,
  title text,
  trip_date date,
  status text not null default 'planned',
  payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_profiles_auth_user_id on public.user_profiles(auth_user_id);
create index if not exists idx_user_profiles_wechat_openid on public.user_profiles(wechat_openid);
create index if not exists idx_user_plans_auth_user_id_created_at on public.user_plans(auth_user_id, created_at desc);
create index if not exists idx_user_favorites_auth_user_id_created_at on public.user_favorites(auth_user_id, created_at desc);
create index if not exists idx_user_trips_auth_user_id_created_at on public.user_trips(auth_user_id, created_at desc);

alter table public.user_profiles enable row level security;
alter table public.user_plans enable row level security;
alter table public.user_favorites enable row level security;
alter table public.user_trips enable row level security;

drop policy if exists "user_profiles_select_own" on public.user_profiles;
create policy "user_profiles_select_own"
on public.user_profiles for select
using (auth.uid() = auth_user_id);

drop policy if exists "user_profiles_insert_own" on public.user_profiles;
create policy "user_profiles_insert_own"
on public.user_profiles for insert
with check (auth.uid() = auth_user_id);

drop policy if exists "user_profiles_update_own" on public.user_profiles;
create policy "user_profiles_update_own"
on public.user_profiles for update
using (auth.uid() = auth_user_id)
with check (auth.uid() = auth_user_id);

drop policy if exists "user_plans_select_own" on public.user_plans;
create policy "user_plans_select_own"
on public.user_plans for select
using (auth.uid() = auth_user_id);

drop policy if exists "user_plans_insert_own" on public.user_plans;
create policy "user_plans_insert_own"
on public.user_plans for insert
with check (auth.uid() = auth_user_id);

drop policy if exists "user_plans_update_own" on public.user_plans;
create policy "user_plans_update_own"
on public.user_plans for update
using (auth.uid() = auth_user_id)
with check (auth.uid() = auth_user_id);

drop policy if exists "user_favorites_select_own" on public.user_favorites;
create policy "user_favorites_select_own"
on public.user_favorites for select
using (auth.uid() = auth_user_id);

drop policy if exists "user_favorites_insert_own" on public.user_favorites;
create policy "user_favorites_insert_own"
on public.user_favorites for insert
with check (auth.uid() = auth_user_id);

drop policy if exists "user_favorites_delete_own" on public.user_favorites;
create policy "user_favorites_delete_own"
on public.user_favorites for delete
using (auth.uid() = auth_user_id);

drop policy if exists "user_trips_select_own" on public.user_trips;
create policy "user_trips_select_own"
on public.user_trips for select
using (auth.uid() = auth_user_id);

drop policy if exists "user_trips_insert_own" on public.user_trips;
create policy "user_trips_insert_own"
on public.user_trips for insert
with check (auth.uid() = auth_user_id);

drop policy if exists "user_trips_update_own" on public.user_trips;
create policy "user_trips_update_own"
on public.user_trips for update
using (auth.uid() = auth_user_id)
with check (auth.uid() = auth_user_id);
