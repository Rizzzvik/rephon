import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireStaff(["repair_admin", "sales_admin"]);
    const db = createSupabaseServerClient();
    const [policies, repairs, components, buybacks, modelMarket, modelRepair, modelDeductions] = await Promise.all([
      db.from("pricing_policies").select("id,policy_code,policy_type,brand_code,device_segment,city,policy_values,approved,status,effective_from,effective_to,created_at").order("created_at", { ascending: false }).limit(300),
      db.from("repair_price_rules").select("id,rule_key,device_code,issue_code,part_type,customer_price_inr,warranty_days,city,verified,status,valid_from,valid_to,created_at").order("created_at", { ascending: false }).limit(300),
      db.from("repair_component_price_rules").select("id,rule_key,device_code,component_code,customer_price_inr,warranty_days,city,verified,status,approved_at,created_at").order("created_at", { ascending: false }).limit(300),
      db.from("buyback_rules").select("id,rule_key,device_code,condition_grade,estimated_offer_inr,city,verified,status,valid_from,valid_to,created_at").order("created_at", { ascending: false }).limit(300),
      db.from("model_market_price_tags").select("id,buy_price_inr,buy_confidence,buy_source,sell_baseline_inr,sell_confidence,sell_source,market_scope,price_as_of,source_sheet,source_row,verification_status,is_active,created_at,model:phone_models!inner(name,brand:phone_brands!inner(name,brand_code))").order("created_at",{ascending:false}).limit(250),
      db.from("model_repair_price_tags").select("id,component_code,component_name,price_inr,price_basis,source_name,price_scope,confidence,source_sheet,source_row,verification_status,is_active,created_at,model:phone_models!inner(name,model_code,brand:phone_brands!inner(name,brand_code))").order("created_at",{ascending:false}).limit(250),
      db.from("model_component_deduction_tags").select("id,component_code,component_name,sell_baseline_inr,repair_reference_inr,minor_fault_pct,moderate_fault_pct,major_fault_pct,confidence_note,source_sheet,source_row,verification_status,is_active,created_at,model:phone_models!inner(name,model_code,brand:phone_brands!inner(name,brand_code))").order("created_at",{ascending:false}).limit(250),
    ]);
    const error = [policies.error, repairs.error, components.error, buybacks.error,modelMarket.error,modelRepair.error,modelDeductions.error].find(Boolean);
    if (error) throw error;
    const modelReferences=[...(modelMarket.data??[]).map((row)=>({...row,review_kind:"modelMarket"})),...(modelRepair.data??[]).map((row)=>({...row,review_kind:"modelRepair"})),...(modelDeductions.data??[]).map((row)=>({...row,review_kind:"modelDeductions"}))];
    return NextResponse.json({ data: { policies: policies.data ?? [], repairRules: repairs.data ?? [], componentRules: components.data ?? [], buybackRules: buybacks.data ?? [],modelReferences } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pricing review unavailable";
    const status = message === "Authentication required" ? 401 : message.includes("authorised") ? 403 : 503;
    return NextResponse.json({ error: status === 401 || status === 403 ? message : "Pricing review is temporarily unavailable." }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, role } = await requireStaff(["repair_admin", "sales_admin"]);
    const body = await request.json() as { kind?: unknown; id?: unknown; approved?: unknown };
    if (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id) || typeof body.approved !== "boolean" || !["policy", "repair", "component", "buyback","modelMarket","modelRepair","modelDeductions"].includes(String(body.kind))) return NextResponse.json({ error: "Choose a price record and approval state." }, { status: 400 });
    const salesKind=["buyback","modelMarket","modelDeductions"].includes(String(body.kind));
    if (!( ["admin", "super_admin"].includes(role)) && (salesKind ? role !== "sales_admin" : role !== "repair_admin")) return NextResponse.json({ error: "Your role cannot approve this price type." }, { status: 403 });
    const db = createSupabaseServerClient();
    const modelKind=String(body.kind).startsWith("model");
    const table = body.kind === "policy" ? "pricing_policies" : body.kind === "repair" ? "repair_price_rules" : body.kind === "component" ? "repair_component_price_rules" : body.kind === "buyback" ? "buyback_rules" : body.kind === "modelMarket" ? "model_market_price_tags" : body.kind === "modelRepair" ? "model_repair_price_tags" : "model_component_deduction_tags";
    const values = modelKind ? { verification_status:body.approved?"verified":"inactive",is_active:body.approved,approved_by:body.approved?user.id:null,approved_at:body.approved?new Date().toISOString():null,updated_at:new Date().toISOString() } : body.kind === "policy" ? { approved: body.approved, status: body.approved ? 1 : 0, approved_by: body.approved ? user.id : null, approved_at: body.approved ? new Date().toISOString() : null, updated_at: new Date().toISOString() } : { verified: body.approved, status: body.approved ? 1 : 0, ...(body.kind === "component" ? { approved_by: body.approved ? user.id : null, approved_at: body.approved ? new Date().toISOString() : null } : {}), updated_at: new Date().toISOString() };
    const { data, error } = await db.from(table).update(values).eq("id", body.id).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Price record not found." }, { status: 404 });
    await db.from("activity_logs").insert({ actor_id: user.id, entity_type: `pricing_${body.kind}`, entity_id: data.id, action: body.approved ? "pricing_approved" : "pricing_deactivated", details: { kind: body.kind } });
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pricing update unavailable";
    const status = message === "Authentication required" ? 401 : message.includes("authorised") ? 403 : 503;
    return NextResponse.json({ error: status === 401 || status === 403 ? message : "Price record could not be updated." }, { status });
  }
}


