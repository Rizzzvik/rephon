import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { WORKBOOKS, type ImportWorkbook } from "@/lib/imports/workbooks";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ workbook: string }> };
const headers: Record<string, string[]> = {
  BRAND_REGISTRY: ["brand_code","brand_name","brand_slug","product_category","status","notes"],
  PHONE_MODELS: ["brand_code","model_code","brand_name","model_name","model_slug","launch_year","device_type","specifications_json","status","source_reference","verification_status","notes"],
  DEVICE_VARIANTS: ["device_code","brand_code","model_code","variant_code","brand_name","model_name","ram_gb","storage_gb","colour","region","sku","status","repair_enabled","buyback_enabled","resale_enabled","original_reference_price_inr","launch_year","original_price_basis","notes"],
  REPAIR_ISSUES: ["issue_code","issue_name","issue_category","description","status"],
  REPAIR_PRICES: ["device_code","issue_code","part_type","part_grade","part_cost_inr","labour_cost_inr","logistics_cost_inr","margin_inr","customer_price_inr","warranty_days","city","provider_code","valid_from","valid_to","verified","status","notes"],
  REPAIR_COMPONENTS: ["component_code","component_name","related_issue_code","pricing_basis","notes","status"],
  REPAIR_COMPONENT_PRICES: ["device_code","component_code","part_number_or_description","part_grade","part_cost_inr","labour_cost_inr","logistics_cost_inr","margin_inr","customer_price_inr","warranty_days","city","provider_code","valid_from","valid_to","verified","status","notes"],
  CONDITION_GRADES: ["condition_grade","grade_name","criteria","status"],
  BUYBACK_RULES: ["device_code","condition_grade","screen_condition","body_condition","battery_health_min_pct","battery_health_max_pct","functional_status","base_value_inr","deduction_inr","estimated_offer_inr","city","valid_from","valid_to","verified","status","notes"],
  RESALE_INVENTORY: ["inventory_sku","device_code","condition_grade","battery_health_pct","stock_quantity","purchase_cost_inr","refurbishment_cost_inr","selling_price_inr","warranty_days","city","listing_status","date_added","notes"],
  MODEL_PRICE_SETUP: ["device_code","brand_name","model_name","variant_code","ram_gb","storage_gb","colour","condition_grade","battery_health_pct","stock_quantity","purchase_cost_inr","refurbishment_cost_inr","selling_price_inr","warranty_days","city","listing_status","notes","brand_code","original_price_inr","launch_year","age_depreciation_pct","age_depreciation_inr","condition_deduction_inr","calculated_selling_price_inr","approved_price_override_inr","customer_selling_price_inr","age_years","original_price_basis"],
  AGE_DEPRECIATION_POLICY: ["policy_code","brand_code","device_segment","age_from_years","age_to_years","depreciation_pct","effective_from","effective_to","approved","status","notes"],
  CONDITION_DEDUCTION_POLICY: ["deduction_code","condition_area","severity","deduction_type","deduction_value","brand_code","device_segment","approved","status","notes"],
  BUYBACK_MARGIN_POLICY: ["policy_code","city","risk_margin_inr","business_margin_inr","effective_from","effective_to","approved","status","notes"],
  ACCESSORIES: ["accessory_code","accessory_category","brand","accessory_name","compatible_device_code","compatible_model","cost_inr","selling_price_inr","stock_quantity","warranty_days","status","notes"],
  PROVIDERS: ["provider_code","business_name","provider_type","contact_person","phone_e164","email","city","area","full_address","services_offered","working_hours","status","notes"],
};
function addSheet(book: ExcelJS.Workbook, name: string, records: Record<string, unknown>[]) {
  const columns = headers[name];
  const sheet = book.addWorksheet(name);
  sheet.addRow(columns);
  for (const record of records) sheet.addRow(columns.map((column) => record[column] ?? null));
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  return sheet;
}
const errorResponse = (error: unknown) => {
  const message = error instanceof Error ? error.message : "Export failed";
  const status = message === "Authentication required" ? 401 : message.includes("authorised") ? 403 : message.includes("not configured") ? 503 : 500;
  return NextResponse.json({ error: message }, { status });
};

