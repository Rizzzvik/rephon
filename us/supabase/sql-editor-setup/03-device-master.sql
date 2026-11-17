-- REPHON 24X7 Supabase SQL Editor bundle
-- Fresh project only: run these bundles in numeric order.
-- Do not run these on a project where any original migrations have already been applied.

-- ===== Original migration: 202611090001_phase4_device_master.sql =====

-- Phase 4 extends the existing phone_brands -> phone_models -> phone_variants
-- identity tree. No duplicate brand or service-specific catalogues are created.

alter table public.phone_brands
  add column if not exists brand_logo_url text,
  add column if not exists brand_website text,
  add column if not exists country_of_origin text,
  add column if not exists verification_status text not null default 'needs_review';
alter table public.phone_models
  add column if not exists launch_date date,
  add column if not exists external_source_key text,
  add column if not exists external_slug text,
  add column if not exists specifications_updated_at timestamptz;
alter table public.phone_variants
  add column if not exists variant_description text,
  add column if not exists external_slug text;
-- Existing active master brands are curated records; retain their allocations
-- and mark them verified so customer selectors continue to work after upgrade.
update public.phone_brands set verification_status=case when status=1 and is_active then 'verified' else 'inactive' end
where verification_status='needs_review';
alter table public.phone_brands drop constraint if exists phone_brands_verification_status_check;
alter table public.phone_brands add constraint phone_brands_verification_status_check
  check (verification_status in ('draft','needs_review','verified','rejected','inactive'));
alter table public.phone_brands drop constraint if exists phone_brands_brand_website_https_check;
alter table public.phone_brands add constraint phone_brands_brand_website_https_check
  check (brand_website is null or brand_website ~ '^https://');
create index if not exists phone_models_search_name_idx on public.phone_models using gin (to_tsvector('simple', coalesce(name,'')));
create index if not exists phone_variants_catalogue_search_idx on public.phone_variants(model_id, storage_gb, ram_gb, color) where status=1 and is_active;
create index if not exists phone_models_verified_brand_idx on public.phone_models(brand_id,name) where status=1 and is_active and verification_status='verified';

-- Permanent allocation ledgers preserve used codes even if catalogue rows are
-- later deactivated. Foreign keys deliberately prevent deleting allocated rows.
create table if not exists public.brand_code_allocations (
  brand_code char(2) primary key check (brand_code ~ '^[0-9]{2}$'),
  brand_id uuid not null unique references public.phone_brands(id) on delete restrict,
  allocated_at timestamptz not null default now()
);
create table if not exists public.model_code_allocations (
  brand_id uuid not null references public.phone_brands(id) on delete restrict,
  model_code char(3) not null check (model_code ~ '^[0-9]{3}$'),
  model_id uuid not null unique references public.phone_models(id) on delete restrict,
  allocated_at timestamptz not null default now(),
  primary key (brand_id, model_code)
);
create table if not exists public.device_code_allocations (
  brand_code char(2) not null check (brand_code ~ '^[0-9]{2}$'),
  model_code char(3) not null check (model_code ~ '^[0-9]{3}$'),
  variant_code char(2) not null check (variant_code ~ '^[0-9]{2}$'),
  device_code char(7) not null unique check (device_code ~ '^[0-9]{7}$'),
  variant_id uuid not null unique references public.phone_variants(id) on delete restrict,
  allocated_at timestamptz not null default now(),
  primary key (brand_code, model_code, variant_code),
  check (device_code = brand_code || model_code || variant_code)
);
do $$ begin
  if exists(select 1 from public.phone_brands where brand_code is not null and brand_code !~ '^[0-9]{2}$') then
    raise exception 'Phase 4 blocked: an allocated brand code is not two digits';
  end if;
  if exists(select brand_code from public.phone_brands where brand_code is not null group by brand_code having count(*)>1) then
    raise exception 'Phase 4 blocked: duplicate universal brand codes exist';
  end if;
  if exists(select 1 from public.phone_models where model_code is not null and model_code !~ '^[0-9]{3}$') then
    raise exception 'Phase 4 blocked: a model code is not three digits';
  end if;
  if exists(select brand_id,model_code from public.phone_models where model_code is not null group by brand_id,model_code having count(*)>1) then
    raise exception 'Phase 4 blocked: a brand has duplicate model codes';
  end if;
  if exists(select 1 from public.phone_variants where variant_code is not null and variant_code !~ '^[0-9]{2}$') then
    raise exception 'Phase 4 blocked: a variant code is not two digits';
  end if;
  if exists(select model_id,variant_code from public.phone_variants where variant_code is not null group by model_id,variant_code having count(*)>1) then
    raise exception 'Phase 4 blocked: a model has duplicate variant codes';
  end if;
  if exists(select 1 from public.phone_variants where device_code is not null and device_code !~ '^[0-9]{7}$') then
    raise exception 'Phase 4 blocked: a device code is not seven digits';
  end if;
  if exists(
    select 1 from public.phone_variants v
    join public.phone_models m on m.id=v.model_id
    join public.phone_brands b on b.id=m.brand_id
    where v.device_code is not null and (b.brand_code is null or m.model_code is null or v.variant_code is null
      or v.device_code <> b.brand_code || m.model_code || v.variant_code)
  ) then raise exception 'Phase 4 blocked: a device code does not match its allocated master identifiers'; end if;
