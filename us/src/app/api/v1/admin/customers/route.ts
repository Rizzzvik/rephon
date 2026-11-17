import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireStaff(["admin","super_admin","sales_admin","support_agent"], "customers.read");
    const params = new URL(request.url).searchParams;
    const q = (params.get("q") ?? "").trim().slice(0, 100).replace(/[^\p{L}\p{N}@.+\- ]/gu, " ");
    const limit = Math.min(100, Math.max(1, Number(params.get("limit")) || 25));
    const page = Math.max(0, Number(params.get("page")) || 0);
    const db = createSupabaseServerClient();
    let query = db.from("customers").select("id,full_name,mobile,email,city,pin_code,created_at,last_login_at,auth_user_id,account_status", { count: "exact" }).order("created_at", { ascending: false }).range(page * limit, page * limit + limit - 1);
    if (q) query = query.or(`full_name.ilike.%${q}%,mobile.ilike.%${q}%,email.ilike.%${q}%`);
    const { data, error, count } = await query;
    if (error) throw error;
    const ids = (data ?? []).map((customer) => customer.id);
    const { data: requests, error: requestError } = ids.length ? await db.from("service_requests").select("customer_id").in("customer_id", ids) : { data: [], error: null };
    if (requestError) throw requestError;
    const counts = new Map<string, number>();
    for (const row of requests ?? []) counts.set(row.customer_id, (counts.get(row.customer_id) ?? 0) + 1);
    return NextResponse.json({ data: (data ?? []).map((customer) => ({ ...customer, requestCount: counts.get(customer.id) ?? 0 })), count: count ?? 0, page, limit });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Customer directory unavailable";
    const status = message === "Authentication required" ? 401 : message.includes("authorised") ? 403 : 503;
    return NextResponse.json({ error: status === 401 || status === 403 ? message : "Customer directory is temporarily unavailable." }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const { user } = await requireStaff(["admin", "super_admin"]);
    const body = await request.json() as { id?: unknown; accountStatus?: unknown };
    if (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id)) return NextResponse.json({ error: "A valid customer record is required." }, { status: 400 });
    if (body.accountStatus !== "active" && body.accountStatus !== "blocked") return NextResponse.json({ error: "Choose an active or blocked account status." }, { status: 400 });
    const db = createSupabaseServerClient();
    const { data, error } = await db.from("customers").update({ account_status: body.accountStatus, updated_at: new Date().toISOString() }).eq("id", body.id).select("id,account_status").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Customer not found." }, { status: 404 });
    await db.from("activity_logs").insert({ actor_id: user.id, entity_type: "customer", entity_id: data.id, action: "customer_account_status_changed", details: { accountStatus: data.account_status } });
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Customer update unavailable";
    const status = message === "Authentication required" ? 401 : message.includes("authorised") ? 403 : 503;
    return NextResponse.json({ error: status === 401 || status === 403 ? message : "Customer update is temporarily unavailable." }, { status });
  }
}
