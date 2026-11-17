insert into public.admin_permissions(role,permission,granted) values
  ('location_manager','providers.manage',true),
  ('sales_admin','resale.pricing.manage',true),
  ('sales_admin','buyback.pricing.manage',true),
  ('repair_admin','providers.read',true),
  ('repair_admin','repair.pricing.manage',true),
  ('catalogue_manager','catalogue.manage',true),
  ('inventory_manager','inventory.manage',true)
on conflict(role,permission) do update set granted=excluded.granted,updated_at=now();