end $$;
insert into public.brand_code_allocations(brand_code,brand_id)
select brand_code,id from public.phone_brands where brand_code is not null
on conflict do nothing;
insert into public.model_code_allocations(brand_id,model_code,model_id)
select brand_id,model_code,id from public.phone_models where model_code is not null
on conflict do nothing;
insert into public.device_code_allocations(brand_code,model_code,variant_code,device_code,variant_id)
select b.brand_code,m.model_code,v.variant_code,v.device_code,v.id
from public.phone_variants v join public.phone_models m on m.id=v.model_id
join public.phone_brands b on b.id=m.brand_id
where b.brand_code is not null and m.model_code is not null and v.variant_code is not null and v.device_code is not null
on conflict do nothing;

create or replace function public.protect_brand_code_allocation() returns trigger language plpgsql as $$
begin
  if tg_op='UPDATE' and old.brand_code is not null and new.brand_code is distinct from old.brand_code then
    raise exception 'Allocated brand codes are permanent';
  end if;
  if new.brand_code is not null then
    insert into public.brand_code_allocations(brand_code,brand_id) values(new.brand_code,new.id)
    on conflict (brand_code) do nothing;
    if not exists(select 1 from public.brand_code_allocations where brand_code=new.brand_code and brand_id=new.id) then
      raise exception 'Brand code is already allocated';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists phone_brand_code_allocation_guard on public.phone_brands;
create trigger phone_brand_code_allocation_guard before insert or update of brand_code on public.phone_brands
for each row execute function public.protect_brand_code_allocation();

create or replace function public.protect_model_code_allocation() returns trigger language plpgsql as $$
declare v_brand_code char(2);
begin
  if tg_op='UPDATE' and (new.brand_id is distinct from old.brand_id or new.model_code is distinct from old.model_code) then
    raise exception 'Allocated model identity is permanent';
  end if;
  if new.model_code is not null then
    select brand_code into v_brand_code from public.phone_brands where id=new.brand_id;
    if v_brand_code is null then raise exception 'A model requires an allocated brand code'; end if;
    insert into public.model_code_allocations(brand_id,model_code,model_id) values(new.brand_id,new.model_code,new.id)
    on conflict (brand_id,model_code) do nothing;
    if not exists(select 1 from public.model_code_allocations where brand_id=new.brand_id and model_code=new.model_code and model_id=new.id) then
      raise exception 'Model code is already allocated for this brand';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists phone_model_code_allocation_guard on public.phone_models;
