-- Phase 3 operational foundation. Additive to the existing catalogue and
-- questionnaire tables so current customer journeys keep their data.

alter table public.staff_roles drop constraint if exists staff_roles_role_check;
alter table public.staff_roles add constraint staff_roles_role_check check(role in ('admin','super_admin','sales_admin','repair_admin','catalogue_manager','inventory_manager','location_manager','support_agent','inspector'));

-- Six-digit public request codes are random references, never auth credentials.
-- The ledger intentionally has no cascading delete: retired codes stay reserved.
create table if not exists public.request_code_reservations (
  request_code char(6) primary key check (request_code ~ '^[0-9]{6}$'),
  reserved_at timestamptz not null default now()
);

create or replace function public.reserve_request_code()
returns char(6) language plpgsql security definer set search_path=public as $$
declare
  v_code char(6);
  v_value bigint;
  v_attempt integer;
  v_bytes bytea;
begin
  for v_attempt in 1..100 loop
    v_bytes:=decode(substr(gen_random_uuid()::text,1,8),'hex');
    v_value := (
      get_byte(v_bytes,0)::bigint * 16777216 +
      get_byte(v_bytes,1)::bigint * 65536 +
      get_byte(v_bytes,2)::bigint * 256 +
      get_byte(v_bytes,3)::bigint
    ) % 1000000;
    v_code := lpad(v_value::text,6,'0')::char(6);
    insert into public.request_code_reservations(request_code)
      values (v_code) on conflict do nothing;
    if found then return v_code; end if;
  end loop;
  raise exception 'Unable to allocate a unique request code';
end;
$$;
revoke all on function public.reserve_request_code() from public, anon, authenticated;
grant execute on function public.reserve_request_code() to service_role;

create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  request_code char(6) not null unique references public.request_code_reservations(request_code) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  request_type text not null check (request_type in ('buy','sell','repair','doorstep','callback')),
  request_source text not null default 'website' check (request_source in ('website','whatsapp','admin','callback','other')),
  questionnaire_submission_id uuid unique references public.questionnaire_submissions(id) on delete set null,
  device_code char(7) references public.phone_variants(device_code) on update cascade on delete set null,
  status text not null default 'submitted' check (status in ('initiated','otp_verified','submitted','under_review','contacted','quotation_sent','awaiting_customer','confirmed','assigned','in_progress','completed','cancelled','rejected')),
  request_details jsonb not null default '{}'::jsonb,
  idempotency_key text unique,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists service_requests_created_idx on public.service_requests(created_at desc);
create index if not exists service_requests_customer_idx on public.service_requests(customer_id,created_at desc);
create index if not exists service_requests_work_queue_idx on public.service_requests(request_type,status,created_at desc);
create unique index if not exists service_requests_whatsapp_conversation_unique
  on public.service_requests((request_details->>'conversationId'))
  where request_source='whatsapp' and request_type='callback' and request_details ? 'conversationId';

