-- Source workbook values are references for staff review, never live prices by default.
create table if not exists public.model_market_price_tags (
  id uuid primary key default gen_random_uuid(), model_id uuid not null references public.phone_models(id) on delete restrict,
  buy_price_inr numeric(12,2) check (buy_price_inr is null or buy_price_inr >= 0), buy_price_basis text, buy_source text, buy_confidence text,
  sell_baseline_inr numeric(12,2) check (sell_baseline_inr is null or sell_baseline_inr >= 0), sell_price_basis text, sell_source text, sell_condition_basis text, sell_confidence text,
  market_scope text, price_as_of date, notes text, condition_baseline_note text,
  source_workbook text not null, source_sheet text not null, source_row integer not null,
  verification_status text not null default 'pending_review' check (verification_status in ('pending_review','verified','rejected','inactive')),
  is_active boolean not null default false, approved_by uuid references auth.users(id) on delete set null, approved_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(model_id, market_scope, price_as_of, source_workbook)
);
create table if not exists public.model_repair_price_tags (
  id uuid primary key default gen_random_uuid(), model_id uuid not null references public.phone_models(id) on delete restrict,
  component_code text not null, component_name text not null, price_inr numeric(12,2) check (price_inr is null or price_inr >= 0),
  price_basis text, source_name text, price_scope text, confidence text, notes text,
  source_workbook text not null, source_sheet text not null, source_row integer not null,
  verification_status text not null default 'pending_review' check (verification_status in ('pending_review','verified','rejected','inactive')),
  is_active boolean not null default false, approved_by uuid references auth.users(id) on delete set null, approved_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(model_id, component_code, price_scope, source_workbook)
);
create table if not exists public.model_component_deduction_tags (
  id uuid primary key default gen_random_uuid(), model_id uuid not null references public.phone_models(id) on delete restrict,
  component_code text not null, component_name text not null,
  sell_baseline_inr numeric(12,2) check(sell_baseline_inr is null or sell_baseline_inr >= 0), repair_reference_inr numeric(12,2) check(repair_reference_inr is null or repair_reference_inr >= 0),
  full_fault_deduction_pct numeric(7,3), full_fault_deduction_inr numeric(12,2), minor_fault_pct numeric(7,3), moderate_fault_pct numeric(7,3), major_fault_pct numeric(7,3), missing_component_pct numeric(7,3), component_cap_pct numeric(7,3),
  calculation_basis text, confidence_note text, source_workbook text not null, source_sheet text not null, source_row integer not null,
  verification_status text not null default 'pending_review' check (verification_status in ('pending_review','verified','rejected','inactive')),
  is_active boolean not null default false, approved_by uuid references auth.users(id) on delete set null, approved_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (coalesce(full_fault_deduction_pct,0) between 0 and 100 and coalesce(minor_fault_pct,0) between 0 and 100 and coalesce(moderate_fault_pct,0) between 0 and 100 and coalesce(major_fault_pct,0) between 0 and 100 and coalesce(missing_component_pct,0) between 0 and 100 and coalesce(component_cap_pct,0) between 0 and 100),
  unique(model_id, component_code, source_workbook)
);
create index if not exists model_market_price_tags_review_idx on public.model_market_price_tags(verification_status, created_at desc);
create index if not exists model_repair_price_tags_review_idx on public.model_repair_price_tags(verification_status, created_at desc);
create index if not exists model_component_deduction_tags_review_idx on public.model_component_deduction_tags(verification_status, created_at desc);
do $$ declare t text; begin foreach t in array array['model_market_price_tags','model_repair_price_tags','model_component_deduction_tags'] loop execute format('alter table public.%I enable row level security',t); execute format('revoke all on public.%I from anon, authenticated',t); execute format('grant all on public.%I to service_role',t); end loop; end $$;
comment on table public.model_market_price_tags is 'Imported model-level market prices; inactive pending review by default and not a customer quote.';
