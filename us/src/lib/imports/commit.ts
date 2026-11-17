import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { mapWorkbookRows, type ImportWorkbook } from "./workbooks";

type StagedRows = Record<string, Array<Record<string, unknown>>>;
type StagedReport = { rows?: StagedRows; stagedRowsGzip?: string; sheets?: Array<{ name: string }> };
type ImportBatch = { id: string; workbook: ImportWorkbook; status: string; report: StagedReport; total_rows: number };

async function readAllPages<T, E>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: E | null }>) {
  const pageSize = 500;
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return rows;
  }
}

const asBool = (value: unknown) => value === true || value === "1" || Number(value) === 1;
const text = (value: unknown) => String(value ?? "").trim();
const stableRuleKey = (kind:string,row:Record<string,unknown>,fields:string[]) => `${kind}:${createHash("sha256").update(fields.map((field)=>text(row[field]).toLowerCase()).join("\u001f")).digest("hex")}`;

async function upsert(client: SupabaseClient, table: string, values: Record<string, unknown>[], onConflict: string) {
  if (!values.length) return 0;
  for (let start = 0; start < values.length; start += 1000) {
    const { error } = await client.from(table).upsert(values.slice(start, start + 1000), { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  return values.length;
}

export async function commitImport(client: SupabaseClient, batch: ImportBatch, actorId: string) {
  if (batch.status !== "preview") throw new Error("Only a preview batch can be committed.");
  const rows = batch.report.rows ?? (batch.report.stagedRowsGzip
    ? JSON.parse(gunzipSync(Buffer.from(batch.report.stagedRowsGzip, "base64")).toString("utf8")) as StagedRows
    : {});
  const count: Record<string, number> = {};
  const note = (table: string, n: number) => { count[table] = (count[table] ?? 0) + n; };

  if(batch.workbook === "REPHON_24X7_COMPLETE_MODEL_CATALOGUE_2019_2026.xlsx") {
    const sourceRows=[...(rows.MODEL_NET_PRICE_TAGS??[]),...(rows.REPAIR_PART_NET_TAGS??[]),...(rows.COMPONENT_DEDUCTION_MATRIX??[])];
    const brands=new Map<string,string>();const models=new Map<string,{brand:string;code:string;name:string;year:unknown}>();
    for(const r of sourceRows){const brand=text(r.brand_code).padStart(2,"0"),model=text(r.model_code).padStart(3,"0");brands.set(brand,text(r.brand_name));models.set(`${brand}:${model}`,{brand,code:model,name:text(r.model_name),year:r.launch_year??null});}
    const existingBrands=await readAllPages((from,to)=>client.from("phone_brands").select("id,brand_code,name,slug").order("id").range(from,to));
    const brandByCode=new Map((existingBrands??[]).filter((r)=>r.brand_code).map((r)=>[String(r.brand_code),r]));
    const newBrands=[...brands].filter(([code])=>!brandByCode.has(code)).map(([code,name])=>({brand_code:code,name,slug:`${name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}-${code}`,is_active:false,status:0,verification_status:"needs_review",notes:"Imported as an inactive catalogue reference from the REPHON source workbook; verify before publishing."}));
    note("phone_brands",await upsert(client,"phone_brands",newBrands,"brand_code"));
    const allBrands=await readAllPages((from,to)=>client.from("phone_brands").select("id,brand_code,name").order("id").range(from,to));
    const brandId=new Map((allBrands??[]).map((r)=>[String(r.brand_code),r.id]));
    const existingModels=await readAllPages((from,to)=>client.from("phone_models").select("id,brand_id,model_code,name,slug,release_year,device_type,specifications_json,source_reference,verification_status,is_active,status,notes,brand:phone_brands!inner(brand_code)").order("id").range(from,to));
    const modelByKey=new Map((existingModels??[]).filter((r)=>r.model_code).map((r)=>{const relation=r.brand as unknown as {brand_code:string}|{brand_code:string}[];const brandCode=Array.isArray(relation)?relation[0]?.brand_code:relation?.brand_code;return [`${brandCode??""}:${r.model_code}`,r] as const;}));
    const newModels=[...models.values()].filter((m)=>!modelByKey.has(`${m.brand}:${m.code}`)).map((m)=>({brand_id:brandId.get(m.brand),model_code:m.code,name:m.name,slug:`${m.name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}-${m.code}`,release_year:Number(m.year)||null,device_type:"smartphone",specifications_json:{},source_reference:"REPHON_24X7_COMPLETE_MODEL_CATALOGUE_2019_2026.xlsx",verification_status:"needs_review",is_active:false,status:0,notes:"Model identity imported from price reference workbook; no variants or sellable stock are implied."}));
    note("phone_models",await upsert(client,"phone_models",newModels,"brand_id,model_code"));
    const allModels=await readAllPages((from,to)=>client.from("phone_models").select("id,brand_id,model_code,brand:phone_brands!inner(brand_code)").order("id").range(from,to));
    const modelId=new Map((allModels??[]).map((r)=>{const rel=r.brand as unknown as {brand_code:string}|{brand_code:string}[];const code=Array.isArray(rel)?rel[0]?.brand_code:rel?.brand_code;return [`${code}:${r.model_code}`,r.id] as const;}));
    const provenance=(sheet:string,index:number)=>({source_workbook:batch.workbook,source_sheet:sheet,source_row:index+2,verification_status:"pending_review",is_active:false,approved_by:null,approved_at:null});
    const marketRows=mapWorkbookRows(batch.workbook,"MODEL_NET_PRICE_TAGS",rows.MODEL_NET_PRICE_TAGS??[]) as Array<Record<string,unknown>>;
    const repairRows=mapWorkbookRows(batch.workbook,"REPAIR_PART_NET_TAGS",rows.REPAIR_PART_NET_TAGS??[]) as Array<Record<string,unknown>>;
    const deductionRows=mapWorkbookRows(batch.workbook,"COMPONENT_DEDUCTION_MATRIX",rows.COMPONENT_DEDUCTION_MATRIX??[]) as Array<Record<string,unknown>>;
    const market=marketRows.map((r,index)=>({model_id:modelId.get(`${r.brand_code}:${r.model_code}`),buy_price_inr:r.buy_price_inr,buy_price_basis:r.buy_price_basis,buy_source:r.buy_source,buy_confidence:r.buy_confidence,sell_baseline_inr:r.sell_baseline_inr,sell_price_basis:r.sell_price_basis,sell_source:r.sell_source,sell_condition_basis:r.sell_condition_basis,sell_confidence:r.sell_confidence,market_scope:r.market_scope,price_as_of:r.price_as_of||null,notes:r.notes,condition_baseline_note:r.condition_baseline_note,...provenance("MODEL_NET_PRICE_TAGS",index)}));
    const repairs=repairRows.map((r,index)=>({model_id:modelId.get(`${r.brand_code}:${r.model_code}`),component_code:r.component_code,component_name:r.component_name,price_inr:r.price_inr,price_basis:r.price_basis,source_name:r.source_name,price_scope:r.price_scope,confidence:r.confidence,notes:r.notes,...provenance("REPAIR_PART_NET_TAGS",index)}));
    const deductions=deductionRows.map((r,index)=>({model_id:modelId.get(`${r.brand_code}:${r.model_code}`),component_code:r.component_code,component_name:r.component_name,sell_baseline_inr:r.sell_baseline_inr,repair_reference_inr:r.repair_reference_inr,full_fault_deduction_pct:r.full_fault_deduction_pct,full_fault_deduction_inr:r.full_fault_deduction_inr,minor_fault_pct:r.minor_fault_pct,moderate_fault_pct:r.moderate_fault_pct,major_fault_pct:r.major_fault_pct,missing_component_pct:r.missing_component_pct,component_cap_pct:r.component_cap_pct,calculation_basis:r.calculation_basis,confidence_note:r.confidence_note,...provenance("COMPONENT_DEDUCTION_MATRIX",index)}));
    if([...market,...repairs,...deductions].some((r)=>!r.model_id))throw new Error("A source price row could not be linked to its brand/model. Resolve the model code mapping before committing.");
    note("model_market_price_tags",await upsert(client,"model_market_price_tags",market,"model_id,market_scope,price_as_of,source_workbook"));
    note("model_repair_price_tags",await upsert(client,"model_repair_price_tags",repairs,"model_id,component_code,price_scope,source_workbook"));
    note("model_component_deduction_tags",await upsert(client,"model_component_deduction_tags",deductions,"model_id,component_code,source_workbook"));
  }

  if (batch.workbook === "DEVICE_MASTER.xlsx") {
    const brands = rows.BRAND_REGISTRY ?? [];
    note("phone_brands", await upsert(client, "phone_brands", mapWorkbookRows(batch.workbook, "BRAND_REGISTRY", brands) as Record<string, unknown>[], "brand_code"));
    const { data: dbBrands, error: brandError } = await client.from("phone_brands").select("id,brand_code");
    if (brandError) throw new Error(brandError.message);
    const brandIds = new Map((dbBrands ?? []).map((row) => [String(row.brand_code), row.id]));
    const models = (rows.PHONE_MODELS ?? []).map((row) => {
      const brandId = brandIds.get(text(row.brand_code).padStart(2, "0"));
      if (!brandId) throw new Error(`PHONE_MODELS contains unknown brand_code ${row.brand_code}. Import or correct BRAND_REGISTRY first.`);
      return { brand_id: brandId, model_code: text(row.model_code).padStart(3, "0"), name: text(row.model_name), slug: text(row.model_slug), release_year: row.launch_year ?? null, device_type: text(row.device_type), specifications_json: row.specifications_json && typeof row.specifications_json === "object" ? row.specifications_json : {}, status: asBool(row.status) ? 1 : 0, is_active: asBool(row.status), source_reference: row.source_reference ?? null, verification_status: text(row.verification_status || "needs_review"), notes: row.notes ?? null };
    });
    // Permanent brand/model allocations are authoritative; slugs may be edited.
    note("phone_models", await upsert(client, "phone_models", models, "brand_id,model_code"));
    const { data: dbModels, error: modelError } = await client.from("phone_models").select("id,model_code,brand_id,brand:phone_brands!inner(brand_code)");
    if (modelError) throw new Error(modelError.message);
    const modelIds = new Map((dbModels ?? []).map((row) => {
      const joinedBrand = row.brand as unknown as { brand_code: string } | { brand_code: string }[];
      const brandCode = Array.isArray(joinedBrand) ? joinedBrand[0]?.brand_code : joinedBrand?.brand_code;
      return [`${String(brandCode)}:${String(row.model_code)}`, row.id] as const;
    }));
    const variants = (rows.DEVICE_VARIANTS ?? []).filter((row)=>row.storage_gb!=null&&row.storage_gb!==""&&text(row.variant_code)!=="00").map((row) => {
      const brandCode = text(row.brand_code).padStart(2,"0");
      const modelCode = text(row.model_code).padStart(3,"0");
      const variantCode = text(row.variant_code).padStart(2,"0");
      const modelId = modelIds.get(`${brandCode}:${modelCode}`);
      if (!modelId) throw new Error(`DEVICE_VARIANTS contains unknown brand/model ${brandCode}/${modelCode}.`);
      const code = `${brandCode}${modelCode}${variantCode}`;
      if (text(row.device_code) !== code) throw new Error(`DEVICE_VARIANTS has inconsistent device code for ${code}.`);
      return { model_id: modelId, variant_code: variantCode, device_code: code, ram_gb: row.ram_gb ?? null, storage_gb: Number(row.storage_gb), color: text(row.colour || "Not specified"), region: row.region ?? null, sku: row.sku || code, is_active: asBool(row.status), status: asBool(row.status) ? 1 : 0, repair_enabled: asBool(row.repair_enabled), buyback_enabled: asBool(row.buyback_enabled), resale_enabled: asBool(row.resale_enabled), original_price_inr: row.original_price_inr ?? row.original_reference_price_inr ?? null, original_price_basis: row.original_price_basis ?? null, launch_year: row.launch_year ?? null, notes: row.notes ?? null };
    });
    note("phone_variants", await upsert(client, "phone_variants", variants, "device_code"));
    note("model_price_setups", await upsert(client, "model_price_setups", (rows.DEVICE_VARIANTS ?? []).filter((row)=>row.device_code).map((row)=>({device_code:text(row.device_code),original_price_inr:row.original_price_inr??row.original_reference_price_inr??null,original_price_basis:row.original_price_basis??null,launch_year:row.launch_year??null,notes:row.notes??null,updated_at:new Date().toISOString()})), "device_code"));
  }
  if (batch.workbook === "SERVICE_PROVIDER_MASTER.xlsx") note("service_providers", await upsert(client, "service_providers", mapWorkbookRows(batch.workbook, "PROVIDERS", rows.PROVIDERS ?? []) as Record<string, unknown>[], "provider_code"));
  if (batch.workbook === "REPAIR_MASTER.xlsx") {
    note("repair_issues", await upsert(client, "repair_issues", mapWorkbookRows(batch.workbook, "REPAIR_ISSUES", rows.REPAIR_ISSUES ?? []) as Record<string, unknown>[], "issue_code"));
    note("repair_price_rules", await upsert(client, "repair_price_rules", (rows.REPAIR_PRICES ?? []).map((r) => ({ rule_key:stableRuleKey("repair",r,["device_code","issue_code","part_grade","city","provider_code","valid_from"]), device_code: text(r.device_code), issue_code: text(r.issue_code), part_type: r.part_type ?? null, part_grade: r.part_grade ?? null, part_cost_inr: r.part_cost_inr ?? null, labour_cost_inr: r.labour_cost_inr ?? null, logistics_cost_inr: r.logistics_cost_inr ?? null, margin_inr: r.margin_inr ?? null, customer_price_inr: r.customer_price_inr == null ? null : Number(r.customer_price_inr), warranty_days: r.warranty_days ?? null, city: r.city ?? null, provider_code: r.provider_code || null, valid_from: r.valid_from ?? null, valid_to: r.valid_to ?? null, verified: asBool(r.verified), status: asBool(r.status) ? 1 : 0, notes: r.notes ?? null })), "rule_key"));
    note("repair_components", await upsert(client, "repair_components", rows.REPAIR_COMPONENTS ?? [], "component_code"));
    note("repair_component_price_rules", await upsert(client, "repair_component_price_rules", (rows.REPAIR_COMPONENT_PRICES ?? []).map((r) => ({ rule_key:stableRuleKey("repair-component",r,["device_code","component_code","part_grade","city","provider_code","valid_from"]), device_code:text(r.device_code),component_code:text(r.component_code),part_number_or_description:r.part_number_or_description??null,part_grade:r.part_grade??null,part_cost_inr:r.part_cost_inr??null,labour_cost_inr:r.labour_cost_inr??null,logistics_cost_inr:r.logistics_cost_inr??null,margin_inr:r.margin_inr??null,customer_price_inr:r.customer_price_inr==null?null:Number(r.customer_price_inr),warranty_days:r.warranty_days??null,city:r.city??null,provider_code:r.provider_code||null,valid_from:r.valid_from??null,valid_to:r.valid_to??null,verified:asBool(r.verified),status:asBool(r.status)?1:0,notes:r.notes??null})), "rule_key"));
  }
  if (batch.workbook === "BUYBACK_MASTER.xlsx") {
    note("condition_grades", await upsert(client, "condition_grades", mapWorkbookRows(batch.workbook, "CONDITION_GRADES", rows.CONDITION_GRADES ?? []) as Record<string, unknown>[], "grade_code"));
    note("buyback_rules", await upsert(client, "buyback_rules", (rows.BUYBACK_RULES ?? []).map((r) => ({ rule_key:stableRuleKey("buyback",r,["device_code","condition_grade","screen_condition","body_condition","battery_health_min_pct","battery_health_max_pct","functional_status","city","valid_from"]), device_code: text(r.device_code), condition_grade: text(r.condition_grade), screen_condition: r.screen_condition ?? null, body_condition: r.body_condition ?? null, battery_health_min_pct: r.battery_health_min_pct ?? null, battery_health_max_pct: r.battery_health_max_pct ?? null, functional_status: r.functional_status ?? null, base_value_inr: r.base_value_inr ?? null, deduction_inr: r.deduction_inr ?? null, estimated_offer_inr: r.estimated_offer_inr == null ? null : Number(r.estimated_offer_inr), city: r.city ?? null, valid_from: r.valid_from ?? null, valid_to: r.valid_to ?? null, verified: asBool(r.verified), status: asBool(r.status) ? 1 : 0, original_price_inr:r.original_price_inr??null,original_price_basis:r.original_price_basis??null,launch_year:r.launch_year??null,age_depreciation_pct:r.age_depreciation_pct??null,age_depreciation_inr:r.age_depreciation_inr??null,condition_deduction_inr:r.condition_deduction_inr??null,refurbishment_cost_inr:r.refurbishment_cost_inr??null,risk_margin_inr:r.risk_margin_inr??null,business_margin_inr:r.business_margin_inr??null,estimated_resale_value_inr:r.estimated_resale_value_inr??null,age_years:r.age_years??null,notes: r.notes ?? null })), "rule_key"));
  }
  if (batch.workbook === "RESALE_MASTER.xlsx") {
    note("condition_grades", await upsert(client, "condition_grades", mapWorkbookRows(batch.workbook, "CONDITION_GRADES", rows.CONDITION_GRADES ?? []) as Record<string, unknown>[], "grade_code"));
    note("resale_inventory", await upsert(client, "resale_inventory", mapWorkbookRows(batch.workbook, "RESALE_INVENTORY", rows.RESALE_INVENTORY ?? []) as Record<string, unknown>[], "inventory_sku"));
    note("model_price_setups", await upsert(client, "model_price_setups", (rows.MODEL_PRICE_SETUP ?? []).map((r)=>({device_code:text(r.device_code),original_price_inr:r.original_price_inr??null,original_price_basis:r.original_price_basis??null,launch_year:r.launch_year??null,notes:r.notes??null,updated_at:new Date().toISOString()})), "device_code"));
  }
  if(batch.workbook === "PRICING_POLICY_MASTER.xlsx") {
    const policyRows=[...(rows.AGE_DEPRECIATION_POLICY??[]).map((r)=>({policy_code:text(r.policy_code),policy_type:"age_depreciation",brand_code:r.brand_code?text(r.brand_code).padStart(2,"0"):null,device_segment:r.device_segment??null,effective_from:r.effective_from??null,effective_to:r.effective_to??null,policy_values:{age_from_years:r.age_from_years,age_to_years:r.age_to_years,depreciation_pct:r.depreciation_pct},approved:false,status:0,notes:r.notes??null})),...(rows.CONDITION_DEDUCTION_POLICY??[]).map((r)=>({policy_code:text(r.deduction_code),policy_type:"condition_deduction",brand_code:r.brand_code?text(r.brand_code).padStart(2,"0"):null,device_segment:r.device_segment??null,policy_values:{condition_area:r.condition_area,severity:r.severity,deduction_type:r.deduction_type,deduction_value:r.deduction_value},approved:false,status:0,notes:r.notes??null})),...(rows.BUYBACK_MARGIN_POLICY??[]).map((r)=>({policy_code:text(r.policy_code),policy_type:"buyback_margin",city:r.city??null,effective_from:r.effective_from??null,effective_to:r.effective_to??null,policy_values:{risk_margin_inr:r.risk_margin_inr,business_margin_inr:r.business_margin_inr},approved:false,status:0,notes:r.notes??null}))];
    note("pricing_policies",await upsert(client,"pricing_policies",policyRows,"policy_code"));
  }
  if (batch.workbook === "ACCESSORIES_MASTER.xlsx") note("accessories", await upsert(client, "accessories", mapWorkbookRows(batch.workbook, "ACCESSORIES", rows.ACCESSORIES ?? []) as Record<string, unknown>[], "accessory_code,compatibility_key"));

  const importedRows = Object.values(count).reduce((sum, value) => sum + value, 0);
  const { error: batchError } = await client.from("import_batches").update({ status: "committed", imported_rows: importedRows, committed_at: new Date().toISOString() }).eq("id", batch.id).eq("status", "preview");
  if (batchError) throw new Error(`Data was written but the batch status could not be updated: ${batchError.message}`);
  await client.from("activity_logs").insert({ actor_id: actorId, entity_type: "import_batch", entity_id: batch.id, action: "master_workbook_imported", details: { workbook: batch.workbook, counts: count } });
  return { importedRows, counts: count };
}
