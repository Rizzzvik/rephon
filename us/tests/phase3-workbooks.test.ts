import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { parseWorkbook } from "../src/lib/imports/workbooks.ts";

async function workbook(sheets: Record<string, unknown[][]>) {
  const book = new ExcelJS.Workbook();
  for (const [name, rows] of Object.entries(sheets)) { const sheet = book.addWorksheet(name); rows.forEach((row) => sheet.addRow(row)); }
  return Buffer.from(await book.xlsx.writeBuffer());
}

test("V2 unknown device placeholders are warnings, not sellable variant rows", async () => {
  const parsed = await parseWorkbook(await workbook({
    BRAND_REGISTRY: [["brand_code","brand_name","brand_slug","product_category","status"], ["15","Samsung","samsung","Smartphones",1]],
    PHONE_MODELS: [["brand_code","model_code","model_name","model_slug","device_type","status"], ["15","006","Galaxy A37","galaxy-a37","smartphone",1]],
    DEVICE_VARIANTS: [["device_code","brand_code","model_code","variant_code","storage_gb","colour","status"], ["1500600","15","006","00",null,"Unspecified",1]],
  }), "DEVICE_MASTER.xlsx");
  assert.equal(parsed.issues.filter((issue) => issue.severity === "error").length, 0);
  assert.ok(parsed.issues.some((issue) => issue.severity === "warning" && issue.message.includes("will not be imported")));
});

test("inactive template prices and blank resale setup rows do not fabricate prices or inventory", async () => {
  const repair = await parseWorkbook(await workbook({
    REPAIR_ISSUES: [["issue_code","issue_name","status"], ["DSP001","Display replacement",1]],
    REPAIR_PRICES: [["device_code","issue_code","customer_price_inr","verified","status"], ["1400101","DSP001",null,0,0]],
    REPAIR_COMPONENTS: [["component_code","component_name","status"], ["DISPLAY","Display",1]],
    REPAIR_COMPONENT_PRICES: [["device_code","component_code","customer_price_inr","verified","status"], ["1400101","DISPLAY",null,0,0]],
  }), "REPAIR_MASTER.xlsx");
  assert.equal(repair.issues.filter((issue) => issue.severity === "error").length, 0);

  const resale = await parseWorkbook(await workbook({
    RESALE_INVENTORY: [["inventory_sku","device_code","condition_grade","stock_quantity","selling_price_inr","listing_status"]],
    CONDITION_GRADES: [["condition_grade","grade_name","status"], ["A","Like new",1]],
    MODEL_PRICE_SETUP: [["device_code","condition_grade","stock_quantity","listing_status","original_price_inr"], ["1400101",null,null,0,299900]],
  }), "RESALE_MASTER.xlsx");
  assert.equal(resale.rows.RESALE_INVENTORY.length, 0);
  assert.equal(resale.rows.MODEL_PRICE_SETUP.length, 1);
  assert.equal(resale.rows.MODEL_PRICE_SETUP[0].stock_quantity, null);
  assert.equal(resale.issues.filter((issue) => issue.severity === "error").length, 0);
});
