import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isValidMetaSignature } from "@/lib/whatsapp/signature";

export const dynamic = "force-dynamic";

type MetaMessage = { id?: string; from?: string; timestamp?: string; type?: string; text?: { body?: string }; interactive?: { button_reply?: { id?: string; title?: string }; list_reply?: { id?: string; title?: string } }; [key: string]: unknown };
type WebhookBody = { entry?: Array<{ changes?: Array<{ value?: { contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>; messages?: MetaMessage[]; statuses?: Array<{ id?: string; status?: string; timestamp?: string }> } }> }> };

async function sendWhatsAppReply(db: ReturnType<typeof createSupabaseServerClient>, conversationId: string, phone: string, body: Record<string, unknown>) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const version = process.env.WHATSAPP_GRAPH_API_VERSION;
  if (!token || !phoneNumberId || !version) return;
  const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: phone, ...body }) });
  if (!response.ok) throw new Error("WhatsApp reply failed");
  const result = await response.json() as { messages?: Array<{ id?: string }> };
  const textBody = (body.text as { body?: unknown } | undefined)?.body;
  await db.from("whatsapp_messages").insert({ conversation_id: conversationId, provider_message_id: result.messages?.[0]?.id ?? null, direction: "outbound", message_type: body.type ?? "text", message_text: typeof textBody === "string" ? textBody : null, payload: body, delivery_status: "sent" });
}

async function sendMenu(db: ReturnType<typeof createSupabaseServerClient>, conversationId: string, phone: string) {
  await sendWhatsAppReply(db, conversationId, phone, { type: "interactive", interactive: { type: "button", body: { text: "Welcome to REPHON 24X7. What can we help you with today?" }, action: { buttons: [{ type: "reply", reply: { id: "buy", title: "Buy renewed" } }, { type: "reply", reply: { id: "sell", title: "Sell device" } }, { type: "reply", reply: { id: "repair", title: "Repair device" } }] } } });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (url.searchParams.get("hub.mode") === "subscribe" && token && url.searchParams.get("hub.verify_token") === token) return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200, headers: { "content-type": "text/plain" } });
  return NextResponse.json({ error: "Webhook verification failed." }, { status: 403 });
}

