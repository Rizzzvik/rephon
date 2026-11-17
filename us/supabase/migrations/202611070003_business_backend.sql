-- Additive business-data foundation. Existing phone catalogue records are retained.
alter table public.phone_brands add column if not exists brand_code char(2);
alter table public.phone_brands add column if not exists status smallint not null default 1 check (status in (0,1));
alter table public.phone_brands add column if not exists product_category text not null default 'Smartphones';
alter table public.phone_models add column if not exists model_code char(3);
alter table public.phone_models add column if not exists device_type text not null default 'smartphone' check (device_type in ('smartphone','feature_phone','tablet','other'));
alter table public.phone_models drop constraint if exists phone_models_device_type_check;
alter table public.phone_models add constraint phone_models_device_type_check check (device_type in ('smartphone','feature_phone','tablet','laptop','other'));
alter table public.phone_models add column if not exists specifications_json jsonb not null default '{}'::jsonb;
alter table public.phone_models add column if not exists verification_status text not null default 'needs_review' check (verification_status in ('draft','needs_review','verified','rejected'));
alter table public.phone_models add column if not exists status smallint not null default 1 check (status in (0,1));
alter table public.phone_models add column if not exists source_reference text;
alter table public.phone_models add column if not exists notes text;
alter table public.phone_variants add column if not exists variant_code char(2);
alter table public.phone_variants add column if not exists device_code char(7);
alter table public.phone_variants add column if not exists ram_gb numeric(5,2);
alter table public.phone_variants add column if not exists region text;
alter table public.phone_variants add column if not exists status smallint not null default 1 check (status in (0,1));
alter table public.phone_variants add column if not exists repair_enabled boolean not null default false;
alter table public.phone_variants add column if not exists buyback_enabled boolean not null default false;
alter table public.phone_variants add column if not exists resale_enabled boolean not null default false;
alter table public.phone_variants add column if not exists notes text;
create unique index if not exists phone_brands_code_unique on public.phone_brands(brand_code) where brand_code is not null;
create unique index if not exists phone_models_brand_code_unique on public.phone_models(brand_id, model_code) where model_code is not null;
create unique index if not exists phone_variants_device_code_unique on public.phone_variants(device_code) where device_code is not null;
create unique index if not exists phone_variants_model_variant_code_unique on public.phone_variants(model_id, variant_code) where variant_code is not null;
create unique index if not exists phone_brands_brand_code_upsert_key on public.phone_brands(brand_code);
create unique index if not exists phone_models_code_upsert_key on public.phone_models(brand_id, model_code);
create unique index if not exists phone_variants_code_upsert_key on public.phone_variants(device_code);
alter table public.phone_brands add constraint phone_brands_code_format check (brand_code is null or brand_code ~ '^[0-9]{2}$');
alter table public.phone_models add constraint phone_models_code_format check (model_code is null or model_code ~ '^[0-9]{3}$');
alter table public.phone_variants add constraint phone_variants_code_format check (variant_code is null or variant_code ~ '^[0-9]{2}$');
alter table public.phone_variants add constraint phone_variants_device_code_format check (device_code is null or device_code ~ '^[0-9]{7}$');
alter table public.phone_variants add constraint phone_variants_ram_positive check (ram_gb is null or ram_gb > 0);

