-- A device variant is identified by model, RAM, storage, and colour.
-- Older schema versions omitted RAM, which rejected valid configurations such
-- as 8 GB / 256 GB and 12 GB / 256 GB for the same model and colour.
alter table public.phone_variants
  drop constraint if exists phone_variants_model_id_storage_gb_color_key;

create unique index if not exists phone_variants_model_ram_storage_color_key
  on public.phone_variants (model_id, (coalesce(ram_gb, 0)), storage_gb, color);
