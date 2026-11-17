import ExcelJS from "exceljs";
import JSZip from "jszip";

export const WORKBOOKS = ["DEVICE_MASTER.xlsx", "REPAIR_MASTER.xlsx", "BUYBACK_MASTER.xlsx", "RESALE_MASTER.xlsx", "ACCESSORIES_MASTER.xlsx", "SERVICE_PROVIDER_MASTER.xlsx", "PRICING_POLICY_MASTER.xlsx", "REPHON_24X7_COMPLETE_MODEL_CATALOGUE_2019_2026.xlsx"] as const;
export type ImportWorkbook = typeof WORKBOOKS[number];
type SheetSpec = { required: string[]; key: string[]; optional?: boolean };

const specs: Record<ImportWorkbook, Record<string, SheetSpec>> = {
  "DEVICE_MASTER.xlsx": {
    BRAND_REGISTRY: { required: ["brand_code","brand_name","brand_slug","product_category","status"], key: ["brand_code"] },
    PHONE_MODELS: { required: ["brand_code","model_code","model_name","model_slug","device_type","status"], key: ["brand_code","model_code"] },
    DEVICE_VARIANTS: { required: ["brand_code","model_code","variant_code","storage_gb","status"], key: ["brand_code","model_code","variant_code"] },
  },
  "REPAIR_MASTER.xlsx": {
    REPAIR_ISSUES: { required: ["issue_code","issue_name","status"], key: ["issue_code"] },
    REPAIR_PRICES: { required: ["device_code","issue_code","verified","status"], key: ["device_code","issue_code","part_grade","city","provider_code","valid_from"] },
    REPAIR_COMPONENTS: { required: ["component_code","component_name","status"], key: ["component_code"], optional: true },
    REPAIR_COMPONENT_PRICES: { required: ["device_code","component_code","verified","status"], key: ["device_code","component_code","part_grade","city","provider_code","valid_from"], optional: true },
  },
  "BUYBACK_MASTER.xlsx": {
    CONDITION_GRADES: { required: ["condition_grade","grade_name","status"], key: ["condition_grade"] },
    BUYBACK_RULES: { required: ["device_code","condition_grade","verified","status"], key: ["device_code","condition_grade","screen_condition","body_condition","battery_health_min_pct","city","valid_from"] },
  },
  "RESALE_MASTER.xlsx": {
    RESALE_INVENTORY: { required: ["inventory_sku","device_code","condition_grade","stock_quantity","listing_status"], key: ["inventory_sku"] },
    MODEL_PRICE_SETUP: { required: ["device_code"], key: ["device_code"], optional: true },
    CONDITION_GRADES: { required: ["condition_grade","grade_name","status"], key: ["condition_grade"] },
  },
  "ACCESSORIES_MASTER.xlsx": { ACCESSORIES: { required: ["accessory_code","accessory_name","selling_price_inr","stock_quantity","status"], key: ["accessory_code","compatible_device_code"] } },
  "SERVICE_PROVIDER_MASTER.xlsx": { PROVIDERS: { required: ["provider_code","business_name","status"], key: ["provider_code"] } },
  "PRICING_POLICY_MASTER.xlsx": {
    AGE_DEPRECIATION_POLICY: { required: ["policy_code","status"], key: ["policy_code","brand_code","device_segment","age_from_years","effective_from"] },
    CONDITION_DEDUCTION_POLICY: { required: ["deduction_code","status"], key: ["deduction_code"] },
    BUYBACK_MARGIN_POLICY: { required: ["policy_code","status"], key: ["policy_code","city","effective_from"] },
  },
  "REPHON_24X7_COMPLETE_MODEL_CATALOGUE_2019_2026.xlsx": {
    MODEL_NET_PRICE_TAGS: { required: ["brand_code","brand_name","model_code","model_name","BUY_NET_MARKET_PRICE_INR","BUY_CONFIDENCE","SELL_NET_MARKET_PRICE_INR","SELL_CONFIDENCE","price_as_of"], key: ["brand_code","model_code"] },
    REPAIR_PART_NET_TAGS: { required: ["brand_code","brand_name","model_code","model_name","component_code","component_name","REPAIR_NET_MARKET_PRICE_INR","CONFIDENCE"], key: ["brand_code","model_code","component_code"] },
    COMPONENT_DEDUCTION_MATRIX: { required: ["brand_code","brand_name","model_code","model_name","component_code","component_name","grade_B_sell_baseline_INR","repair_reference_INR","minor_fault_pct","moderate_fault_pct","major_fault_pct","missing_component_pct","component_cap_pct"], key: ["brand_code","model_code","component_code"] },
  },
};
const knownFields: Record<string, string[]> = {
  BRAND_REGISTRY: ["brand_code","brand_name","brand_slug","product_category","status","notes"],
  PHONE_MODELS: ["brand_code","model_code","brand_name","model_name","model_slug","launch_year","device_type","specifications_json","status","source_reference","verification_status","notes"],
  DEVICE_VARIANTS: ["device_code","brand_code","model_code","variant_code","brand_name","model_name","ram_gb","storage_gb","colour","region","sku","status","repair_enabled","buyback_enabled","resale_enabled","original_price_inr","original_reference_price_inr","original_price_basis","launch_year","notes"],
  REPAIR_ISSUES: ["issue_code","issue_name","issue_category","description","status"],
  REPAIR_PRICES: ["device_code","brand_code","issue_code","part_type","part_grade","part_cost_inr","labour_cost_inr","logistics_cost_inr","margin_inr","customer_price_inr","warranty_days","city","provider_code","valid_from","valid_to","verified","status","notes"],
  REPAIR_COMPONENTS: ["component_code","component_name","related_issue_code","pricing_basis","notes","status"],
  REPAIR_COMPONENT_PRICES: ["device_code","brand_code","component_code","part_number_or_description","part_grade","part_cost_inr","labour_cost_inr","logistics_cost_inr","margin_inr","customer_price_inr","warranty_days","city","provider_code","valid_from","valid_to","verified","status","notes"],
  CONDITION_GRADES: ["condition_grade","grade_name","criteria","status"],
  BUYBACK_RULES: ["device_code","brand_code","condition_grade","screen_condition","body_condition","battery_health_min_pct","battery_health_max_pct","functional_status","base_value_inr","deduction_inr","estimated_offer_inr","city","valid_from","valid_to","verified","status","notes","original_price_inr","launch_year","age_depreciation_pct","age_depreciation_inr","condition_deduction_inr","refurbishment_cost_inr","risk_margin_inr","business_margin_inr","estimated_resale_value_inr","age_years","original_price_basis"],
  RESALE_INVENTORY: ["inventory_sku","device_code","brand_code","condition_grade","battery_health_pct","stock_quantity","purchase_cost_inr","refurbishment_cost_inr","selling_price_inr","warranty_days","city","listing_status","date_added","notes"],
  MODEL_PRICE_SETUP: ["device_code","brand_name","model_name","variant_code","ram_gb","storage_gb","colour","condition_grade","battery_health_pct","stock_quantity","purchase_cost_inr","refurbishment_cost_inr","selling_price_inr","warranty_days","city","listing_status","notes","brand_code","original_price_inr","launch_year","age_depreciation_pct","age_depreciation_inr","condition_deduction_inr","calculated_selling_price_inr","approved_price_override_inr","customer_selling_price_inr","age_years","original_price_basis"],
  ACCESSORIES: ["accessory_code","accessory_category","brand","accessory_name","compatible_device_code","compatible_model","cost_inr","selling_price_inr","stock_quantity","warranty_days","status","notes"],
  PROVIDERS: ["provider_code","business_name","provider_type","contact_person","phone_e164","email","city","area","full_address","services_offered","working_hours","status","notes"],
  AGE_DEPRECIATION_POLICY: ["policy_code","brand_code","device_segment","age_from_years","age_to_years","depreciation_pct","effective_from","effective_to","approved","status","notes"],
  CONDITION_DEDUCTION_POLICY: ["deduction_code","condition_area","severity","deduction_type","deduction_value","brand_code","device_segment","approved","status","notes"],
  BUYBACK_MARGIN_POLICY: ["policy_code","city","risk_margin_inr","business_margin_inr","effective_from","effective_to","approved","status","notes"],
  MODEL_NET_PRICE_TAGS: ["brand_code","brand_name","model_code","model_name","launch_year","BUY_NET_MARKET_PRICE_INR","BUY_PRICE_BASIS","BUY_SOURCE","BUY_CONFIDENCE","SELL_NET_MARKET_PRICE_INR","SELL_PRICE_BASIS","SELL_SOURCE","SELL_CONDITION_BASIS","SELL_CONFIDENCE","market_scope","price_as_of","notes","CONDITION_BASELINE_NOTE"],
  REPAIR_PART_NET_TAGS: ["brand_code","brand_name","model_code","model_name","component_code","component_name","REPAIR_NET_MARKET_PRICE_INR","PRICE_BASIS","SOURCE","PRICE_SCOPE","CONFIDENCE","notes"],
  COMPONENT_DEDUCTION_MATRIX: ["brand_code","brand_name","model_code","model_name","component_code","component_name","grade_B_sell_baseline_INR","repair_reference_INR","full_fault_deduction_pct","full_fault_deduction_INR","minor_fault_pct","moderate_fault_pct","major_fault_pct","missing_component_pct","component_cap_pct","calculation_basis","confidence_note"],
};