create table if not exists public.repair_issues (
  id uuid primary key default gen_random_uuid(), issue_code text not null unique,
  issue_name text not null, issue_category text, description text,
  status smallint not null default 1 check(status in (0,1)), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.service_providers (
  id uuid primary key default gen_random_uuid(), provider_code text not null unique,
  business_name text not null, provider_type text, contact_person text, phone_e164 text, email text,
  city text, area text, full_address text, services_offered text, working_hours text,
  status smallint not null default 1 check(status in (0,1)), notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.repair_price_rules (
  id uuid primary key default gen_random_uuid(), rule_key text unique, device_code char(7) not null references public.phone_variants(device_code) on update cascade on delete restrict,
  issue_code text not null references public.repair_issues(issue_code) on update cascade on delete restrict,
  part_type text, part_grade text, part_cost_inr numeric(12,2), labour_cost_inr numeric(12,2), logistics_cost_inr numeric(12,2), margin_inr numeric(12,2), customer_price_inr numeric(12,2) not null check(customer_price_inr >= 0),
  warranty_days integer, city text, provider_code text references public.service_providers(provider_code) on update cascade on delete restrict,
  valid_from date, valid_to date, verified boolean not null default false, status smallint not null default 1 check(status in (0,1)), notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(valid_to is null or valid_from is null or valid_to >= valid_from)
);
create index if not exists repair_prices_public_lookup on public.repair_price_rules(device_code, issue_code, city, valid_from desc) where verified and status=1;

create table if not exists public.condition_grades (
  id uuid primary key default gen_random_uuid(), grade_code text not null unique, grade_name text not null, criteria text, status smallint not null default 1 check(status in (0,1)), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.buyback_rules (
  id uuid primary key default gen_random_uuid(), rule_key text unique, device_code char(7) not null references public.phone_variants(device_code) on update cascade on delete restrict,
  condition_grade text not null references public.condition_grades(grade_code) on update cascade on delete restrict,
  screen_condition text, body_condition text, battery_health_min_pct numeric(5,2), battery_health_max_pct numeric(5,2), functional_status text,
  base_value_inr numeric(12,2), deduction_inr numeric(12,2), estimated_offer_inr numeric(12,2) not null check(estimated_offer_inr >= 0),
  city text, valid_from date, valid_to date, verified boolean not null default false, status smallint not null default 1 check(status in (0,1)), notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(battery_health_min_pct is null or battery_health_min_pct between 0 and 100), check(battery_health_max_pct is null or battery_health_max_pct between 0 and 100),
  check(battery_health_min_pct is null or battery_health_max_pct is null or battery_health_max_pct >= battery_health_min_pct), check(valid_to is null or valid_from is null or valid_to >= valid_from)
);
create index if not exists buyback_rules_public_lookup on public.buyback_rules(device_code, condition_grade, city, valid_from desc) where verified and status=1;

create table if not exists public.resale_inventory (
  id uuid primary key default gen_random_uuid(), inventory_sku text not null unique,
  device_code char(7) not null references public.phone_variants(device_code) on update cascade on delete restrict,
  condition_grade text not null references public.condition_grades(grade_code) on update cascade on delete restrict,
  battery_health_pct numeric(5,2), stock_quantity integer not null default 0 check(stock_quantity >= 0),
  purchase_cost_inr numeric(12,2), refurbishment_cost_inr numeric(12,2), selling_price_inr numeric(12,2) not null check(selling_price_inr >= 0),
  warranty_days integer, city text, listing_status text not null default 'draft' check(listing_status in ('draft','available','reserved','sold','withdrawn')),
  date_added date, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(battery_health_pct is null or battery_health_pct between 0 and 100)
);
create index if not exists resale_inventory_available_lookup on public.resale_inventory(device_code, city) where listing_status='available' and stock_quantity > 0;

create table if not exists public.accessories (
  id uuid primary key default gen_random_uuid(), accessory_code text not null, compatibility_key text not null, accessory_category text, brand text, accessory_name text not null,
  compatible_device_code char(7) references public.phone_variants(device_code) on update cascade on delete restrict, compatible_model text,
  cost_inr numeric(12,2), selling_price_inr numeric(12,2), stock_quantity integer not null default 0 check(stock_quantity >= 0), warranty_days integer,
  status smallint not null default 1 check(status in (0,1)), notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(accessory_code, compatibility_key)
);

create table if not exists public.phone_images (
  id uuid primary key default gen_random_uuid(), device_code char(7) references public.phone_variants(device_code) on update cascade on delete cascade,
  model_id uuid references public.phone_models(id) on delete cascade, variant_id uuid references public.phone_variants(id) on delete cascade,
  image_url text not null, storage_path text, image_type text not null check(image_type in ('front','back','side','gallery','colour_variant')),
  colour text, alt_text text not null, source_name text, source_url text, usage_permission text not null,
  approved_by uuid references auth.users(id), approved_at timestamptz,
  is_primary boolean not null default false, sort_order integer not null default 0, status smallint not null default 1 check(status in (0,1)), created_at timestamptz not null default now(),
  check(model_id is not null or variant_id is not null or device_code is not null)
);
create index if not exists phone_images_device_idx on public.phone_images(device_code, sort_order) where status=1;

create table if not exists public.staff_roles (
  user_id uuid primary key references auth.users(id) on delete cascade, role text not null check(role in ('admin','catalogue_manager','support_agent','inspector')), created_at timestamptz not null default now()
);
create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(), workbook text not null, uploaded_by uuid references auth.users(id) on delete set null,
  file_name text not null, file_sha256 text not null, status text not null check(status in ('preview','committed','failed','cancelled')),
  total_rows integer not null default 0, valid_rows integer not null default 0, invalid_rows integer not null default 0, duplicate_rows integer not null default 0, imported_rows integer not null default 0,
  report jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), committed_at timestamptz,
  unique(workbook,file_sha256)
);
create table if not exists public.import_errors (
  id bigint generated always as identity primary key, batch_id uuid not null references public.import_batches(id) on delete cascade,
  sheet_name text not null, row_number integer not null, severity text not null check(severity in ('error','warning','duplicate')),
  field_name text, message text not null, row_data jsonb not null default '{}'::jsonb
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(), full_name text not null, mobile text not null, email text, pin_code text,
  address text, street text, landmark text, city text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(mobile)
);
create table if not exists public.customer_reviews (
  id uuid primary key default gen_random_uuid(), customer_id uuid references public.customers(id) on delete set null,
  author_display text not null, review_text text not null check(length(trim(review_text)) between 12 and 1200), rating smallint not null check(rating between 1 and 5),
  journey text check(journey is null or journey in ('buy','sell','repair')), verified_customer boolean not null default false,
  status text not null default 'pending' check(status in ('pending','published','rejected')), published_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists customer_reviews_public_idx on public.customer_reviews(published_at desc) where status='published' and verified_customer;
create table if not exists public.questionnaire_submissions (
  id uuid primary key default gen_random_uuid(), reference text not null unique, customer_id uuid not null references public.customers(id) on delete restrict,
  journey text not null check(journey in ('buy','sell','repair')), device_code char(7) references public.phone_variants(device_code) on update cascade on delete set null,
  original_answers jsonb not null, normalized_answers jsonb not null default '{}'::jsonb,
  status text not null default 'submitted' check(status in ('submitted','under_review','needs_quote','quoted','booked','closed','cancelled')),
  idempotency_key text unique, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists submissions_customer_time on public.questionnaire_submissions(customer_id, created_at desc);
create table if not exists public.uploaded_files (
  id uuid primary key default gen_random_uuid(), submission_id uuid not null references public.questionnaire_submissions(id) on delete cascade,
  storage_path text not null unique, mime_type text not null, byte_size bigint not null check(byte_size between 1 and 10485760), created_at timestamptz not null default now()
);
create table if not exists public.activity_logs (
  id bigint generated always as identity primary key, actor_id uuid references auth.users(id) on delete set null,
  entity_type text not null, entity_id text not null, action text not null, details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table if not exists public.buy_enquiries (
  id uuid primary key default gen_random_uuid(), submission_id uuid not null unique references public.questionnaire_submissions(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb, selected_inventory_id uuid references public.resale_inventory(id) on delete set null
);
create table if not exists public.buy_orders (
  id uuid primary key default gen_random_uuid(), reference text not null unique, customer_id uuid not null references public.customers(id), status text not null default 'pending' check(status in ('pending','confirmed','cancelled','fulfilled')),
  total_inr numeric(12,2) not null check(total_inr >= 0), idempotency_key text unique, created_at timestamptz not null default now()
);
create table if not exists public.buy_order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.buy_orders(id) on delete cascade,
  inventory_id uuid not null references public.resale_inventory(id), quantity integer not null check(quantity > 0), unit_price_inr numeric(12,2) not null check(unit_price_inr >= 0)
);
create table if not exists public.sell_requests (
  id uuid primary key default gen_random_uuid(), submission_id uuid not null unique references public.questionnaire_submissions(id) on delete cascade,
  customer_reported_condition jsonb not null, staff_inspection jsonb, indicative_offer_inr numeric(12,2), final_offer_inr numeric(12,2), final_offer_approved_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create table if not exists public.buyback_inspections (
  id uuid primary key default gen_random_uuid(), sell_request_id uuid not null references public.sell_requests(id) on delete cascade,
  inspector_id uuid not null references auth.users(id), screen_condition text, body_condition text, battery_condition text, functional_tests jsonb not null default '{}'::jsonb,
  final_grade text references public.condition_grades(grade_code), notes text, grade_change_reason text, inspected_at timestamptz not null default now()
);
create table if not exists public.buyback_quotes (
  id uuid primary key default gen_random_uuid(), sell_request_id uuid not null references public.sell_requests(id) on delete cascade,
  rule_id uuid references public.buyback_rules(id), amount_inr numeric(12,2) not null check(amount_inr>=0), quote_type text not null check(quote_type in ('indicative','final')),
  status text not null default 'pending_review' check(status in ('pending_review','issued','accepted','declined','expired')),
  approved_by uuid references auth.users(id), notes text, created_at timestamptz not null default now()
);
alter table public.sell_requests add column if not exists staff_assessment jsonb;
create table if not exists public.repair_requests (
  id uuid primary key default gen_random_uuid(), submission_id uuid not null unique references public.questionnaire_submissions(id) on delete cascade,
  issue_codes text[] not null default '{}', diagnostics jsonb not null default '{}'::jsonb, quote_required boolean not null default true
);
create table if not exists public.repair_bookings (
  id uuid primary key default gen_random_uuid(), repair_request_id uuid not null references public.repair_requests(id) on delete cascade,
  provider_code text references public.service_providers(provider_code), method text not null, appointment_at timestamptz, status text not null default 'requested' check(status in ('requested','confirmed','completed','cancelled')),
  created_at timestamptz not null default now()
);
create table if not exists public.repair_quotes (
  id uuid primary key default gen_random_uuid(), repair_request_id uuid not null references public.repair_requests(id) on delete cascade,
  rule_id uuid references public.repair_price_rules(id), amount_inr numeric(12,2), status text not null default 'manual_quote' check(status in ('fixed_verified','manual_quote','accepted','declined')),
  issued_by uuid references auth.users(id), created_at timestamptz not null default now()
);

create or replace function public.create_questionnaire_submission(
  p_journey text, p_customer jsonb, p_answers jsonb, p_normalized jsonb,
  p_device_code text default null, p_idempotency_key text default null
) returns table(submission_id uuid, reference text, duplicate boolean)
language plpgsql security definer set search_path=public as $$
declare v_customer_id uuid; v_submission_id uuid; v_reference text; v_phone text; v_repair_id uuid;
begin
  if p_journey not in ('buy','sell','repair') then raise exception 'Unsupported journey'; end if;
  v_phone := regexp_replace(coalesce(p_customer->>'mobile',''), '\\D', '', 'g');
  if v_phone !~ '^[0-9]{10}$' then raise exception 'A valid 10 digit mobile number is required'; end if;
  if coalesce(length(trim(p_customer->>'fullName')),0) < 2 then raise exception 'Customer name is required'; end if;
  if coalesce((p_customer->>'pinCode'), '') !~ '^[0-9]{6}$' then raise exception 'A valid 6 digit PIN code is required'; end if;
  if p_idempotency_key is not null then
    select s.id,s.reference into v_submission_id,v_reference from public.questionnaire_submissions s where s.idempotency_key=p_idempotency_key;
    if v_submission_id is not null then return query select v_submission_id,v_reference,true; return; end if;
  end if;
  insert into public.customers(full_name,mobile,email,pin_code,address,street,landmark,city)
  values(trim(p_customer->>'fullName'),v_phone,nullif(trim(p_customer->>'email'),''),p_customer->>'pinCode',nullif(p_customer->>'address',''),nullif(p_customer->>'street',''),nullif(p_customer->>'landmark',''),nullif(p_customer->>'city',''))
  on conflict(mobile) do update set full_name=excluded.full_name,email=coalesce(excluded.email,customers.email),pin_code=coalesce(excluded.pin_code,customers.pin_code),address=coalesce(excluded.address,customers.address),street=coalesce(excluded.street,customers.street),landmark=coalesce(excluded.landmark,customers.landmark),city=coalesce(excluded.city,customers.city),updated_at=now()
  returning id into v_customer_id;
  v_reference := 'WP-' || upper(p_journey) || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  insert into public.questionnaire_submissions(customer_id,journey,reference,device_code,original_answers,normalized_answers,idempotency_key)
  values(v_customer_id,p_journey,v_reference,nullif(p_device_code,''),coalesce(p_answers,'{}'::jsonb),coalesce(p_normalized,'{}'::jsonb),p_idempotency_key)
  returning id into v_submission_id;
  if p_journey='buy' then
    insert into public.buy_enquiries(submission_id,preferences) values(v_submission_id,coalesce(p_normalized->'preferences','{}'::jsonb));
  elsif p_journey='sell' then
    insert into public.sell_requests(submission_id,customer_reported_condition) values(v_submission_id,coalesce(p_normalized->'reportedCondition','{}'::jsonb));
  else
    insert into public.repair_requests(submission_id,issue_codes,diagnostics,quote_required)
    values(v_submission_id,array(select jsonb_array_elements_text(coalesce(p_normalized->'issueCodes','[]'::jsonb))),coalesce(p_normalized->'diagnostics','{}'::jsonb),true);
    if coalesce(p_normalized->'servicePreference'->>'label','') <> '' then
      select id into v_repair_id from public.repair_requests where submission_id=v_submission_id;
      insert into public.repair_bookings(repair_request_id,method,status) values(v_repair_id,p_normalized->'servicePreference'->>'label','requested');
    end if;
  end if;
  return query select v_submission_id,v_reference,false;
end; $$;
revoke all on function public.create_questionnaire_submission(text,jsonb,jsonb,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.create_questionnaire_submission(text,jsonb,jsonb,jsonb,text,text) to service_role;

create or replace function public.create_pending_buy_order(p_customer jsonb,p_items jsonb,p_idempotency_key text)
returns table(order_id uuid,reference text,duplicate boolean,total_inr numeric)
language plpgsql security definer set search_path=public as $$
declare v_customer_id uuid;v_order_id uuid;v_reference text;v_phone text;v_total numeric(12,2):=0;v_line record;v_price numeric(12,2);v_stock integer;v_lines jsonb:='[]'::jsonb;
begin
  v_phone:=regexp_replace(coalesce(p_customer->>'mobile',''),'\\D','','g');
  if v_phone !~ '^[0-9]{10}$' or coalesce(length(trim(p_customer->>'fullName')),0)<2 then raise exception 'A valid customer name and mobile number are required';end if;
  if coalesce(p_customer->>'pinCode','') !~ '^[0-9]{6}$' then raise exception 'A valid PIN code is required';end if;
  if p_idempotency_key is null or length(p_idempotency_key)>160 then raise exception 'An idempotency key is required';end if;
  select o.id,o.reference,o.total_inr into v_order_id,v_reference,v_total from public.buy_orders o where o.idempotency_key=p_idempotency_key;
  if v_order_id is not null then return query select v_order_id,v_reference,true,v_total;return;end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>10 then raise exception 'Provide between one and ten inventory items';end if;
  insert into public.customers(full_name,mobile,email,pin_code,address,street,landmark,city)
  values(trim(p_customer->>'fullName'),v_phone,nullif(trim(p_customer->>'email'),''),p_customer->>'pinCode',nullif(p_customer->>'address',''),nullif(p_customer->>'street',''),nullif(p_customer->>'landmark',''),nullif(p_customer->>'city',''))
  on conflict(mobile) do update set full_name=excluded.full_name,email=coalesce(excluded.email,customers.email),pin_code=coalesce(excluded.pin_code,customers.pin_code),address=coalesce(excluded.address,customers.address),updated_at=now() returning id into v_customer_id;
  for v_line in select * from jsonb_to_recordset(p_items) as x(inventory_id uuid,quantity integer) loop
    if v_line.quantity is null or v_line.quantity<1 then raise exception 'Order quantity must be positive';end if;
    select selling_price_inr,stock_quantity into v_price,v_stock from public.resale_inventory where id=v_line.inventory_id and listing_status='available' for update;
    if v_price is null or v_stock<v_line.quantity then raise exception 'Requested stock is no longer available';end if;
    update public.resale_inventory set stock_quantity=stock_quantity-v_line.quantity,listing_status=case when stock_quantity-v_line.quantity=0 then 'sold' else 'available' end,updated_at=now() where id=v_line.inventory_id;
    v_total:=v_total+(v_price*v_line.quantity);
    v_lines:=v_lines||jsonb_build_array(jsonb_build_object('inventory_id',v_line.inventory_id,'quantity',v_line.quantity,'unit_price_inr',v_price));
  end loop;
  v_reference:='WP-BUY-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  insert into public.buy_orders(reference,customer_id,status,total_inr,idempotency_key) values(v_reference,v_customer_id,'pending',v_total,p_idempotency_key) returning id into v_order_id;
  insert into public.buy_order_items(order_id,inventory_id,quantity,unit_price_inr) select v_order_id,x.inventory_id,x.quantity,x.unit_price_inr from jsonb_to_recordset(v_lines) as x(inventory_id uuid,quantity integer,unit_price_inr numeric);
  return query select v_order_id,v_reference,false,v_total;
end;$$;
revoke all on function public.create_pending_buy_order(jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.create_pending_buy_order(jsonb,jsonb,text) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('customer-submissions','customer-submissions',false,10485760,array['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime'])
on conflict(id) do nothing;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('product-images','product-images',false,8388608,array['image/jpeg','image/png','image/webp','image/heic'])
on conflict(id) do nothing;

-- Roles are checked server-side; customer submissions and private business records are never public table reads.
do $$ declare t text; begin
  foreach t in array array['repair_issues','service_providers','repair_price_rules','condition_grades','buyback_rules','resale_inventory','accessories','phone_images','staff_roles','import_batches','import_errors','customers','customer_reviews','questionnaire_submissions','uploaded_files','activity_logs','buy_enquiries','buy_orders','buy_order_items','sell_requests','buyback_inspections','buyback_quotes','repair_requests','repair_bookings','repair_quotes'] loop
    execute format('alter table public.%I enable row level security',t);
  end loop;
end $$;

create policy "Active repair issues are readable" on public.repair_issues for select using(status=1);
create policy "Available public resale inventory is readable" on public.resale_inventory for select using(listing_status='available' and stock_quantity>0);
create policy "Active licensed device images are readable" on public.phone_images for select using(status=1 and usage_permission in ('owned','licensed','manufacturer-approved'));
create policy "Verified active repair pricing is readable" on public.repair_price_rules for select using(verified and status=1 and (valid_from is null or valid_from<=current_date) and (valid_to is null or valid_to>=current_date));
create policy "Verified active buyback rules are readable" on public.buyback_rules for select using(verified and status=1 and (valid_from is null or valid_from<=current_date) and (valid_to is null or valid_to>=current_date));
create policy "Published verified reviews are readable" on public.customer_reviews for select using(status='published' and verified_customer);

create function public.has_staff_role(allowed text[]) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.staff_roles where user_id=auth.uid() and role=any(allowed));
$$;
create policy "Staff can read roles" on public.staff_roles for select using(user_id=auth.uid() or public.has_staff_role(array['admin']));
create policy "Admins manage roles" on public.staff_roles for all using(public.has_staff_role(array['admin'])) with check(public.has_staff_role(array['admin']));

grant select on public.repair_issues, public.resale_inventory, public.phone_images, public.repair_price_rules, public.buyback_rules, public.customer_reviews to anon, authenticated;
grant all on public.repair_issues, public.service_providers, public.repair_price_rules, public.condition_grades, public.buyback_rules, public.resale_inventory, public.accessories, public.phone_images, public.import_batches, public.import_errors, public.customers, public.customer_reviews, public.questionnaire_submissions, public.uploaded_files, public.activity_logs, public.buy_enquiries, public.buy_orders, public.buy_order_items, public.sell_requests, public.buyback_inspections, public.buyback_quotes, public.repair_requests, public.repair_bookings, public.repair_quotes to service_role;
grant select on public.staff_roles to authenticated;
