import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const fields = "id,name,address,city,state,postal_code,phone,latitude,longitude,is_active,area,whatsapp_phone,opening_hours,services,photo_url,is_demo,created_at";

export async function GET() {
  try {
    await requireStaff(["location_manager"], "locations.manage");
    const { data, error } = await createSupabaseServerClient().from("service_centres").select(fields).order("city").order("name");
    if (error) throw error;
    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Location directory unavailable";
    const status = message === "Authentication required" ? 401 : message.includes("authorised") ? 403 : 503;
    return NextResponse.json({ error: status === 401 || status === 403 ? message : "Location directory is temporarily unavailable." }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireStaff(["location_manager"], "locations.manage");
    const body = await request.json() as Record<string, unknown>;
    const text = (key: string, max = 200) => typeof body[key] === "string" ? (body[key] as string).trim().slice(0, max) : "";
    const name = text("name"), address = text("address", 500), city = text("city"), state = text("state");
    if (!name || !address || !city || !state) return NextResponse.json({ error: "Name, address, city, and state are required." }, { status: 400 });
    const coordinate = (key: string) => body[key] === "" || body[key] == null ? null : Number(body[key]);
    const latitude = coordinate("latitude"), longitude = coordinate("longitude");
    if ((latitude === null) !== (longitude === null) || latitude !== null && (!Number.isFinite(latitude) || Math.abs(latitude) > 90) || longitude !== null && (!Number.isFinite(longitude) || Math.abs(longitude) > 180)) return NextResponse.json({ error: "Enter a valid latitude and longitude together." }, { status: 400 });
    const serviceList = Array.isArray(body.services) ? body.services.filter((item): item is string => typeof item === "string").map((item) => item.trim().slice(0, 80)).filter(Boolean).slice(0, 30) : [];
    const db = createSupabaseServerClient();
    const { data, error } = await db.from("service_centres").insert({ name, address, city, state, postal_code: text("postal_code", 20) || null, phone: text("phone", 30) || null, latitude, longitude, area: text("area", 120) || null, whatsapp_phone: text("whatsapp_phone", 30) || null, opening_hours: body.opening_hours && typeof body.opening_hours === "object" ? body.opening_hours : {}, services: serviceList, photo_url: text("photo_url", 500) || null, is_demo: false, is_active: true }).select(fields).single();
    if (error) throw error;
    await db.from("activity_logs").insert({ actor_id: user.id, entity_type: "service_centre", entity_id: data.id, action: "service_centre_created", details: { name } });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Location save failed";
    const status = message === "Authentication required" ? 401 : message.includes("authorised") ? 403 : 503;
    return NextResponse.json({ error: status === 401 || status === 403 ? message : "Location could not be saved." }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const { user } = await requireStaff(["location_manager"], "locations.manage");
    const body = await request.json() as Record<string, unknown>;
    if (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id)) return NextResponse.json({ error: "Choose a valid location." }, { status: 400 });
    const db = createSupabaseServerClient();
    let update: Record<string, unknown>;
    if (typeof body.is_active === "boolean" && typeof body.name !== "string") update = { is_active: body.is_active, updated_at: new Date().toISOString() };
    else {
      const text = (key: string, max = 200) => typeof body[key] === "string" ? (body[key] as string).trim().slice(0, max) : "";
      const name=text("name"),address=text("address",500),city=text("city"),state=text("state");
      if(!name||!address||!city||!state)return NextResponse.json({error:"Name, address, city, and state are required."},{status:400});
      const latitude=body.latitude===""||body.latitude==null?null:Number(body.latitude),longitude=body.longitude===""||body.longitude==null?null:Number(body.longitude);
      if((latitude===null)!==(longitude===null)||latitude!==null&&(!Number.isFinite(latitude)||Math.abs(latitude)>90)||longitude!==null&&(!Number.isFinite(longitude)||Math.abs(longitude)>180))return NextResponse.json({error:"Enter a valid latitude and longitude together."},{status:400});
      update={name,address,city,state,postal_code:text("postal_code",20)||null,phone:text("phone",30)||null,latitude,longitude,area:text("area",120)||null,whatsapp_phone:text("whatsapp_phone",30)||null,services:Array.isArray(body.services)?body.services.filter((item):item is string=>typeof item==="string").map(item=>item.trim().slice(0,80)).filter(Boolean).slice(0,30):[],photo_url:text("photo_url",500)||null,is_active:body.is_active===false?false:true,updated_at:new Date().toISOString()};
    }
    const { data, error } = await db.from("service_centres").update(update).eq("id", body.id).select("id,name,is_active").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Location not found." }, { status: 404 });
    await db.from("activity_logs").insert({ actor_id: user.id, entity_type: "service_centre", entity_id: data.id, action: "service_centre_updated", details: { is_active: data.is_active } });
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Location update failed";
    const status = message === "Authentication required" ? 401 : message.includes("authorised") ? 403 : 503;
    return NextResponse.json({ error: status === 401 || status === 403 ? message : "Location could not be updated." }, { status });
  }
}
