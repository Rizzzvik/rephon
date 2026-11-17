import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  try {
    await requireStaff(["admin"]);
    const { id } = await params;
    const body = await request.json() as { status?: number; isPrimary?: boolean; sortOrder?: number };
    const db = createSupabaseServerClient();
    const { data: current, error: findError } = await db.from("phone_images").select("id,device_code,model_id,variant_id,usage_permission").eq("id", id).single();
    if (findError || !current) return NextResponse.json({ error: "Image record not found." }, { status: 404 });
    if (body.status !== undefined && ![0, 1].includes(body.status)) return NextResponse.json({ error: "status must be 0 or 1." }, { status: 400 });
    if (body.status === 1 && !["owned", "licensed", "manufacturer-approved"].includes(current.usage_permission)) return NextResponse.json({ error: "Image usage rights must be approved before publishing." }, { status: 409 });
    if (body.isPrimary) {
      let clearQuery = db.from("phone_images").update({ is_primary: false }).neq("id", id);
      if (current.device_code) clearQuery = clearQuery.eq("device_code", current.device_code);
      else if (current.variant_id) clearQuery = clearQuery.eq("variant_id", current.variant_id);
      else if (current.model_id) clearQuery = clearQuery.eq("model_id", current.model_id).is("variant_id", null);
      const { error } = await clearQuery;
      if (error) throw error;
    }
    const update: Record<string, unknown> = {};
    if (body.status !== undefined) { update.status = body.status; update.approved_at = body.status === 1 ? new Date().toISOString() : null; }
    if (body.isPrimary !== undefined) update.is_primary = body.isPrimary;
    if (body.sortOrder !== undefined && Number.isInteger(body.sortOrder) && body.sortOrder >= 0 && body.sortOrder < 10000) update.sort_order = body.sortOrder;
    const { data, error } = await db.from("phone_images").update(update).eq("id", id).select("id,status,is_primary,sort_order").single();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image update failed";
    const status = message === "Authentication required" ? 401 : message.includes("authorised") ? 403 : 503;
    return NextResponse.json({ error: message }, { status });
  }
}