export type ImportIssue = { sheet: string; row: number; severity: "error" | "warning" | "duplicate"; field?: string; message: string; data?: Record<string, unknown> };
export type ParsedWorkbook = { workbook: ImportWorkbook; sheets: Array<{ name: string; headers: string[]; recognized: string[]; unknown: string[]; missing: string[]; rowCount: number; informationOnly?: boolean; dataNotStaged?: boolean }>; rows: Record<string, Array<Record<string, unknown>>>; documentation: Record<string, unknown[][]>; issues: ImportIssue[]; totalRows: number };

function cellValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (value && typeof value === "object" && "result" in value) return cellValue((value as {result:unknown}).result);
  if (value && typeof value === "object" && ("formula" in value || "sharedFormula" in value)) return null;
  if (value && typeof value === "object" && "text" in value) return cellValue((value as {text:unknown}).text);
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return value ?? null;
}
function filled(row: Record<string, unknown>) { return Object.values(row).some((value) => value !== null && value !== ""); }
function canonical(value: unknown) { return String(value ?? "").trim(); }
function unknownPlaceholder(row: Record<string, unknown>) { return canonical(row.variant_code) === "00" && (row.storage_gb == null || row.storage_gb === ""); }
function codeForVariant(row: Record<string, unknown>) { return `${canonical(row.brand_code).padStart(2,"0")}${canonical(row.model_code).padStart(3,"0")}${canonical(row.variant_code).padStart(2,"0")}`; }

