-- Preserve the optional notes column from DEVICE_MASTER.BRAND_REGISTRY.
alter table public.phone_brands add column if not exists notes text;