export async function POST(request: Request) {
  const secret = process.env.META_APP_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });
  const raw = await request.text();
  if (!isValidMetaSignature(raw, request.headers.get("x-hub-signature-256"), secret)) return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  let body: WebhookBody;
  try { body = JSON.parse(raw) as WebhookBody; }
  catch { return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 }); }
  const db = createSupabaseServerClient();
  const claims: Array<{ eventId: string; token: string }> = [];
  try {
    for (const entry of body.entry ?? []) for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      const names = new Map((value.contacts ?? []).map((contact) => [String(contact.wa_id ?? ""), String(contact.profile?.name ?? "WhatsApp customer").slice(0, 120)]));
      for (const message of value.messages ?? []) {
        const eventId = message.id;
        const phone = String(message.from ?? "").replace(/\D/g, "");
        if (!eventId || !/^\d{8,15}$/.test(phone)) continue;
        const payloadHash = createHash("sha256").update(JSON.stringify(message)).digest("hex");
        const { data: claimToken, error: claimError } = await db.rpc("claim_whatsapp_webhook_event", { p_event_id: eventId, p_payload_hash: payloadHash });
        if (claimError) throw claimError;
        if (!claimToken) continue;
        claims.push({ eventId, token: claimToken });

        const phoneE164 = `+${phone}`;
        const { data: contact, error: contactError } = await db.from("whatsapp_contacts").upsert({ phone_e164: phoneE164, display_name: names.get(phone) ?? "WhatsApp customer" }, { onConflict: "phone_e164" }).select("id,customer_id").single();
        if (contactError) throw contactError;
        const { data: existingConversation, error: conversationError } = await db.from("whatsapp_conversations").select("id,service_request_id").eq("conversation_key", phone).maybeSingle();
        if (conversationError) throw conversationError;
        const { data: conversation, error: saveConversationError } = existingConversation
          ? await db.from("whatsapp_conversations").update({ last_message_at: new Date().toISOString() }).eq("id", existingConversation.id).select("id,service_request_id,status,flow_state").single()
          : await db.from("whatsapp_conversations").insert({ contact_id: contact.id, conversation_key: phone, last_message_at: new Date().toISOString() }).select("id,service_request_id,status,flow_state").single();
        if (saveConversationError) throw saveConversationError;
        const interactive = message.interactive?.button_reply ?? message.interactive?.list_reply;
        const messageText = (typeof message.text?.body === "string" ? message.text.body : interactive?.title)?.slice(0, 4000) ?? null;
        const { error: messageError } = await db.from("whatsapp_messages").insert({ conversation_id: conversation.id, provider_message_id: eventId, direction: "inbound", message_type: String(message.type ?? "unknown").slice(0, 40), message_text: messageText, payload: message });
        if (messageError?.code !== "23505" && messageError) throw messageError;

        let customerId = contact.customer_id as string | null;
        if (!customerId) {
          const { data: foundCustomer, error: findCustomerError } = await db.from("customers").select("id").eq("mobile", phoneE164).maybeSingle();
          if (findCustomerError) throw findCustomerError;
          if (foundCustomer) customerId = foundCustomer.id;
          else {
            const { data: addedCustomer, error: addCustomerError } = await db.from("customers").insert({ full_name: names.get(phone) ?? "WhatsApp customer", mobile: phoneE164 }).select("id").single();
            if (addCustomerError?.code === "23505") {
              const { data: racedCustomer } = await db.from("customers").select("id").eq("mobile", phoneE164).maybeSingle();
              customerId = racedCustomer?.id ?? null;
            } else if (addCustomerError) throw addCustomerError;
            else customerId = addedCustomer.id;
          }
          if (customerId) await db.from("whatsapp_contacts").update({ customer_id: customerId }).eq("id", contact.id);
        }
        let serviceRequestId = conversation.service_request_id as string | null;
        if (!serviceRequestId && customerId) {
          const { data: requestCode, error: codeError } = await db.rpc("reserve_request_code");
          if (codeError) throw codeError;
          const requestDetails = { channel: "whatsapp", conversationId: conversation.id, lastMessage: messageText, messageType: message.type ?? "unknown" };
          const { data: serviceRequest, error: requestError } = await db.from("service_requests").insert({ request_code: requestCode, customer_id: customerId, request_type: "callback", request_source: "whatsapp", status: "submitted", request_details: requestDetails }).select("id").single();
          if (requestError?.code === "23505") {
            const { data: racedRequest } = await db.from("service_requests").select("id").eq("request_source", "whatsapp").eq("request_type", "callback").contains("request_details", { conversationId: conversation.id }).maybeSingle();
            if (racedRequest) { serviceRequestId = racedRequest.id; await db.from("whatsapp_conversations").update({ service_request_id: racedRequest.id }).eq("id", conversation.id); }
          } else if (requestError) throw requestError;
          else { serviceRequestId = serviceRequest.id; await db.from("whatsapp_conversations").update({ service_request_id: serviceRequest.id }).eq("id", conversation.id); }
        }
        const lowerText = (interactive?.id ?? messageText ?? "").trim().toLowerCase();
        const flowState = conversation.flow_state && typeof conversation.flow_state === "object" ? conversation.flow_state as { step?: string; journey?: string; device?: string; area?: string } : {};
        const intent = ["buy", "sell", "repair"].includes(lowerText) ? lowerText : null;
        if (["human", "agent", "person", "support"].includes(lowerText)) {
          await db.from("whatsapp_conversations").update({ status: "handoff", flow_state: { ...flowState, step: "handoff" }, updated_at: new Date().toISOString() }).eq("id", conversation.id);
          await sendWhatsAppReply(db, conversation.id, phone, { type: "text", text: { body: "A REPHON 24X7 team member will follow up here. Your request is in our shared service queue." } }).catch(() => undefined);
        } else if (intent) {
          await db.from("whatsapp_conversations").update({ flow_state: { journey: intent, step: "device" }, status: "open", updated_at: new Date().toISOString() }).eq("id", conversation.id);
          if (serviceRequestId) await db.from("service_requests").update({ request_type: intent, request_details: { channel: "whatsapp", conversationId: conversation.id, journey: intent, lastAnswer: messageText }, updated_at: new Date().toISOString() }).eq("id", serviceRequestId);
          await sendWhatsAppReply(db, conversation.id, phone, { type: "text", text: { body: "Which device model do you need help with? Reply with the brand and model name. You can type HUMAN at any time for our team." } }).catch(() => undefined);
        } else if (flowState.step === "device") {
          await db.from("whatsapp_conversations").update({ flow_state: { ...flowState, step: "area", device: messageText }, updated_at: new Date().toISOString() }).eq("id", conversation.id);
          if (serviceRequestId) await db.from("service_requests").update({ request_details: { channel: "whatsapp", conversationId: conversation.id, journey: flowState.journey, device: messageText }, updated_at: new Date().toISOString() }).eq("id", serviceRequestId);
          await sendWhatsAppReply(db, conversation.id, phone, { type: "text", text: { body: "Thanks. Which city or PIN code should we use to check availability?" } }).catch(() => undefined);
        } else if (flowState.step === "area") {
          await db.from("whatsapp_conversations").update({ flow_state: { ...flowState, step: "handoff", area: messageText }, status: "handoff", updated_at: new Date().toISOString() }).eq("id", conversation.id);
          if (serviceRequestId) await db.from("service_requests").update({ request_details: { channel: "whatsapp", conversationId: conversation.id, journey: flowState.journey, device: flowState.device, area: messageText }, updated_at: new Date().toISOString() }).eq("id", serviceRequestId);
          await sendWhatsAppReply(db, conversation.id, phone, { type: "text", text: { body: "Thank you. A team member will check the current options and reply here shortly." } }).catch(() => undefined);
        } else if (!flowState.step || flowState.step === "handoff") {
          await db.from("whatsapp_conversations").update({ flow_state: { step: "service" }, status: "open", updated_at: new Date().toISOString() }).eq("id", conversation.id);
          await sendMenu(db, conversation.id, phone).catch(() => undefined);
        }
        await db.from("whatsapp_webhook_events").update({ processed_at: new Date().toISOString(), last_error: null, claim_token: null, claimed_at: null }).eq("event_id", eventId).eq("claim_token", claimToken);
      }
      for (const status of value.statuses ?? []) {
        if (!status.id || !status.status) continue;
        const eventId = `${status.id}:${status.status}:${status.timestamp ?? ""}`;
        const payloadHash = createHash("sha256").update(JSON.stringify(status)).digest("hex");
        const { error } = await db.from("whatsapp_webhook_events").insert({ event_id: eventId, payload_hash: payloadHash, processed_at: new Date().toISOString(), processing_attempts: 1 });
        if (error?.code !== "23505" && error) throw error;
        await db.from("whatsapp_messages").update({ delivery_status: String(status.status).slice(0, 40) }).eq("provider_message_id", status.id);
      }
    }
    return NextResponse.json({ received: true });
  } catch {
    for (const claim of claims) await db.from("whatsapp_webhook_events").update({ claim_token: null, claimed_at: null, last_error: "Processing failed; retry is allowed." }).eq("event_id", claim.eventId).eq("claim_token", claim.token);
    return NextResponse.json({ error: "Webhook event could not be processed." }, { status: 500 });
  }
}