function rowValues(row:ExcelJS.Row){const values:unknown[]=[];row.eachCell({includeEmpty:true},(cell,col)=>{values[col-1]=cellValue(cell.value);});return values;}

// ExcelJS expects the standard OOXML comments paths. The supplied templates use
// absolute, nested comment/VML targets, which Excel accepts but ExcelJS 4.x does not.
async function normalizeWorkbookCommentPaths(buffer:Buffer):Promise<Buffer>{
  const archive=await JSZip.loadAsync(buffer as never);let changed=false;
  for(const [path,file] of Object.entries(archive.files)){
    if(file.dir)continue;
    const commentPath=path.match(/^xl\/comments\/comment(\d+)\.xml$/);
    const vmlPath=path.match(/^xl\/drawings\/commentsDrawing(\d+)\.vml$/);
    if(commentPath){archive.file(`xl/comments${commentPath[1]}.xml`,await file.async("nodebuffer"));changed=true;}
    if(vmlPath){archive.file(`xl/drawings/vmlDrawing${vmlPath[1]}.vml`,await file.async("nodebuffer"));changed=true;}
    if(path.startsWith("xl/worksheets/_rels/")&&path.endsWith(".rels")){
      const xml=await file.async("string");
      const normalized=xml.replace(/Target="\/xl\/comments\/comment(\d+)\.xml"/g,'Target="../comments$1.xml"').replace(/Target="\/xl\/drawings\/commentsDrawing(\d+)\.vml"/g,'Target="../drawings/vmlDrawing$1.vml"').replace(/Target="\/xl\/tables\/(table\d+\.xml)"/g,'Target="../tables/$1"');
      if(normalized!==xml){archive.file(path,normalized);changed=true;}
    }
  }
  return changed?await archive.generateAsync({type:"nodebuffer"}) as Buffer:buffer;
}

