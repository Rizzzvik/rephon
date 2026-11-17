import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ modelId: string }> };

export async function GET(request: Request, { params }: Context) {
  try {
    const { modelId } = await params;
    const service = new URL(request.url).searchParams.get("service");
    if (service && !["buy", "sell", "repair"].includes(service)) return NextResponse.json({ error: "Unsupported service filter." }, { status: 400 });
    const db = createSupabaseServerClient();
    const { data: model, error: modelError } = await db.from("phone_models").select("id")
      .eq("id", modelId).maybeSingle();
    if (modelError) throw modelError;
    if (!model) return NextResponse.json({ data: [] });
    const query = db.from("phone_variants").select("id,model_id,device_code,variant_code,ram_gb,storage_gb,color,region,repair_enabled,buyback_enabled,resale_enabled")
      .eq("model_id", model.id).neq("variant_code", "00").not("device_code", "is", null).order("storage_gb").limit(100);
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ data: data ?? [] });
  } catch {
    return NextResponse.json({ error: "Device catalogue is unavailable." }, { status: 503 });
  }
}
