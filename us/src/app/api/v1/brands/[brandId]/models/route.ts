import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ brandId: string }> };

export async function GET(request: Request, { params }: Context) {
  try {
    const { brandId } = await params;
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80).replace(/[%,()_*]/g, " ");
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 30));
    const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
    const service = url.searchParams.get("service");
    if (service && !["buy", "sell", "repair"].includes(service)) return NextResponse.json({ error: "Unsupported service filter." }, { status: 400 });
    const db = createSupabaseServerClient();
    let brandQuery = db.from("phone_brands").select("id");
    brandQuery = /^[0-9a-f-]{36}$/i.test(brandId) ? brandQuery.eq("id", brandId) : brandQuery.eq("slug", brandId);
    const { data: brand, error: brandError } = await brandQuery.maybeSingle();
    if (brandError) throw brandError;
    if (!brand) return NextResponse.json({ data: [], count: 0 });
    let query = db.from("phone_models").select("id,brand_id,model_code,name,slug,release_year,launch_date,device_type")
      .eq("brand_id", brand.id).order("name").limit(1000);
    if (q) query = query.ilike("name", `%${q.replace(/[\\%_]/g, "\\$&")}%`);
    const { data: allModels, error } = await query;
    if (error) throw error;
    const models = allModels ?? [];
    return NextResponse.json({ data: models.slice(offset, offset + limit), count: models.length });
  } catch {
    return NextResponse.json({ error: "Device catalogue is unavailable." }, { status: 503 });
  }
}