create trigger phone_model_code_allocation_guard before insert or update of brand_id,model_code on public.phone_models
for each row execute function public.protect_model_code_allocation();

create or replace function public.protect_device_code_allocation() returns trigger language plpgsql as $$
declare v_brand_code char(2);v_model_code char(3);
begin
  if tg_op='UPDATE' and (new.model_id is distinct from old.model_id or new.variant_code is distinct from old.variant_code or new.device_code is distinct from old.device_code) then
    raise exception 'Allocated variant identity is permanent';
  end if;
  if new.device_code is not null then
    select b.brand_code,m.model_code into v_brand_code,v_model_code from public.phone_models m join public.phone_brands b on b.id=m.brand_id where m.id=new.model_id;
    if v_brand_code is null or v_model_code is null or new.variant_code is null then raise exception 'A device code requires permanent brand, model and variant codes'; end if;
    if new.device_code <> v_brand_code || v_model_code || new.variant_code then raise exception 'Device code must match its master brand/model/variant codes'; end if;
    insert into public.device_code_allocations(brand_code,model_code,variant_code,device_code,variant_id)
    values(v_brand_code,v_model_code,new.variant_code,new.device_code,new.id) on conflict do nothing;
    if not exists(select 1 from public.device_code_allocations where device_code=new.device_code and variant_id=new.id) then raise exception 'Device code is already allocated'; end if;
  end if;
  return new;
end; $$;
drop trigger if exists phone_variant_code_allocation_guard on public.phone_variants;
create trigger phone_variant_code_allocation_guard before insert or update of model_id,variant_code,device_code on public.phone_variants
for each row execute function public.protect_device_code_allocation();

create table if not exists public.device_specification_categories (
  category_key text primary key check(category_key ~ '^[a-z][a-z0-9_]{1,50}$'),
  category_name text not null,
  display_order smallint not null default 0,
  active boolean not null default true
);
insert into public.device_specification_categories(category_key,category_name,display_order) values
 ('general','General',10),('display','Display',20),('platform','Performance',30),('memory','Memory',40),
 ('main_camera','Rear camera',50),('selfie_camera','Front camera',60),('sound','Audio',70),
 ('communications','Connectivity',80),('battery','Battery',90),('features','Features',100),('misc','Other',110)
on conflict(category_key) do nothing;