export async function parseWorkbook(buffer: Buffer, workbook: ImportWorkbook): Promise<ParsedWorkbook> {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await normalizeWorkbookCommentPaths(buffer) as never);
  const workbookSpecs = specs[workbook];
  const sheets: ParsedWorkbook["sheets"] = [];
  const rows: ParsedWorkbook["rows"] = {};
  const documentation: ParsedWorkbook["documentation"] = {};
  const issues: ImportIssue[] = [];
  let totalRows = 0;
  for (const [sheetName, spec] of Object.entries(workbookSpecs)) {
    const sheet = book.getWorksheet(sheetName);
    if (!sheet) {
      if (!spec.optional) issues.push({ sheet: sheetName, row: 1, severity: "error", message: "Required worksheet is missing." });
      sheets.push({ name: sheetName, headers: [], recognized: [], unknown: [], missing: spec.optional ? [] : spec.required, rowCount: 0 });
      rows[sheetName] = [];
      continue;
    }
    const matrix:unknown[][]=[];
    for(let rowIndex=1;rowIndex<=sheet.rowCount;rowIndex++){const values=rowValues(sheet.getRow(rowIndex));matrix.push(values);}
    const headers = (matrix[0] ?? []).map((value) => canonical(value));
    const missing = spec.required.filter((key) => !headers.includes(key));
    const recognized = headers.filter((header) => knownFields[sheetName]?.includes(header));
    const unknown = headers.filter((header) => header && !knownFields[sheetName]?.includes(header));
    if (missing.length) issues.push({ sheet: sheetName, row: 1, severity: "error", message: `Missing required columns: ${missing.join(", ")}.` });
    if (unknown.length) issues.push({ sheet: sheetName, row: 1, severity: "error", message: `Unmapped columns must be mapped before import: ${unknown.join(", ")}.` });
    if (workbook === "REPHON_24X7_COMPLETE_MODEL_CATALOGUE_2019_2026.xlsx" && sheetName === "MODEL_NET_PRICE_TAGS") {
      issues.push({ sheet: sheetName, row: 1, severity: "warning", message: "This source contains estimates and low-confidence model-level references. Imported rows remain pending review and cannot produce customer prices until staff approval." });
    }
    const dataRows: Array<Record<string, unknown>> = [];
    for (let index = 1; index < matrix.length; index++) {
      const source = matrix[index] ?? [];
      const row: Record<string, unknown> = {};
      headers.forEach((header, col) => { if (header) row[header] = cellValue(source[col]); });
      for (const [field, value] of Object.entries(row)) if (typeof value === "string" && value.startsWith("#")) issues.push({ sheet: sheetName, row: index + 1, severity: "error", field, message: `Spreadsheet formula error in ${field}.`, data: row });
      // DEVICE_VARIANTS A-column contains a template formula; derive the identifier from its code components.
      if (sheetName === "DEVICE_VARIANTS" && !canonical(row.device_code) && row.brand_code && row.model_code && row.variant_code) row.device_code = codeForVariant(row);
      if (!filled(row)) continue;
      dataRows.push(row);
      const unknownVariantPlaceholder = sheetName === "DEVICE_VARIANTS" && unknownPlaceholder(row);
      for (const field of spec.required) if ((row[field] === null || row[field] === "") && !(unknownVariantPlaceholder && field === "storage_gb")) issues.push({ sheet: sheetName, row: index + 1, severity: "error", field, message: `Required value “${field}” is empty.`, data: row });
      if (unknownVariantPlaceholder) issues.push({ sheet: sheetName, row: index + 1, severity: "warning", field: "variant_code", message: "Unknown configuration placeholder retained for reference; it will not be imported as a sellable variant.", data: row });
    }
    const seen = new Set<string>();
    dataRows.forEach((row, index) => {
      const identity = spec.key.map((field) => canonical(row[field])).join("|").toLowerCase();
      if (identity.replaceAll("|", "")) {
        if (seen.has(identity)) issues.push({ sheet: sheetName, row: index + 2, severity: "duplicate", message: `Duplicate key: ${identity}.`, data: row });
        else seen.add(identity);
      }
    });
    if (sheetName === "DEVICE_VARIANTS") dataRows.forEach((row, index) => {
      const code = canonical(row.device_code);
      if (!/^\d{7}$/.test(code)) issues.push({ sheet: sheetName, row: index + 2, severity: "error", field: "device_code", message: "Device code must contain exactly seven digits (BBMMM VV, without spaces).", data: row });
      const expectedCode = codeForVariant(row);
      if (code && /^\d{2}$/.test(canonical(row.brand_code).padStart(2,"0")) && /^\d{3}$/.test(canonical(row.model_code).padStart(3,"0")) && /^\d{2}$/.test(canonical(row.variant_code).padStart(2,"0")) && code !== expectedCode) issues.push({ sheet: sheetName, row: index + 2, severity: "error", field: "device_code", message: `Device code must match brand/model/variant as ${expectedCode}.`, data: row });
      if (canonical(row.variant_code) === "00" && !unknownPlaceholder(row)) issues.push({ sheet: sheetName, row: index + 2, severity: "warning", field: "variant_code", message: "Variant 00 is reserved for unknown variants and should not describe a known configuration.", data: row });
      for (const field of ["ram_gb","storage_gb"]) if (row[field] != null && row[field] !== "" && (!Number.isFinite(Number(row[field])) || Number(row[field]) <= 0)) issues.push({ sheet: sheetName, row: index + 2, severity: "error", field, message: `${field} must be a positive number.`, data: row });
    });
    if (sheetName === "PHONE_MODELS") dataRows.forEach((row,index)=>{if(!["smartphone","feature_phone","tablet","laptop","other"].includes(canonical(row.device_type)))issues.push({sheet:sheetName,row:index+2,severity:"error",field:"device_type",message:"device_type must be smartphone, feature_phone, tablet, laptop, or other.",data:row});});
    if (["REPAIR_PRICES","REPAIR_COMPONENT_PRICES","BUYBACK_RULES"].includes(sheetName)) dataRows.forEach((row,index) => {
      for (const field of ["verified","status"]) if (![0,1,"0","1",true,false].includes(row[field] as never)) issues.push({ sheet: sheetName, row: index + 2, severity: "error", field, message: `${field} must be 0 or 1.`, data: row });
      for (const field of ["customer_price_inr","estimated_offer_inr","base_value_inr","deduction_inr"]) if (row[field] != null && row[field] !== "" && (!Number.isFinite(Number(row[field])) || Number(row[field]) < 0)) issues.push({ sheet: sheetName, row: index + 2, severity: "error", field, message: `${field} must be zero or a positive number.`, data: row });
      if ((canonical(row.status) === "1" || row.status === true) && (canonical(row.verified) === "1" || row.verified === true) && (row.customer_price_inr == null && row.estimated_offer_inr == null)) issues.push({ sheet: sheetName, row: index + 2, severity: "error", field: "customer_price_inr", message: "An active verified rule needs a reviewed customer price; incomplete rows must stay inactive and unverified.", data: row });
      if (row.valid_from && row.valid_to && String(row.valid_to) < String(row.valid_from)) issues.push({ sheet: sheetName, row: index + 2, severity: "error", field: "valid_to", message: "valid_to cannot be earlier than valid_from.", data: row });
    });
    if (sheetName === "RESALE_INVENTORY") dataRows.forEach((row,index) => {
      if (!Number.isInteger(Number(row.stock_quantity)) || Number(row.stock_quantity) < 0) issues.push({ sheet: sheetName, row: index + 2, severity: "error", field: "stock_quantity", message: "Stock quantity must be a non-negative integer.", data: row });
      if (!(["draft","available","reserved","sold","withdrawn"].includes(canonical(row.listing_status)))) issues.push({ sheet: sheetName, row: index + 2, severity: "error", field: "listing_status", message: "listing_status must be draft, available, reserved, sold, or withdrawn.", data: row });
      for (const field of ["purchase_cost_inr","refurbishment_cost_inr","selling_price_inr"]) if (row[field] != null && row[field] !== "" && (!Number.isFinite(Number(row[field])) || Number(row[field]) < 0)) issues.push({ sheet: sheetName, row: index + 2, severity: "error", field, message: `${field} must be zero or a positive number.`, data: row });
    });
    if (sheetName === "ACCESSORIES") dataRows.forEach((row,index)=>{if(!canonical(row.compatible_device_code)&&!canonical(row.compatible_model))issues.push({sheet:sheetName,row:index+2,severity:"error",field:"compatible_device_code",message:"Each accessory row needs a compatible device code or an explicitly verified compatible model.",data:row});});
    totalRows += dataRows.length;
    rows[sheetName] = dataRows;
    sheets.push({ name: sheetName, headers, recognized, unknown, missing, rowCount: dataRows.length });
  }
  for (const sheetName of book.worksheets.map((sheet)=>sheet.name).filter((name) => !Object.hasOwn(workbookSpecs, name))) {
    const sheet=book.getWorksheet(sheetName)!;const data:unknown[][]=[];
    if (workbook === "REPHON_24X7_COMPLETE_MODEL_CATALOGUE_2019_2026.xlsx") {
      const headers = rowValues(sheet.getRow(1)).map(canonical);
      sheets.push({ name: sheetName, headers, recognized: [], unknown: [], missing: [], rowCount: Math.max(0, sheet.rowCount - 1), informationOnly: true, dataNotStaged: true });
      continue;
    }
    for(let rowIndex=1;rowIndex<=sheet.rowCount;rowIndex++)data.push(rowValues(sheet.getRow(rowIndex)));
    documentation[sheetName] = data;
    sheets.push({ name: sheetName, headers: (data[0] ?? []).map(canonical), recognized: [], unknown: [], missing: [], rowCount: Math.max(0, data.length - 1), informationOnly: true });
  }
  return { workbook, sheets, rows, documentation, issues, totalRows };
}

