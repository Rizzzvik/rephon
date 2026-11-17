alter table public.whatsapp_webhook_events
  add column if not exists claim_token uuid,
  add column if not exists claimed_at timestamptz;

create or replace function public.claim_whatsapp_webhook_event(p_event_id text,p_payload_hash text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_token uuid:=gen_random_uuid();
begin
  insert into public.whatsapp_webhook_events(event_id,payload_hash,claim_token,claimed_at,processing_attempts)
  values(p_event_id,p_payload_hash,v_token,now(),1)
  on conflict(event_id) do nothing;
  if found then return v_token; end if;
  update public.whatsapp_webhook_events e
    set claim_token=v_token,claimed_at=now(),processing_attempts=e.processing_attempts+1,payload_hash=p_payload_hash
    where e.event_id=p_event_id and e.processed_at is null and (e.claimed_at is null or e.claimed_at<now()-interval '2 minutes');
  if found then return v_token; end if;
  return null;
end;
$$;
revoke all on function public.claim_whatsapp_webhook_event(text,text) from public,anon,authenticated;
grant execute on function public.claim_whatsapp_webhook_event(text,text) to service_role;

create or replace function public.admin_update_service_request(
  p_request_id uuid,p_status text,p_staff_user_id uuid,p_note text,p_provider_code text
)
returns table(id uuid,request_code char(6),status text,updated_at timestamptz)
language plpgsql security definer set search_path=public as $$
declare v_previous text;
begin
  if p_status not in ('initiated','otp_verified','submitted','under_review','contacted','quotation_sent','awaiting_customer','confirmed','assigned','in_progress','completed','cancelled','rejected') then raise exception 'Invalid request status'; end if;
  if p_note is not null and length(trim(p_note))>5000 then raise exception 'Note is too long'; end if;
  if p_provider_code is not null and not exists(select 1 from public.service_providers where provider_code=p_provider_code and status=1) then raise exception 'Provider is unavailable'; end if;
  select sr.status into v_previous from public.service_requests sr where sr.id=p_request_id for update;
  if not found then raise exception 'Request not found'; end if;
  return query update public.service_requests sr set status=p_status,updated_by=p_staff_user_id where sr.id=p_request_id returning sr.id,sr.request_code,sr.status,sr.updated_at;
  if p_note is not null and length(trim(p_note))>0 then insert into public.request_notes(service_request_id,author_id,note,is_internal) values(p_request_id,p_staff_user_id,trim(p_note),true); end if;
  if p_provider_code is not null then
    update public.request_assignments set active=false where service_request_id=p_request_id and active and provider_code is not null;
    insert into public.request_assignments(service_request_id,provider_code,assigned_by,active) values(p_request_id,p_provider_code,p_staff_user_id,true);
  end if;
  update public.doorstep_bookings set
    provider_code=coalesce(p_provider_code,provider_code),
    booking_status=case p_status when 'confirmed' then 'confirmed' when 'assigned' then 'assigned' when 'in_progress' then 'in_progress' when 'completed' then 'completed' when 'cancelled' then 'cancelled' else booking_status end,
    updated_at=now()
  where service_request_id=p_request_id;
  insert into public.activity_logs(actor_id,entity_type,entity_id,action,details)
  values(p_staff_user_id,'service_request',p_request_id,'request_updated',jsonb_build_object('previousStatus',v_previous,'newStatus',p_status,'noteAdded',p_note is not null and length(trim(p_note))>0,'providerCode',p_provider_code));
end;
$$;
revoke all on function public.admin_update_service_request(uuid,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.admin_update_service_request(uuid,text,uuid,text,text) to service_role;
