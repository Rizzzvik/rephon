-- Allow a listing to be available while its customer price is pending review.
alter table public.resale_inventory
  alter column selling_price_inr drop not null;

-- Orders must use only an approved override or the stored approved selling price.
-- A listing with neither is a quote request, never a zero-price order.
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
    select coalesce(approved_price_override_inr,selling_price_inr),stock_quantity into v_price,v_stock from public.resale_inventory where id=v_line.inventory_id and listing_status='available' for update;
    if not found or v_stock<v_line.quantity then raise exception 'Requested stock is no longer available';end if;
    if v_price is null then raise exception 'Price requires manual quotation';end if;
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