export function mapWorkbookRows(workbook: ImportWorkbook, sheet: string, sourceRows: Array<Record<string, unknown>>) {
  const status = (value: unknown) => value === true || value === "1" || Number(value) === 1;
  if (workbook === "REPHON_24X7_COMPLETE_MODEL_CATALOGUE_2019_2026.xlsx" && sheet === "MODEL_NET_PRICE_TAGS") return sourceRows.map((r) => ({
    brand_code: canonical(r.brand_code).padStart(2, "0"), brand_name: canonical(r.brand_name), model_code: canonical(r.model_code).padStart(3, "0"), model_name: canonical(r.model_name),
    launch_year: r.launch_year ?? null, buy_price_inr: r.BUY_NET_MARKET_PRICE_INR ?? null, buy_price_basis: r.BUY_PRICE_BASIS ?? null, buy_source: r.BUY_SOURCE ?? null, buy_confidence: r.BUY_CONFIDENCE ?? null,
    sell_baseline_inr: r.SELL_NET_MARKET_PRICE_INR ?? null, sell_price_basis: r.SELL_PRICE_BASIS ?? null, sell_source: r.SELL_SOURCE ?? null, sell_condition_basis: r.SELL_CONDITION_BASIS ?? null, sell_confidence: r.SELL_CONFIDENCE ?? null,
    market_scope: r.market_scope ?? null, price_as_of: r.price_as_of ?? null, notes: r.notes ?? null, condition_baseline_note: r.CONDITION_BASELINE_NOTE ?? null,
  }));
  if (workbook === "REPHON_24X7_COMPLETE_MODEL_CATALOGUE_2019_2026.xlsx" && sheet === "REPAIR_PART_NET_TAGS") return sourceRows.map((r) => ({
    brand_code: canonical(r.brand_code).padStart(2, "0"), brand_name: canonical(r.brand_name), model_code: canonical(r.model_code).padStart(3, "0"), model_name: canonical(r.model_name),
    component_code: canonical(r.component_code), component_name: canonical(r.component_name), price_inr: r.REPAIR_NET_MARKET_PRICE_INR ?? null, price_basis: r.PRICE_BASIS ?? null,
    source_name: r.SOURCE ?? null, price_scope: r.PRICE_SCOPE ?? null, confidence: r.CONFIDENCE ?? null, notes: r.notes ?? null,
  }));
  if (workbook === "REPHON_24X7_COMPLETE_MODEL_CATALOGUE_2019_2026.xlsx" && sheet === "COMPONENT_DEDUCTION_MATRIX") return sourceRows.map((r) => ({
    brand_code: canonical(r.brand_code).padStart(2, "0"), brand_name: canonical(r.brand_name), model_code: canonical(r.model_code).padStart(3, "0"), model_name: canonical(r.model_name),
    component_code: canonical(r.component_code), component_name: canonical(r.component_name), sell_baseline_inr: r.grade_B_sell_baseline_INR ?? null, repair_reference_inr: r.repair_reference_INR ?? null,
    full_fault_deduction_pct: r.full_fault_deduction_pct ?? null, full_fault_deduction_inr: r.full_fault_deduction_INR ?? null, minor_fault_pct: r.minor_fault_pct ?? null,
    moderate_fault_pct: r.moderate_fault_pct ?? null, major_fault_pct: r.major_fault_pct ?? null, missing_component_pct: r.missing_component_pct ?? null, component_cap_pct: r.component_cap_pct ?? null,
    calculation_basis: r.calculation_basis ?? null, confidence_note: r.confidence_note ?? null,
  }));
  if (workbook === "DEVICE_MASTER.xlsx" && sheet === "BRAND_REGISTRY") return sourceRows.map((r) => ({ brand_code: canonical(r.brand_code).padStart(2,"0"), name: canonical(r.brand_name), slug: canonical(r.brand_slug), product_category: canonical(r.product_category), status: status(r.status) ? 1 : 0, is_active: status(r.status), notes: r.notes ?? null }));
  if (workbook === "DEVICE_MASTER.xlsx" && sheet === "PHONE_MODELS") return sourceRows;
  if (workbook === "DEVICE_MASTER.xlsx" && sheet === "DEVICE_VARIANTS") return sourceRows;
  if (workbook === "REPAIR_MASTER.xlsx" && sheet === "REPAIR_ISSUES") return sourceRows.map((r) => ({ issue_code: canonical(r.issue_code), issue_name: canonical(r.issue_name), issue_category: r.issue_category ?? null, description: r.description ?? null, status: status(r.status) ? 1 : 0 }));
  if (workbook === "REPAIR_MASTER.xlsx" && sheet === "REPAIR_PRICES") return sourceRows;
  if (workbook === "REPAIR_MASTER.xlsx" && sheet === "REPAIR_COMPONENTS") return sourceRows;
  if (workbook === "REPAIR_MASTER.xlsx" && sheet === "REPAIR_COMPONENT_PRICES") return sourceRows;
  if ((workbook === "BUYBACK_MASTER.xlsx" || workbook === "RESALE_MASTER.xlsx") && sheet === "CONDITION_GRADES") return sourceRows.map((r) => ({ grade_code: canonical(r.condition_grade), grade_name: canonical(r.grade_name), criteria: r.criteria ?? null, status: status(r.status) ? 1 : 0 }));
  if (workbook === "BUYBACK_MASTER.xlsx" && sheet === "BUYBACK_RULES") return sourceRows;
  if (workbook === "RESALE_MASTER.xlsx" && sheet === "RESALE_INVENTORY") return sourceRows.map((r) => ({ inventory_sku: canonical(r.inventory_sku), device_code: canonical(r.device_code), condition_grade: canonical(r.condition_grade), battery_health_pct: r.battery_health_pct ?? null, stock_quantity: Number(r.stock_quantity), purchase_cost_inr: r.purchase_cost_inr ?? null, refurbishment_cost_inr: r.refurbishment_cost_inr ?? null, selling_price_inr: r.selling_price_inr == null || r.selling_price_inr === "" ? null : Number(r.selling_price_inr), warranty_days: r.warranty_days ?? null, city: r.city ?? null, listing_status: canonical(r.listing_status), date_added: r.date_added ?? null, notes: r.notes ?? null }));
  if (workbook === "RESALE_MASTER.xlsx" && sheet === "MODEL_PRICE_SETUP") return sourceRows;
  if (workbook === "ACCESSORIES_MASTER.xlsx" && sheet === "ACCESSORIES") return sourceRows.map((r) => ({ accessory_code: canonical(r.accessory_code), compatibility_key: canonical(r.compatible_device_code) || `model:${canonical(r.compatible_model).toLowerCase()}`, accessory_category: r.accessory_category ?? null, brand: r.brand ?? null, accessory_name: canonical(r.accessory_name), compatible_device_code: r.compatible_device_code ?? null, compatible_model: r.compatible_model ?? null, cost_inr: r.cost_inr ?? null, selling_price_inr: r.selling_price_inr ?? null, stock_quantity: Number(r.stock_quantity), warranty_days: r.warranty_days ?? null, status: status(r.status) ? 1 : 0, notes: r.notes ?? null }));
  if (workbook === "SERVICE_PROVIDER_MASTER.xlsx" && sheet === "PROVIDERS") return sourceRows.map((r) => ({ provider_code: canonical(r.provider_code), business_name: canonical(r.business_name), provider_type: r.provider_type ?? null, contact_person: r.contact_person ?? null, phone_e164: r.phone_e164 ?? null, email: r.email ?? null, city: r.city ?? null, area: r.area ?? null, full_address: r.full_address ?? null, services_offered: r.services_offered ?? null, working_hours: r.working_hours ?? null, status: status(r.status) ? 1 : 0, notes: r.notes ?? null }));
  if (workbook === "PRICING_POLICY_MASTER.xlsx") return sourceRows;
  return sourceRows;
}
