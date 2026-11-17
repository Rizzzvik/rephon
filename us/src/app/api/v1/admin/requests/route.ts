import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const REQUEST_TYPES = ["buy", "sell", "repair", "doorstep", "callback"] as const;
const REQUEST_STATUSES = ["initiated", "otp_verified", "submitted", "under_review", "contacted", "quotation_sent", "awaiting_customer", "confirmed", "assigned", "in_progress", "completed", "cancelled", "rejected"] as const;

export async function GET(request: Request) {
  try {
    await requireStaff(["admin", "super_admin", "sales_admin", "repair_admin", "support_agent", "inspector"], "requests.read");
    const url = new URL(request.url);
    const type = url.searchParams.get("journey");
    const source = url.searchParams.get("source");
    const status = url.searchParams.get("status");
    const search = url.searchParams.get("q")?.trim();
    if (type && !REQUEST_TYPES.includes(type as typeof REQUEST_TYPES[number])) return NextResponse.json({ error: "Unknown request type." }, { status: 400 });
    if (status && !REQUEST_STATUSES.includes(status as typeof REQUEST_STATUSES[number])) return NextResponse.json({ error: "Unknown request status." }, { status: 400 });
    if (source && !["website", "whatsapp", "admin", "callback", "other"].includes(source)) return NextResponse.json({ error: "Unknown request source." }, { status: 400 });
    const db = createSupabaseServerClient();
    let query = db.from("service_requests").select("id,request_code,request_type,request_source,status,created_at,device_code,questionnaire_submission_id,request_details,customers!inner(full_name,mobile,email,city,pin_code)").order("created_at", { ascending: false }).limit(100);
    if (type) query = query.eq("request_type", type);
    if (source) query = query.eq("request_source", source);
    if (status) query = query.eq("status", status);
    if (search) {
      const safeSearch = search.trim().slice(0, 100).replace(/[%_,()]/g, " ");
      const digits = safeSearch.replace(/\D/g, "");
      if (/^\d{6}$/.test(digits)) query = query.eq("request_code", digits);
      else if (/^[0-9a-f-]{36}$/i.test(safeSearch)) query = query.eq("id", safeSearch);
      else {
        const dbSearch = createSupabaseServerClient();
        const [customers, models, exactDevice] = await Promise.all([
          dbSearch.from("customers").select("id").or(`full_name.ilike.%${safeSearch}%,mobile.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%`).limit(200),
          dbSearch.from("phone_models").select("id").ilike("name", `%${safeSearch}%`).limit(100),
          /^\d{7}$/.test(digits) ? dbSearch.from("phone_variants").select("device_code").eq("device_code", digits) : Promise.resolve({ data: [], error: null }),
        ]);
        if (customers.error) throw customers.error;
        if (models.error) throw models.error;
        if (exactDevice.error) throw exactDevice.error;
        const modelIds = (models.data ?? []).map((row) => row.id);
        const variants = modelIds.length ? await dbSearch.from("phone_variants").select("device_code").in("model_id", modelIds).limit(300) : { data: [], error: null };
        if (variants.error) throw variants.error;
        const customerIds = (customers.data ?? []).map((row) => row.id);
        const deviceCodes = [...new Set([...(exactDevice.data ?? []).map((row) => row.device_code), ...(variants.data ?? []).map((row) => row.device_code)].filter((value): value is string => Boolean(value)))];
        if (!customerIds.length && !deviceCodes.length) return NextResponse.json({ data: [], providers: [] });
        if (customerIds.length && deviceCodes.length) query = query.or(`customer_id.in.(${customerIds.join(",")}),device_code.in.(${deviceCodes.join(",")})`);
        else if (customerIds.length) query = query.in("customer_id", customerIds);
        else query = query.in("device_code", deviceCodes);
      }
    }
    const { data, error } = await query;
    if (error) throw error;
    const submissionIds = (data ?? []).map((row) => row.questionnaire_submission_id).filter((id): id is string => Boolean(id));
    const { data: submissions, error: submissionError } = submissionIds.length
      ? await db.from("questionnaire_submissions").select("id,original_answers,sell_requests(id,indicative_offer_inr,final_offer_inr,buyback_inspections(id,final_grade,inspected_at)),repair_requests(id,issue_codes,quote_required),buy_enquiries(id)").in("id", submissionIds)
      : { data: [], error: null };
    if (submissionError) throw submissionError;
    const bySubmission = new Map((submissions ?? []).map((row) => [row.id, row]));
    const requestIds = (data ?? []).map((row) => row.id);
    const [historyResult, notesResult, assignmentsResult, conversationsResult, doorstepResult] = requestIds.length ? await Promise.all([
      db.from("request_status_history").select("service_request_id,previous_status,new_status,note,created_at,changed_by").in("service_request_id", requestIds).order("created_at", { ascending: true }),
      db.from("request_notes").select("service_request_id,note,created_at,author_id,is_internal").in("service_request_id", requestIds).order("created_at", { ascending: false }),
      db.from("request_assignments").select("service_request_id,staff_user_id,provider_code,active,created_at").in("service_request_id", requestIds).eq("active", true),
      db.from("whatsapp_conversations").select("id,service_request_id,conversation_key,last_message_at").in("service_request_id", requestIds),
      db.from("doorstep_bookings").select("service_request_id,service_type,address,area,city,pin_code,landmark,preferred_date,preferred_time_slot,booking_status,provider_code").in("service_request_id", requestIds),
    ]) : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }, { data: [], error: null }, { data: [], error: null }];
    for (const result of [historyResult, notesResult, assignmentsResult, conversationsResult, doorstepResult]) if (result.error) throw result.error;
    const conversationIds = (conversationsResult.data ?? []).map((row) => row.id);
    const { data: whatsappMessages, error: whatsappError } = conversationIds.length ? await db.from("whatsapp_messages").select("conversation_id,direction,message_type,message_text,delivery_status,created_at").in("conversation_id", conversationIds).order("created_at", { ascending: true }).limit(500) : { data: [], error: null };
    if (whatsappError) throw whatsappError;
    const [{ data: providers, error: providersError }, { data: conditionGrades, error: gradesError }] = await Promise.all([
      db.from("service_providers").select("provider_code,business_name,city,area").eq("status", 1).order("business_name").limit(250),
      db.from("condition_grades").select("grade_code,grade_name").eq("status", 1).order("grade_name"),
    ]);
    if (providersError) throw providersError;
    if (gradesError) throw gradesError;
    const rows = (data ?? []).map((row) => {
      const submission = row.questionnaire_submission_id ? bySubmission.get(row.questionnaire_submission_id) : null;
      const conversation = (conversationsResult.data ?? []).find((item) => item.service_request_id === row.id);
      return {
        ...row,
        reference: row.request_code,
        journey: row.request_type,
        original_answers: submission?.original_answers ?? row.request_details,
        sell_requests: submission?.sell_requests ?? [],
        repair_requests: submission?.repair_requests ?? [],
        buy_enquiries: submission?.buy_enquiries ?? [],
        status_history: (historyResult.data ?? []).filter((item) => item.service_request_id === row.id),
        internal_notes: (notesResult.data ?? []).filter((item) => item.service_request_id === row.id),
        assignments: (assignmentsResult.data ?? []).filter((item) => item.service_request_id === row.id),
        whatsapp_messages: conversation ? (whatsappMessages ?? []).filter((item) => item.conversation_id === conversation.id) : [],
        doorstep_booking: (doorstepResult.data ?? []).find((item) => item.service_request_id === row.id) ?? null,
      };
    });
    return NextResponse.json({ data: rows, providers: providers ?? [], conditionGrades: conditionGrades ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request list unavailable";
    const status = message === "Authentication required" ? 401 : message.includes("authorised") ? 403 : 503;
    return NextResponse.json({ error: status === 401 || status === 403 ? message : "Request list is temporarily unavailable." }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const { user } = await requireStaff(["admin", "super_admin", "sales_admin", "repair_admin", "support_agent", "inspector"], "requests.update");
    const body = await request.json() as { id?: unknown; status?: unknown; note?: unknown; providerCode?: unknown };
    if (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id)) return NextResponse.json({ error: "A valid request record is required." }, { status: 400 });
    if (typeof body.status !== "string" || !REQUEST_STATUSES.includes(body.status as typeof REQUEST_STATUSES[number])) return NextResponse.json({ error: "Choose a valid request status." }, { status: 400 });
    if (body.providerCode !== undefined && body.providerCode !== null && (typeof body.providerCode !== "string" || body.providerCode.length > 40)) return NextResponse.json({ error: "Choose a valid service provider." }, { status: 400 });
    const note = typeof body.note === "string" ? body.note.trim() : "";
    if (note.length > 5000) return NextResponse.json({ error: "Notes must be 5,000 characters or less." }, { status: 400 });
    const db = createSupabaseServerClient();
    const providerCode = typeof body.providerCode === "string" && body.providerCode ? body.providerCode : null;
    const { data, error } = providerCode
      ? await db.rpc("admin_update_service_request", { p_request_id: body.id, p_status: body.status, p_staff_user_id: user.id, p_note: note || null, p_provider_code: providerCode })
      : await db.rpc("admin_update_service_request", { p_request_id: body.id, p_status: body.status, p_staff_user_id: user.id, p_note: note || null });
    if (error) throw error;
    const updated = Array.isArray(data) ? data[0] : data;
    if (!updated) return NextResponse.json({ error: "Request not found." }, { status: 404 });
    return NextResponse.json({ data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request update unavailable";
    const status = message === "Authentication required" ? 401 : message.includes("authorised") ? 403 : 503;
    return NextResponse.json({ error: status === 401 || status === 403 ? message : "Request update is temporarily unavailable." }, { status });
  }
}
