import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/auth/customer";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const mobile = typeof body.mobile === "string" ? body.mobile.replace(/\D/g, "") : "";
    if (!/^[0-9]{10}$/.test(mobile) || typeof body.fullName !== "string" || body.fullName.trim().length < 2) return NextResponse.json({ error: "Enter your name and a valid mobile number." }, { status: 400 });
    const user = await getCustomerSession();
    if (!user) return NextResponse.json({ error: "Sign in with Google before submitting a request." }, { status: 401 });
    const address = typeof body.address === "string" ? body.address.trim() : "";
    const city = typeof body.city === "string" ? body.city.trim() : "";
    const pinCode = typeof body.pinCode === "string" ? body.pinCode.trim() : "";
    const preferredDate = typeof body.preferredDate === "string" ? body.preferredDate : "";
    const timeSlot = typeof body.timeSlot === "string" ? body.timeSlot : "";
    if (address.length < 6 || !city || !/^\d{6}$/.test(pinCode)) return NextResponse.json({ error: "Enter a complete address, city and six-digit PIN code." }, { status: 400 });
    const date = new Date(`${preferredDate}T00:00:00`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(preferredDate) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== preferredDate || preferredDate < new Date().toISOString().slice(0, 10)) return NextResponse.json({ error: "Choose a valid date from today onwards." }, { status: 400 });
    if (!/^(morning|afternoon|evening)$/.test(timeSlot)) return NextResponse.json({ error: "Choose a visit time window." }, { status: 400 });
    const db = createSupabaseServerClient();
    const normalizedPhone = mobile;
    const { data: existing, error: existingError } = await db.from("customers").select("id,auth_user_id").eq("mobile", normalizedPhone).maybeSingle();
    if (existingError) throw existingError;
    if (existing?.auth_user_id && existing.auth_user_id !== user.id) return NextResponse.json({ error: "This mobile number is linked to another account." }, { status: 409 });
    const profile = { full_name: body.fullName.trim().slice(0, 120), mobile: normalizedPhone, email: user.email, pin_code: pinCode, address: address.slice(0, 500), city: city.slice(0, 120), auth_user_id: user.id, last_login_at: new Date().toISOString() };
    const { data: customer, error: customerError } = existing
      ? await db.from("customers").update(profile).eq("id", existing.id).select("id").single()
      : await db.from("customers").insert(profile).select("id").single();
    if (customerError) throw customerError;
    const idempotencyKey = typeof body.idempotencyKey === "string" && /^[\w-]{16,80}$/.test(body.idempotencyKey) ? `doorstep:${user.id}:${body.idempotencyKey}` : null;
    if (idempotencyKey) {
      const { data: prior } = await db.from("service_requests").select("id,request_code").eq("idempotency_key", idempotencyKey).maybeSingle();
      if (prior) return NextResponse.json({ data: { requestId: prior.id, requestCode: prior.request_code } });
    }
    const { data: requestCode, error: codeError } = await db.rpc("reserve_request_code");
    if (codeError || !requestCode) throw codeError ?? new Error("Request reference unavailable");
    const details = { address, city, pinCode, preferredDate, timeSlot, serviceType: "repair", additionalDetails: typeof body.additionalDetails === "string" ? body.additionalDetails.trim().slice(0, 2000) : "" };
    const { data: serviceRequest, error: requestError } = await db.from("service_requests").insert({ request_code: requestCode, customer_id: customer.id, request_type: "doorstep", request_source: "website", status: "submitted", idempotency_key: idempotencyKey, request_details: details }).select("id,request_code").single();
    if (requestError) throw requestError;
    const { error: bookingError } = await db.from("doorstep_bookings").insert({ service_request_id: serviceRequest.id, service_type: "repair", address: details.address, city: details.city, pin_code: details.pinCode, preferred_date: details.preferredDate, preferred_time_slot: details.timeSlot, additional_details: details.additionalDetails, booking_status: "requested" });
    if (bookingError) throw bookingError;
    return NextResponse.json({ data: { requestId: serviceRequest.id, requestCode: serviceRequest.request_code, status: "requested" } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "The doorstep request could not be saved. Please try again or contact support." }, { status: 503 });
  }
}
