create extension if not exists "pgcrypto";

create table if not exists villages (
  id uuid primary key default gen_random_uuid(),
  village_code text unique not null,
  name text not null,
  province text not null,
  city text not null,
  district text not null,
  town text,
  village text,
  full_name text not null,
  place_level text,
  rating text,
  distance_text text,
  description text,
  visit_duration text,
  intensity text,
  source_confidence text,
  data_status text,
  data_review_status text,
  review_notes text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists village_profiles (
  id uuid primary key default gen_random_uuid(),
  village_id uuid not null references villages(id) on delete cascade,
  tags text[],
  suitable_for text[],
  match_keywords text[],
  recommended_transport text[],
  elder_friendly boolean default false,
  kid_friendly boolean default false,
  photo_friendly boolean default false,
  food_friendly boolean default false,
  culture_friendly boolean default false,
  wellness_friendly boolean default false,
  self_drive_friendly boolean default false,
  public_transport_friendly boolean default false
);

create table if not exists village_designations (
  id uuid primary key default gen_random_uuid(),
  village_id uuid not null references villages(id) on delete cascade,
  designation_type text not null,
  source_name text not null,
  source_index int,
  note text
);

create table if not exists village_routes (
  id uuid primary key default gen_random_uuid(),
  village_id uuid not null references villages(id) on delete cascade,
  title text not null,
  subtitle text,
  icon text,
  sort_order int default 0
);

create table if not exists village_foods (
  id uuid primary key default gen_random_uuid(),
  village_id uuid not null references villages(id) on delete cascade,
  name text not null,
  "desc" text,
  price_text text,
  tag text,
  sort_order int default 0
);

create table if not exists village_stays (
  id uuid primary key default gen_random_uuid(),
  village_id uuid not null references villages(id) on delete cascade,
  name text not null,
  "desc" text,
  price_text text,
  tag text,
  sort_order int default 0
);

create index if not exists idx_villages_village_code on villages(village_code);
create index if not exists idx_villages_city on villages(city);
create index if not exists idx_villages_district on villages(district);
create index if not exists idx_villages_place_level on villages(place_level);

create index if not exists idx_village_profiles_village_id on village_profiles(village_id);
create index if not exists idx_village_profiles_elder_friendly on village_profiles(elder_friendly);
create index if not exists idx_village_profiles_kid_friendly on village_profiles(kid_friendly);
create index if not exists idx_village_profiles_photo_friendly on village_profiles(photo_friendly);
create index if not exists idx_village_profiles_food_friendly on village_profiles(food_friendly);
create index if not exists idx_village_profiles_culture_friendly on village_profiles(culture_friendly);
create index if not exists idx_village_profiles_self_drive_friendly on village_profiles(self_drive_friendly);

create index if not exists idx_village_designations_village_id on village_designations(village_id);
create index if not exists idx_village_routes_village_id on village_routes(village_id);
create index if not exists idx_village_foods_village_id on village_foods(village_id);
create index if not exists idx_village_stays_village_id on village_stays(village_id);
