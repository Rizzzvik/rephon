import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const fields = "id,provider_code,business_name,provider_type,contact_person,phone_e164,email,city,area,full_address,services_offered,working_hours,status,notes,latitude,longitude,is_demo,brands_supported,opening_hours,created_at";

export async function GET() {
  try {
    await requireStaff(["location_manager"], "providers.manage");
    const { data, error } = await createSupabaseServerClient().from("service_providers").select(fields).order("business_name");
    if (error) throw error;
    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Provider directory unavailable";
    const status = message === "Authentication required" ? 401 : message.includes("authorised") ? 403 : 503;
    return NextResponse.json({ error: status === 401 || status === 403 ? message : "Provider directory is temporarily unavailable." }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireStaff(["location_manager"], "providers.manage");
    const body = await request.json() as Record<string, unknown>;
    const text = (key: string, max = 200) => typeof body[key] === "string" ? (body[key] as string).trim().slice(0, max) : "";
    const providerCode = text("provider_code", 40).toUpperCase(), businessName = text("business_name");
    if (!/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(providerCode) || !businessName) return NextResponse.json({ error: "Enter a unique provider code and business name." }, { status: 400 });
    const latitude = body.latitude === "" || body.latitude == null ? null : Number(body.latitude), longitude = body.longitude === "" || body.longitude == null ? null : Number(body.longitude);
    if ((latitude === null) !== (longitude === null) || latitude !== null && (!Number.isFinite(latitude) || Math.abs(latitude) > 90) || longitude !== null && (!Number.isFinite(longitude) || Math.abs(longitude) > 180)) return NextResponse.json({ error: "Enter a valid latitude and longitude together." }, { status: 400 });
    const db = createSupabaseServerClient();
    const { data, error } = await db.from("service_providers").insert({ provider_code: providerCode, business_name: businessName, provider_type: text("provider_type", 80) || null, contact_person: text("contact_person", 150) || null, phone_e164: text("phone_e164", 24) || null, email: text("email", 254) || null, city: text("city", 100) || null, area: text("area", 120) || null, full_address: text("full_address", 500) || null, services_offered: text("services_offered", 500) || null, working_hours: text("working_hours", 200) || null, notes: text("notes", 2000) || null, latitude, longitude, is_demo: false, brands_supported: Array.isArray(body.brands_supported)?body.brands_supported.filter((v):v is string=>typeof v==="string").map((v)=>v.trim().slice(0,30)).filter(Boolean).slice(0,50):[], status: 1 }).select(fields).single();
    if (error) throw error;
    await db.from("activity_logs").insert({ actor_id: user.id, entity_type: "service_provider", entity_id: data.id, action: "service_provider_created", details: { providerCode, businessName } });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Provider save failed";
    const status = message === "Authentication required" ? 401 : message.includes("authorised") ? 403 : 503;
    return NextResponse.json({ error: status === 401 || status === 403 ? message : "Provider could not be saved. Check for an existing provider code." }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const { user } = await requireStaff(["location_manager"], "providers.manage");
    const body = await request.json() as Record<string, unknown>;
    if (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id)) return NextResponse.json({ error: "Choose a valid provider." }, { status: 400 });
    const db = createSupabaseServerClient();
    let update: Record<string, unknown>;
    if ((body.status === 0 || body.status === 1) && typeof body.business_name !== "string") update = { status: body.status, updated_at: new Date().toISOString() };
    else { const text=(key:string,max=200)=>typeof body[key]==="string"?(body[key] as string).trim().slice(0,max):"";const businessName=text("business_name"),providerCode=text("provider_code",40).toUpperCase();if(!businessName||!(/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(providerCode)))return NextResponse.json({error:"Enter a provider code and business name."},{status:400});const latitude=body.latitude===""||body.latitude==null?null:Number(body.latitude),longitude=body.longitude===""||body.longitude==null?null:Number(body.longitude);if((latitude===null)!==(longitude===null)||latitude!==null&&(!Number.isFinite(latitude)||Math.abs(latitude)>90)||longitude!==null&&(!Number.isFinite(longitude)||Math.abs(longitude)>180))return NextResponse.json({error:"Enter valid latitude and longitude together."},{status:400});update={provider_code:providerCode,business_name:businessName,provider_type:text("provider_type",80)||null,contact_person:text("contact_person",150)||null,phone_e164:text("phone_e164",24)||null,email:text("email",254)||null,city:text("city",100)||null,area:text("area",120)||null,full_address:text("full_address",500)||null,services_offered:text("services_offered",500)||null,working_hours:text("working_hours",200)||null,notes:text("notes",2000)||null,latitude,longitude,brands_supported:Array.isArray(body.brands_supported)?body.brands_supported.filter((v):v is string=>typeof v==="string").map(v=>v.trim().slice(0,30)).filter(Boolean).slice(0,50):[],status:body.status===0?0:1,updated_at:new Date().toISOString()}; }
    const { data, error } = await db.from("service_providers").update(update).eq("id", body.id).select("id,provider_code,business_name,status").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Provider not found." }, { status: 404 });
    await db.from("activity_logs").insert({ actor_id: user.id, entity_type: "service_provider", entity_id: data.id, action: "service_provider_status_changed", details: { status: data.status } });
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Provider update failed";
    const status = message === "Authentication required" ? 401 : message.includes("authorised") ? 403 : 503;
    return NextResponse.json({ error: status === 401 || status === 403 ? message : "Provider could not be updated." }, { status });
  }
}
