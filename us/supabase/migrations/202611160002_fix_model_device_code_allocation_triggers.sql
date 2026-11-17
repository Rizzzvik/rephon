-- Model and variant allocation ledgers reference their parent rows, so these
-- guards must run after the parent inserts have completed.
drop trigger if exists phone_model_code_allocation_guard on public.phone_models;
create trigger phone_model_code_allocation_guard
after insert or update of brand_id,model_code on public.phone_models
for each row execute function public.protect_model_code_allocation();

drop trigger if exists phone_variant_code_allocation_guard on public.phone_variants;
create trigger phone_variant_code_allocation_guard
after insert or update of model_id,variant_code,device_code on public.phone_variants
for each row execute function public.protect_device_code_allocation();
