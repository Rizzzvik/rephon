-- Insert brand rows before creating the allocation ledger reference to them.
-- The Phase 4 trigger ran BEFORE INSERT, violating the ledger's brand_id FK.
drop trigger if exists phone_brand_code_allocation_guard on public.phone_brands;
create trigger phone_brand_code_allocation_guard
after insert or update of brand_code on public.phone_brands
for each row execute function public.protect_brand_code_allocation();