export async function GET(_request: Request, { params }: Context) {
  try {
    await requireStaff(["catalogue_manager", "inventory_manager"], "imports.manage");
    const { workbook: encoded } = await params;
    const workbook = decodeURIComponent(encoded) as ImportWorkbook;
    if (!WORKBOOKS.includes(workbook)) return NextResponse.json({ error: "Unsupported export workbook." }, { status: 404 });
    const db = createSupabaseServerClient();
    const out = new ExcelJS.Workbook();
    out.creator = "REPHON 24X7";
    out.created = new Date();
    const load = async (table: string, select = "*"): Promise<Array<Record<string, unknown>>> => {
      const { data, error } = await db.from(table).select(select);
      if (error) throw error;
      return (data ?? []) as unknown as Array<Record<string, unknown>>;
    };
    const doc = out.addWorksheet("START_HERE");
    doc.addRows([["topic","instruction"],["Export","Generated from the live REPHON 24X7 database."],["Privacy","This export may contain confidential business fields. Store securely."],["Source","PostgreSQL is the live source of truth."]]);
    if (workbook === "DEVICE_MASTER.xlsx") {
      const brands = await load("phone_brands");
      addSheet(out,"BRAND_REGISTRY",brands.map((b)=>({brand_code:b.brand_code,brand_name:b.name,brand_slug:b.slug,product_category:b.product_category,status:b.status,notes:b.notes})));
      const models = await load("phone_models","*,brand:phone_brands!inner(brand_code,name)");
      addSheet(out,"PHONE_MODELS",models.map((m)=>{const rel=m.brand as {brand_code:string;name:string}|{brand_code:string;name:string}[];const b=Array.isArray(rel)?rel[0]:rel;return {brand_code:b.brand_code,model_code:m.model_code,brand_name:b.name,model_name:m.name,model_slug:m.slug,launch_year:m.release_year,device_type:m.device_type,specifications_json:JSON.stringify(m.specifications_json??{}),status:m.status,source_reference:m.source_reference,verification_status:m.verification_status,notes:m.notes};}));
      const variants = await load("phone_variants","*,model:phone_models!inner(model_code,name,brand:phone_brands!inner(brand_code,name))");
      addSheet(out,"DEVICE_VARIANTS",variants.map((v)=>{const m=v.model as {model_code:string;name:string;brand:{brand_code:string;name:string}|{brand_code:string;name:string}[]};const b=Array.isArray(m.brand)?m.brand[0]:m.brand;return {device_code:v.device_code,brand_code:b.brand_code,model_code:m.model_code,variant_code:v.variant_code,brand_name:b.name,model_name:m.name,ram_gb:v.ram_gb,storage_gb:v.storage_gb,colour:v.color,region:v.region,sku:v.sku,status:v.status,repair_enabled:v.repair_enabled,buyback_enabled:v.buyback_enabled,resale_enabled:v.resale_enabled,original_reference_price_inr:v.original_price_inr,launch_year:v.launch_year,original_price_basis:v.original_price_basis,notes:v.notes};}));
      const rules=out.addWorksheet("CODE_RULES");rules.addRows([["rule_id","rule_name","rule"],["C1","Seven-digit code","BBMMM VV stored without separators; codes remain separate fields."],["C2","Status","Device status is stored separately from device_code."]]);
    } else if (workbook === "REPAIR_MASTER.xlsx") {
      addSheet(out,"REPAIR_ISSUES",await load("repair_issues"));
      addSheet(out,"REPAIR_PRICES",await load("repair_price_rules"));
      addSheet(out,"REPAIR_COMPONENTS",await load("repair_components"));
      addSheet(out,"REPAIR_COMPONENT_PRICES",await load("repair_component_price_rules"));
      out.addWorksheet("CODE_RULES").addRows([["rule_id","rule_name","rule"],["R1","Verified pricing","Only verified active prices may be shown."],["R2","Missing price","Use a manual quote when no exact verified price exists."]]);
    } else if (workbook === "BUYBACK_MASTER.xlsx" || workbook === "RESALE_MASTER.xlsx") {
      const grades=await load("condition_grades");
      addSheet(out,"CONDITION_GRADES",grades.map((g)=>({condition_grade:g.grade_code,grade_name:g.grade_name,criteria:g.criteria,status:g.status})));
      if(workbook==="BUYBACK_MASTER.xlsx") addSheet(out,"BUYBACK_RULES",await load("buyback_rules"));
      else {addSheet(out,"RESALE_INVENTORY",await load("resale_inventory"));const setups=await load("model_price_setups");addSheet(out,"MODEL_PRICE_SETUP",setups.map((r)=>({device_code:r.device_code,original_price_inr:r.original_price_inr,original_price_basis:r.original_price_basis,launch_year:r.launch_year,notes:r.notes})));}
      out.addWorksheet("CODE_RULES").addRows([["rule_id","rule_name","rule"],["Q1","Verified records","Unverified records must not be used for customer prices."],["Q2","Inspection","Customer reported condition is not a final inspection."]]);
    } else if (workbook === "ACCESSORIES_MASTER.xlsx") {
      addSheet(out,"ACCESSORIES",await load("accessories"));
      out.addWorksheet("CODE_RULES").addRows([["rule_id","rule_name","rule"],["A1","Compatibility","Compatible devices must be identified by device code or a verified model name."]]);
    } else if(workbook === "PRICING_POLICY_MASTER.xlsx") {
      const policies=await load("pricing_policies");
      addSheet(out,"AGE_DEPRECIATION_POLICY",policies.filter((p)=>p.policy_type==="age_depreciation").map((p)=>{const v=p.policy_values as Record<string,unknown>;return {policy_code:p.policy_code,brand_code:p.brand_code,device_segment:p.device_segment,age_from_years:v.age_from_years,age_to_years:v.age_to_years,depreciation_pct:v.depreciation_pct,effective_from:p.effective_from,effective_to:p.effective_to,approved:p.approved,status:p.status,notes:p.notes};}));
      addSheet(out,"CONDITION_DEDUCTION_POLICY",policies.filter((p)=>p.policy_type==="condition_deduction").map((p)=>{const v=p.policy_values as Record<string,unknown>;return {deduction_code:p.policy_code,condition_area:v.condition_area,severity:v.severity,deduction_type:v.deduction_type,deduction_value:v.deduction_value,brand_code:p.brand_code,device_segment:p.device_segment,approved:p.approved,status:p.status,notes:p.notes};}));
      addSheet(out,"BUYBACK_MARGIN_POLICY",policies.filter((p)=>p.policy_type==="buyback_margin").map((p)=>{const v=p.policy_values as Record<string,unknown>;return {policy_code:p.policy_code,city:p.city,risk_margin_inr:v.risk_margin_inr,business_margin_inr:v.business_margin_inr,effective_from:p.effective_from,effective_to:p.effective_to,approved:p.approved,status:p.status,notes:p.notes};}));
    } else {
      addSheet(out,"PROVIDERS",await load("service_providers"));
      out.addWorksheet("CODE_RULES").addRows([["rule_id","rule_name","rule"],["P1","Privacy","Provider contact and address information is confidential; admin access only."]]);
    }
    const buffer = await out.xlsx.writeBuffer();
    return new NextResponse(new Uint8Array(buffer),{headers:{"content-type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","content-disposition":`attachment; filename="${workbook.replace(".xlsx","-export.xlsx")}"`,"cache-control":"no-store"}});
  } catch (error) { return errorResponse(error); }
}