create table if not exists public.request_status_history (
  id bigint generated always as identity primary key,
  service_request_id uuid not null references public.service_requests(id) on delete restrict,
  previous_status text,
  new_status text not null,
  changed_by uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists request_status_history_request_idx on public.request_status_history(service_request_id,created_at);

create table if not exists public.request_assignments (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references public.service_requests(id) on delete restrict,
  staff_user_id uuid references auth.users(id) on delete set null,
  provider_code text references public.service_providers(provider_code) on update cascade on delete restrict,
  assigned_by uuid references auth.users(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (staff_user_id is not null or provider_code is not null)
);
create unique index if not exists request_assignments_one_active_staff
  on public.request_assignments(service_request_id,staff_user_id) where active and staff_user_id is not null;
create unique index if not exists request_assignments_one_active_provider
  on public.request_assignments(service_request_id,provider_code) where active and provider_code is not null;

create table if not exists public.request_notes (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references public.service_requests(id) on delete restrict,
  author_id uuid references auth.users(id) on delete set null,
  note text not null check(length(trim(note)) between 1 and 5000),
  is_internal boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists request_notes_request_idx on public.request_notes(service_request_id,created_at desc);
create or replace function public.admin_update_service_request(p_request_id uuid,p_status text,p_staff_user_id uuid,p_note text default null)
returns table(id uuid,request_code char(6),status text,updated_at timestamptz)
language plpgsql security definer set search_path=public as $$
declare v_previous text;
begin
  if p_status not in ('initiated','otp_verified','submitted','under_review','contacted','quotation_sent','awaiting_customer','confirmed','assigned','in_progress','completed','cancelled','rejected') then
    raise exception 'Invalid request status';
  end if;
  if p_note is not null and length(trim(p_note))>5000 then raise exception 'Note is too long'; end if;
  select sr.status into v_previous from public.service_requests sr where sr.id=p_request_id for update;
  if not found then raise exception 'Request not found'; end if;
  return query update public.service_requests sr set status=p_status,updated_by=p_staff_user_id
    where sr.id=p_request_id returning sr.id,sr.request_code,sr.status,sr.updated_at;
  if p_note is not null and length(trim(p_note))>0 then
    insert into public.request_notes(service_request_id,author_id,note,is_internal) values(p_request_id,p_staff_user_id,trim(p_note),true);
  end if;
  insert into public.activity_logs(actor_id,entity_type,entity_id,action,details)
  values(p_staff_user_id,'service_request',p_request_id,'request_updated',jsonb_build_object('previousStatus',v_previous,'newStatus',p_status,'noteAdded',p_note is not null and length(trim(p_note))>0));
end;
$$;
revoke all on function public.admin_update_service_request(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.admin_update_service_request(uuid,text,uuid,text) to service_role;

create or replace function public.log_service_request_change()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    insert into public.request_status_history(service_request_id,new_status)
      values(new.id,new.status);
    return new;
  end if;
  if new.status is distinct from old.status then
    insert into public.request_status_history(service_request_id,previous_status,new_status,changed_by)
      values(new.id,old.status,new.status,new.updated_by);
    if new.questionnaire_submission_id is not null then
      update public.questionnaire_submissions
      set status=case
        when new.status in ('initiated','otp_verified','submitted') then 'submitted'
        when new.status in ('under_review','contacted','assigned','in_progress') then 'under_review'
        when new.status in ('quotation_sent','awaiting_customer') then 'quoted'
        when new.status='confirmed' then 'booked'
        when new.status in ('completed','rejected') then 'closed'
        when new.status='cancelled' then 'cancelled'
        else status end,
        updated_at=now()
      where id=new.questionnaire_submission_id;
    end if;
  end if;
  new.updated_at=now();
  return new;
end;
$$;
drop trigger if exists service_requests_change_log on public.service_requests;
create trigger service_requests_change_log after insert or update on public.service_requests
  for each row execute function public.log_service_request_change();

-- Link existing Buy/Sell/Repair submissions to the shared request table and
-- automatically link future website submissions. Legacy reference values stay intact.
do $$
declare r record; v_code char(6); v_request_id uuid;
begin
  for r in select * from public.questionnaire_submissions q
    where not exists (select 1 from public.service_requests s where s.questionnaire_submission_id=q.id)
    order by q.created_at,q.id
  loop
    v_code:=public.reserve_request_code();
    insert into public.service_requests(request_code,customer_id,request_type,request_source,questionnaire_submission_id,device_code,status,request_details)
    values(v_code,r.customer_id,r.journey,'website',r.id,r.device_code,
      case r.status when 'under_review' then 'under_review' when 'needs_quote' then 'under_review' when 'quoted' then 'quotation_sent' when 'booked' then 'confirmed' when 'closed' then 'completed' when 'cancelled' then 'cancelled' else 'submitted' end,
      coalesce(r.normalized_answers,'{}'::jsonb)) returning id into v_request_id;
  end loop;
end;
$$;

create or replace function public.create_service_request_for_submission()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_code char(6);
begin
  v_code:=public.reserve_request_code();
  insert into public.service_requests(request_code,customer_id,request_type,request_source,questionnaire_submission_id,device_code,request_details)
  values(v_code,new.customer_id,new.journey,'website',new.id,new.device_code,coalesce(new.normalized_answers,'{}'::jsonb));
  return new;
end;
$$;
drop trigger if exists questionnaire_submission_create_service_request on public.questionnaire_submissions;
create trigger questionnaire_submission_create_service_request after insert on public.questionnaire_submissions
  for each row execute function public.create_service_request_for_submission();

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  label text,
  address text not null,
  area text,
  city text not null,
  state text,
  pin_code text,
  landmark text,
  latitude double precision check(latitude is null or latitude between -90 and 90),
  longitude double precision check(longitude is null or longitude between -180 and 180),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check((latitude is null)=(longitude is null))
);
create index if not exists customer_addresses_customer_idx on public.customer_addresses(customer_id);

create table if not exists public.customer_consents (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  purpose text not null check(purpose in ('service_updates','marketing','location','privacy_policy')),
  granted boolean not null,
  policy_version text,
  source text not null default 'website',
  captured_at timestamptz not null default now(),
  revoked_at timestamptz
);
alter table public.customers add column if not exists phone_verified_at timestamptz;
alter table public.customers add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;
alter table public.customers add column if not exists last_login_at timestamptz;
alter table public.customers add column if not exists account_status text not null default 'active' check(account_status in ('active','blocked','deleted'));

-- Supabase Auth owns OTP generation/storage. This table stores only keyed
-- rate-limit fingerprints, never phone numbers or OTP values.
create table if not exists public.customer_otp_send_events (
  id bigint generated always as identity primary key,
  phone_hash text not null,
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists customer_otp_send_phone_time_idx on public.customer_otp_send_events(phone_hash,created_at desc);
create index if not exists customer_otp_send_ip_time_idx on public.customer_otp_send_events(ip_hash,created_at desc);
create or replace function public.reserve_customer_otp_send(p_phone_hash text,p_ip_hash text)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_now timestamptz:=now();
begin
  if length(p_phone_hash)<>64 or length(p_ip_hash)<>64 then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_phone_hash,0));
  if exists(select 1 from public.customer_otp_send_events e where e.phone_hash=p_phone_hash and e.created_at>v_now-interval '60 seconds') then return false; end if;
  if (select count(*) from public.customer_otp_send_events e where e.phone_hash=p_phone_hash and e.created_at>v_now-interval '1 hour')>=5 then return false; end if;
  if (select count(*) from public.customer_otp_send_events e where e.ip_hash=p_ip_hash and e.created_at>v_now-interval '1 hour')>=20 then return false; end if;
  insert into public.customer_otp_send_events(phone_hash,ip_hash,created_at) values(p_phone_hash,p_ip_hash,v_now);
  delete from public.customer_otp_send_events where created_at<v_now-interval '2 days';
  return true;
end;
$$;
revoke all on function public.reserve_customer_otp_send(text,text) from public,anon,authenticated;
grant execute on function public.reserve_customer_otp_send(text,text) to service_role;

create table if not exists public.doorstep_bookings (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null unique references public.service_requests(id) on delete restrict,
  service_type text not null,
  address text not null,
  area text,
  city text not null,
  pin_code text,
  landmark text,
  latitude double precision check(latitude is null or latitude between -90 and 90),
  longitude double precision check(longitude is null or longitude between -180 and 180),
  preferred_date date not null,
  preferred_time_slot text not null,
  additional_details text,
  provider_code text references public.service_providers(provider_code) on update cascade on delete restrict,
  booking_status text not null default 'requested' check(booking_status in ('requested','awaiting_confirmation','confirmed','assigned','in_progress','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check((latitude is null)=(longitude is null))
);

-- Extend existing service-centre/provider records rather than maintaining a
-- second source of location truth.
alter table public.service_centres add column if not exists area text;
alter table public.service_centres add column if not exists whatsapp_phone text;
alter table public.service_centres add column if not exists opening_hours jsonb not null default '{}'::jsonb;
alter table public.service_centres add column if not exists services text[] not null default '{}';
alter table public.service_centres add column if not exists photo_url text;
alter table public.service_centres add column if not exists is_demo boolean not null default false;
alter table public.service_providers add column if not exists latitude double precision check(latitude is null or latitude between -90 and 90);
alter table public.service_providers add column if not exists longitude double precision check(longitude is null or longitude between -180 and 180);
alter table public.service_providers add column if not exists is_demo boolean not null default false;
alter table public.service_providers add column if not exists brands_supported text[] not null default '{}';
alter table public.service_providers add column if not exists opening_hours jsonb not null default '{}'::jsonb;
create table if not exists public.provider_brand_coverage (
  provider_code text not null references public.service_providers(provider_code) on update cascade on delete cascade,
  brand_code char(2) not null references public.phone_brands(brand_code) on update cascade on delete restrict,
  created_at timestamptz not null default now(),
  primary key(provider_code,brand_code)
);

create table if not exists public.repair_components (
  component_code text primary key,
  component_name text not null,
  related_issue_code text references public.repair_issues(issue_code) on update cascade on delete set null,
  pricing_basis text,
  notes text,
  status smallint not null default 1 check(status in (0,1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.repair_component_price_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text unique,
  device_code char(7) not null references public.phone_variants(device_code) on update cascade on delete restrict,
  component_code text not null references public.repair_components(component_code) on update cascade on delete restrict,
  part_number_or_description text,
  part_grade text,
  part_cost_inr numeric(12,2),
  labour_cost_inr numeric(12,2),
  logistics_cost_inr numeric(12,2),
  margin_inr numeric(12,2),
  customer_price_inr numeric(12,2),
  warranty_days integer,
  city text,
  provider_code text references public.service_providers(provider_code) on update cascade on delete restrict,
  valid_from date,
  valid_to date,
  verified boolean not null default false,
  status smallint not null default 1 check(status in (0,1)),
  notes text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(valid_to is null or valid_from is null or valid_to>=valid_from),
  check(customer_price_inr is null or customer_price_inr=coalesce(part_cost_inr,0)+coalesce(labour_cost_inr,0)+coalesce(logistics_cost_inr,0)+coalesce(margin_inr,0))
);
create index if not exists repair_component_price_lookup_idx on public.repair_component_price_rules(device_code,component_code,city,valid_from desc);

-- One versioned policy table covers approved depreciation, condition deductions,
-- buyback margins and resale pricing without activating workbook assumptions.
create table if not exists public.pricing_policies (
  id uuid primary key default gen_random_uuid(),
  policy_code text not null unique,
  policy_type text not null check(policy_type in ('age_depreciation','condition_deduction','buyback_margin','resale_pricing','formula')),
  brand_code char(2) references public.phone_brands(brand_code) on update cascade on delete restrict,
  device_segment text,
  city text,
  effective_from date,
  effective_to date,
  policy_values jsonb not null default '{}'::jsonb,
  approved boolean not null default false,
  status smallint not null default 0 check(status in (0,1)),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(effective_to is null or effective_from is null or effective_to>=effective_from)
);
create index if not exists pricing_policies_live_idx on public.pricing_policies(policy_type,brand_code,device_segment,effective_from) where approved and status=1;
alter table public.phone_variants add column if not exists original_price_inr numeric(12,2);
alter table public.phone_variants add column if not exists original_price_basis text;
alter table public.phone_variants add column if not exists launch_year smallint;
create table if not exists public.model_price_setups (
  -- Includes explicitly unknown-configuration codes from source workbooks;
  -- those codes are reference metadata and are never listed as variants.
  device_code char(7) primary key check(device_code ~ '^[0-9]{7}$'),
  original_price_inr numeric(12,2),
  original_price_basis text,
  launch_year smallint,
  notes text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
-- These rows describe possible resale pricing and must never create physical stock.
-- Blank template prices remain NULL so centralized pricing returns quote-required.
alter table public.repair_price_rules alter column customer_price_inr drop not null;
alter table public.buyback_rules alter column estimated_offer_inr drop not null;
alter table public.buyback_rules add column if not exists original_price_inr numeric(12,2);
alter table public.buyback_rules add column if not exists original_price_basis text;
alter table public.buyback_rules add column if not exists launch_year smallint;
alter table public.buyback_rules add column if not exists age_depreciation_pct numeric(7,4);
alter table public.buyback_rules add column if not exists age_depreciation_inr numeric(12,2);
alter table public.buyback_rules add column if not exists condition_deduction_inr numeric(12,2);
alter table public.buyback_rules add column if not exists refurbishment_cost_inr numeric(12,2);
alter table public.buyback_rules add column if not exists risk_margin_inr numeric(12,2);
alter table public.buyback_rules add column if not exists business_margin_inr numeric(12,2);
alter table public.buyback_rules add column if not exists estimated_resale_value_inr numeric(12,2);
alter table public.buyback_rules add column if not exists age_years numeric(5,2);
alter table public.resale_inventory add column if not exists calculated_selling_price_inr numeric(12,2);
alter table public.resale_inventory add column if not exists approved_price_override_inr numeric(12,2);
alter table public.resale_inventory add column if not exists override_reason text;
alter table public.resale_inventory add column if not exists approved_by uuid references auth.users(id) on delete set null;
alter table public.resale_inventory add column if not exists original_price_inr numeric(12,2);
alter table public.resale_inventory add column if not exists original_price_basis text;
alter table public.resale_inventory add column if not exists age_depreciation_inr numeric(12,2);
alter table public.resale_inventory add column if not exists condition_deduction_inr numeric(12,2);
alter table public.resale_inventory add column if not exists launch_year smallint;

create table if not exists public.accessory_types (
  type_code text primary key,
  type_name text not null,
  status smallint not null default 1 check(status in (0,1)),
  notes text
);
create table if not exists public.accessory_compatibility (
  accessory_id uuid not null references public.accessories(id) on delete cascade,
  device_code char(7) not null references public.phone_variants(device_code) on update cascade on delete restrict,
  verified boolean not null default false,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  notes text,
  primary key(accessory_id,device_code)
);

create table if not exists public.site_content (
  content_key text primary key,
  content jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.whatsapp_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  phone_e164 text not null unique,
  display_name text,
  phone_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.whatsapp_contacts(id) on delete restrict,
  conversation_key text not null unique,
  status text not null default 'open' check(status in ('open','waiting_customer','handoff','closed')),
  flow_state jsonb not null default '{}'::jsonb,
  assigned_staff_id uuid references auth.users(id) on delete set null,
  last_message_at timestamptz,
  service_request_id uuid unique references public.service_requests(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete restrict,
  provider_message_id text unique,
  direction text not null check(direction in ('inbound','outbound')),
  message_type text not null,
  message_text text,
  payload jsonb not null default '{}'::jsonb,
  delivery_status text not null default 'received',
  created_at timestamptz not null default now()
);
create table if not exists public.whatsapp_webhook_events (
  event_id text primary key,
  payload_hash text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_attempts smallint not null default 0,
  last_error text
);

create table if not exists public.admin_permissions (
  role text not null,
  permission text not null,
  granted boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key(role,permission)
);
insert into public.admin_permissions(role,permission,granted) values
  ('sales_admin','requests.read',true),('sales_admin','requests.update',true),('sales_admin','customers.read',true),
  ('repair_admin','requests.read',true),('repair_admin','requests.update',true),('repair_admin','repair.pricing.manage',true),('repair_admin','providers.read',true),
  ('support_agent','requests.read',true),('support_agent','requests.update',true),('support_agent','customers.read',true),
  ('inspector','requests.read',true),('inspector','requests.update',true),
  ('catalogue_manager','catalogue.manage',true),('catalogue_manager','imports.manage',true),
  ('inventory_manager','inventory.manage',true),('inventory_manager','imports.manage',true),
  ('location_manager','locations.manage',true),('location_manager','providers.read',true)
on conflict(role,permission) do update set granted=excluded.granted,updated_at=now();

-- Existing service-role APIs remain trusted server-side. No anonymous or
-- authenticated user can read operational/customer/WhatsApp records directly.
do $$
declare t text;
begin
  foreach t in array array[
    'request_code_reservations','service_requests','request_status_history','request_assignments','request_notes',
    'customer_addresses','customer_consents','customer_otp_send_events','doorstep_bookings','provider_brand_coverage',
    'repair_components','repair_component_price_rules','pricing_policies','model_price_setups','accessory_types',
    'accessory_compatibility','site_content','whatsapp_contacts','whatsapp_conversations','whatsapp_messages',
    'whatsapp_webhook_events','admin_permissions'
  ] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end;
$$;
alter table public.request_status_history enable row level security;
alter table public.request_assignments enable row level security;
alter table public.request_notes enable row level security;
alter table public.doorstep_bookings enable row level security;
alter table public.pricing_policies enable row level security;
alter table public.model_price_setups enable row level security;
alter table public.repair_components enable row level security;
alter table public.repair_component_price_rules enable row level security;
alter table public.accessory_compatibility enable row level security;
alter table public.site_content enable row level security;
alter table public.whatsapp_contacts enable row level security;
alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.whatsapp_webhook_events enable row level security;
alter table public.admin_permissions enable row level security;

grant usage, select on sequence public.request_status_history_id_seq to service_role;
grant usage, select on sequence public.customer_otp_send_events_id_seq to service_role;

drop policy if exists "Admins manage roles" on public.staff_roles;
create policy "Admins manage roles" on public.staff_roles for all using(public.has_staff_role(array['admin','super_admin'])) with check(public.has_staff_role(array['admin','super_admin']));

