create extension if not exists pgcrypto;

create table public.phone_brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint phone_brands_name_not_blank check (length(trim(name)) > 0)
);

create table public.phone_models (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.phone_brands(id) on delete restrict,
  name text not null,
  slug text not null,
  release_year smallint,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, slug),
  constraint phone_models_name_not_blank check (length(trim(name)) > 0),
  constraint phone_models_release_year_valid check (release_year is null or release_year between 1990 and 2100)
);

create table public.phone_variants (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.phone_models(id) on delete restrict,
  sku text unique,
  storage_gb integer not null,
  color text not null,
  model_number text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (model_id, storage_gb, color),
  constraint phone_variants_storage_valid check (storage_gb in (8, 16, 32, 64, 128, 256, 512, 1024, 2048)),
  constraint phone_variants_color_not_blank check (length(trim(color)) > 0)
);

-- Prices belong to the shared catalogue/pricing domain. No price rows are seeded;
-- unresolved prices must result in a quote request in the relevant workflow.
create table public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.phone_variants(id) on delete restrict,
  service_type text not null check (service_type in ('buyback', 'resale', 'repair')),
  amount_minor bigint not null check (amount_minor >= 0),
  currency char(3) not null default 'INR',
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint pricing_rules_valid_window check (valid_until is null or valid_until > valid_from)
);
create index pricing_rules_lookup_idx on public.pricing_rules (variant_id, service_type, valid_from desc) where is_active;
create index phone_models_brand_idx on public.phone_models (brand_id, is_active);
create index phone_variants_model_idx on public.phone_variants (model_id, is_active);

create function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger phone_brands_updated_at before update on public.phone_brands for each row execute function public.set_updated_at();
create trigger phone_models_updated_at before update on public.phone_models for each row execute function public.set_updated_at();
create trigger phone_variants_updated_at before update on public.phone_variants for each row execute function public.set_updated_at();

alter table public.phone_brands enable row level security;
alter table public.phone_models enable row level security;
alter table public.phone_variants enable row level security;
alter table public.pricing_rules enable row level security;

create policy "Active brands are publicly readable" on public.phone_brands for select using (is_active);
create policy "Active models are publicly readable" on public.phone_models for select using (is_active);
create policy "Active variants are publicly readable" on public.phone_variants for select using (is_active);
-- Pricing is server-only; no anon/authenticated read policy is intentionally provided.