create table if not exists public.device_specification_sources (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  source_url text,
  external_slug text,
  model_id uuid not null references public.phone_models(id) on delete restrict,
  variant_id uuid references public.phone_variants(id) on delete restrict,
  retrieved_at timestamptz not null default now(),
  verification_status text not null default 'pending_review' check(verification_status in ('imported','pending_review','verified','rejected','inactive')),
  verification_method text,
  confidence numeric(4,3) check(confidence is null or confidence between 0 and 1),
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  raw_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists device_spec_sources_model_idx on public.device_specification_sources(model_id,retrieved_at desc);

create table if not exists public.device_specifications (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.phone_models(id) on delete restrict,
  variant_id uuid references public.phone_variants(id) on delete restrict,
  category_key text not null references public.device_specification_categories(category_key) on update cascade on delete restrict,
  specification_key text not null check(specification_key ~ '^[a-z][a-z0-9_]{1,80}$'),
  label text not null,
  value_text text not null check(length(trim(value_text))>0),
  source_value text,
  source_id uuid references public.device_specification_sources(id) on delete set null,
  verification_status text not null default 'pending_review' check(verification_status in ('imported','pending_review','verified','rejected','inactive')),
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists device_specs_model_key_unique on public.device_specifications(model_id,specification_key) where variant_id is null;
create unique index if not exists device_specs_variant_key_unique on public.device_specifications(variant_id,specification_key) where variant_id is not null;
create index if not exists device_specs_public_lookup on public.device_specifications(model_id,category_key,sort_order) where verification_status='verified';

create table if not exists public.external_device_source_registry (
  source_key text primary key check(source_key ~ '^[a-z][a-z0-9_-]{2,50}$'),
  source_name text not null,
  base_url text not null,
  usage_review_status text not null default 'review_required' check(usage_review_status in ('review_required','approved','blocked')),
  is_enabled boolean not null default false,
  last_health_check timestamptz,
  last_health_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.external_device_source_registry(source_key,source_name,base_url,usage_review_status,is_enabled)
values('mobile-specs-api','Mobile Specs API','https://github.com/RevengerNick/mobile-specs-api','review_required',false)
on conflict(source_key) do nothing;

create table if not exists public.external_brand_mappings (
  source_key text not null references public.external_device_source_registry(source_key) on delete restrict,
  external_brand_slug text not null,
  brand_id uuid not null references public.phone_brands(id) on delete restrict,
  external_name text,
  last_seen_at timestamptz not null default now(),
  primary key(source_key,external_brand_slug),
  unique(source_key,brand_id)
);
create table if not exists public.external_model_mappings (
  id uuid primary key default gen_random_uuid(),
  source_key text not null references public.external_device_source_registry(source_key) on delete restrict,
  external_slug text not null,
  external_name text not null,
  external_brand_slug text,
  model_id uuid references public.phone_models(id) on delete restrict,
  review_status text not null default 'pending_review' check(review_status in ('pending_review','matched','approved','rejected')),
  last_seen_at timestamptz not null default now(),
  external_data jsonb not null default '{}'::jsonb,
  unique(source_key,external_slug)
);
create index if not exists external_models_name_search on public.external_model_mappings using gin(to_tsvector('simple',external_name));

create table if not exists public.device_import_jobs (
  id uuid primary key default gen_random_uuid(),
  source_key text not null references public.external_device_source_registry(source_key) on delete restrict,
  job_type text not null check(job_type in ('brand_list','brand_models','search','details','scheduled_refresh')),
  query text,
  job_status text not null default 'pending' check(job_status in ('pending','running','completed','failed','cancelled')),
  result_count integer not null default 0,
  requested_by uuid references auth.users(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  error_summary text,
  result_cache jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists device_import_jobs_time_idx on public.device_import_jobs(created_at desc);
create table if not exists public.device_import_errors (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.device_import_jobs(id) on delete cascade,
  external_slug text,
  error_code text,
  message text not null,
  source_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.create_pending_external_model(
  p_brand_code text,p_model_name text,p_model_slug text,p_external_slug text,p_source_key text,p_raw_data jsonb,p_launch_year smallint default null
)
returns table(model_id uuid,model_code char(3),brand_id uuid)
language plpgsql security definer set search_path=public as $$
declare v_brand_id uuid;v_code char(3);v_slug text;v_model_id uuid;v_source_id uuid;
begin
  if p_model_name is null or length(trim(p_model_name))<2 or length(trim(p_model_name))>160 then raise exception 'A valid model name is required'; end if;
  if p_external_slug is null or length(p_external_slug)>200 or p_external_slug !~ '^[a-zA-Z0-9_-]+$' then raise exception 'A valid external slug is required'; end if;
  if p_source_key is distinct from 'mobile-specs-api' then raise exception 'Unsupported device source'; end if;
  select id into v_brand_id from public.phone_brands where brand_code=lpad(trim(p_brand_code),2,'0') and status=1 and is_active;
  if v_brand_id is null then raise exception 'Choose an active universal brand'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_brand_id::text,4));
  if exists(select 1 from public.phone_models where brand_id=v_brand_id and lower(trim(name))=lower(trim(p_model_name))) then raise exception 'A model with this name already exists for the selected brand'; end if;
  v_slug:=lower(regexp_replace(trim(coalesce(p_model_slug,p_model_name)),'[^a-zA-Z0-9]+','-','g'));
  v_slug:=trim(both '-' from v_slug);
  for i in 1..999 loop
    v_code:=lpad(i::text,3,'0');
    if not exists(select 1 from public.model_code_allocations where brand_id=v_brand_id and model_code=v_code) then exit; end if;
    v_code:=null;
  end loop;
  if v_code is null then raise exception 'No model codes remain for this brand'; end if;
  insert into public.phone_models(brand_id,model_code,name,slug,release_year,device_type,specifications_json,verification_status,status,is_active,source_reference,external_source_key,external_slug)
  values(v_brand_id,v_code,trim(p_model_name),left(v_slug,180),p_launch_year,'smartphone','{}'::jsonb,'needs_review',0,false,p_external_slug,p_source_key,p_external_slug)
  returning id into v_model_id;
  insert into public.device_specification_sources(source_name,source_url,external_slug,model_id,retrieved_at,verification_status,verification_method,raw_response)
  values(p_source_key,'https://github.com/RevengerNick/mobile-specs-api',p_external_slug,v_model_id,now(),'pending_review','admin_external_import',coalesce(p_raw_data,'{}'::jsonb))
  returning id into v_source_id;
  insert into public.external_model_mappings(source_key,external_slug,external_name,external_brand_slug,model_id,review_status,last_seen_at,external_data)
  values(p_source_key,p_external_slug,trim(p_model_name),null,v_model_id,'pending_review',now(),coalesce(p_raw_data,'{}'::jsonb))
  on conflict(source_key,external_slug) do update set external_name=excluded.external_name,model_id=excluded.model_id,review_status='pending_review',last_seen_at=now(),external_data=excluded.external_data;
  return query select v_model_id,v_code,v_brand_id;
end; $$;
revoke all on function public.create_pending_external_model(text,text,text,text,text,jsonb,smallint) from public,anon,authenticated;
grant execute on function public.create_pending_external_model(text,text,text,text,text,jsonb,smallint) to service_role;

-- One editable brand profile keeps website/system branding in a single place.
create table if not exists public.brand_settings (
  setting_key text primary key check(setting_key='default'),
  business_name text not null default 'REPHON 24X7',
  logo_url text,
  support_phone text,
  support_email text,
  whatsapp_phone text,
  website_url text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.brand_settings(setting_key,business_name) values('default','REPHON 24X7') on conflict do nothing;

do $$ declare t text; begin
  foreach t in array array['brand_code_allocations','model_code_allocations','device_code_allocations','device_specification_categories','device_specification_sources','device_specifications','external_device_source_registry','external_brand_mappings','external_model_mappings','device_import_jobs','device_import_errors','brand_settings'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;
create policy "Verified device specifications are readable" on public.device_specifications
  for select using (verification_status='verified');
grant select on public.device_specifications,public.device_specification_categories,public.device_specification_sources to anon,authenticated;

comment on table public.phone_brands is 'Universal brand registry; brand_code allocations are permanent and shared by all service modules.';
comment on table public.device_specifications is 'Normalized model/variant specifications. Only verified values are customer-readable.';
comment on table public.device_specification_sources is 'Source URL, retrieval date, raw source response and verification provenance for device specifications.';
comment on table public.device_code_allocations is 'Permanent seven-digit BBMMM VV device-code ledger; never recycle allocated codes.';

-- Fix: the ledger trigger must run after the parent brand row exists.
drop trigger if exists phone_brand_code_allocation_guard on public.phone_brands;
create trigger phone_brand_code_allocation_guard
after insert or update of brand_code on public.phone_brands
for each row execute function public.protect_brand_code_allocation();

-- Apply the same post-insert ordering to model and variant identity ledgers.
drop trigger if exists phone_model_code_allocation_guard on public.phone_models;
create trigger phone_model_code_allocation_guard
after insert or update of brand_id,model_code on public.phone_models
for each row execute function public.protect_model_code_allocation();

drop trigger if exists phone_variant_code_allocation_guard on public.phone_variants;
create trigger phone_variant_code_allocation_guard
after insert or update of model_id,variant_code,device_code on public.phone_variants
for each row execute function public.protect_device_code_allocation();
