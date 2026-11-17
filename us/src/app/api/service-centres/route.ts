import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { data, error } = await createSupabaseServerClient()
      .from("service_centres")
      .select("id, name, address, city, state, postal_code, phone, latitude, longitude")
      .eq("is_active", true)
      .order("city", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ data: (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      address: row.address,
      city: row.city,
      state: row.state,
      postalCode: row.postal_code,
      phone: row.phone,
      latitude: row.latitude,
      longitude: row.longitude,
    })) });
  } catch (error) {
    console.error("Service centre directory query failed", error);
    return NextResponse.json({ error: "Service centre directory is unavailable" }, { status: 503 });
  }
}
