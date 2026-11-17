create table if not exists public.service_centres (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  address text not null check (length(trim(address)) > 0),
  city text not null check (length(trim(city)) > 0),
  state text not null check (length(trim(state)) > 0),
  postal_code text,
  phone text,
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((latitude is null) = (longitude is null))
);

create index if not exists service_centres_active_city_idx
  on public.service_centres (city, name) where is_active = true;

alter table public.service_centres enable row level security;

-- Public reads go through the server API, which selects active fields only.
-- Mutations remain restricted to trusted server-side/admin access.
revoke all on public.service_centres from anon, authenticated;
grant select, insert, update, delete on public.service_centres to service_role;
