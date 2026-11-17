import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/auth/customer";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCustomerSession();
  if (!user) return NextResponse.json({ error: "Sign in with Google to track a request." }, { status: 401 });
  const code = new URL(request.url).searchParams.get("code")?.trim() ?? "";
  if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: "Enter a six-digit request ID." }, { status: 400 });
  try {
    const db = createSupabaseServerClient();
    const { data: customer, error: customerError } = await db.from("customers").select("id").eq("auth_user_id", user.id).maybeSingle();
    if (customerError) throw customerError;
    if (!customer) return NextResponse.json({ error: "No request was found for this verified account." }, { status: 404 });
    const { data: record, error } = await db.from("service_requests").select("id,request_code,request_type,request_source,status,created_at,updated_at,request_details").eq("request_code", code).eq("customer_id", customer.id).maybeSingle();
    if (error) throw error;
    if (!record) return NextResponse.json({ error: "No request was found for this code and Google account." }, { status: 404 });
    const { data: history, error: historyError } = await db.from("request_status_history").select("previous_status,new_status,note,created_at").eq("service_request_id", record.id).order("created_at", { ascending: true });
    if (historyError) throw historyError;
    return NextResponse.json({ data: { requestCode: record.request_code, type: record.request_type, source: record.request_source, status: record.status, submittedAt: record.created_at, updatedAt: record.updated_at, timeline: history ?? [] } });
  } catch {
    return NextResponse.json({ error: "Request tracking is temporarily unavailable." }, { status: 503 });
  }
}
