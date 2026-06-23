-- V1.3 village geo and POI schema extension
-- Run this file in Supabase SQL Editor after V0.8/V0.9 base schema exists.

create extension if not exists "pgcrypto";

alter table public.villages
add column if not exists address text,
add column if not exists latitude double precision,
add column if not exists longitude double precision,
add column if not exists adcode text,
add column if not exists amap_poi_id text,
add column if not exists geo_source text,
add column if not exists geo_review_status text default 'needs_review',
add column if not exists geo_review_notes text[];

create table if not exists public.village_pois (
  id uuid primary key default gen_random_uuid(),
  village_id uuid references public.villages(id) on delete cascade,
  poi_id text not null,
  source text default 'amap',
  category text not null,
  name text not null,
  address text,
  latitude double precision,
  longitude double precision,
  distance_meters integer,
  distance_text text,
  type_text text,
  tel text,
  rating text,
  price_text text,
  raw jsonb,
  is_recommended boolean default false,
  data_review_status text default 'needs_review',
  review_notes text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(village_id, poi_id, category)
);

create index if not exists idx_villages_adcode on public.villages(adcode);
create index if not exists idx_villages_geo_review_status on public.villages(geo_review_status);
create index if not exists idx_village_pois_village_id on public.village_pois(village_id);
create index if not exists idx_village_pois_category on public.village_pois(category);
create index if not exists idx_village_pois_review_status on public.village_pois(data_review_status);
create index if not exists idx_village_pois_recommended on public.village_pois(is_recommended);
