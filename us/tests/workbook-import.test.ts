import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { parseWorkbook } from "../src/lib/imports/workbooks.ts";

async function makeBook(sheets: Record<string, unknown[][]>) {
  const book=new ExcelJS.Workbook();
  for(const [name,rows] of Object.entries(sheets)) {
    const sheet=book.addWorksheet(name);
    rows.forEach((row)=>sheet.addRow(row));
  }
  return Buffer.from(await book.xlsx.writeBuffer());
}
const brandHeaders=["brand_code","brand_name","brand_slug","product_category","status","notes"];
const modelHeaders=["brand_code","model_code","brand_name","model_name","model_slug","launch_year","device_type","specifications_json","status","source_reference","verification_status","notes"];
const variantHeaders=["device_code","brand_code","model_code","variant_code","brand_name","model_name","ram_gb","storage_gb","colour","region","sku","status","repair_enabled","buyback_enabled","resale_enabled","notes"];

test("device master parser preserves code components and derives the seven digit code",async()=>{
  const buffer=await makeBook({
    START_HERE:[["topic","instruction"],["Purpose","Test fixture"]],
    BRAND_REGISTRY:[brandHeaders,["14","Apple","apple","Smartphones",1,""]],
    PHONE_MODELS:[modelHeaders,["14","013","Apple","iPhone 13","iphone-13",2021,"smartphone","{}",1,"official","verified",""]],
    DEVICE_VARIANTS:[variantHeaders,[null,"14","013","01","Apple","iPhone 13",4,128,"Midnight","IN","SKU-1",1,1,1,1,""]],
    CODE_RULES:[["rule_id","rule_name","rule"],["C1","Code","BBMMM VV"]],
  });
  const parsed=await parseWorkbook(buffer,"DEVICE_MASTER.xlsx");
  assert.equal(parsed.rows.DEVICE_VARIANTS[0].device_code,"1401301");
  assert.equal(parsed.documentation.START_HERE?.length,2);
  assert.equal(parsed.documentation.CODE_RULES?.length,2);
  assert.equal(parsed.totalRows,3);
  assert.equal(parsed.issues.length,0);
});

test("master parser reports missing and unmapped columns rather than silently dropping them",async()=>{
  const buffer=await makeBook({
    BRAND_REGISTRY:[["brand_code","brand_name","unexpected_private_field"],["14","Apple","retain me"]],
    PHONE_MODELS:[[...modelHeaders]],
    DEVICE_VARIANTS:[[...variantHeaders]],
  });
  const parsed=await parseWorkbook(buffer,"DEVICE_MASTER.xlsx");
  assert.ok(parsed.issues.some((issue)=>issue.message.includes("Missing required columns")));
  assert.ok(parsed.issues.some((issue)=>issue.message.includes("Unmapped columns")));
  assert.equal(parsed.rows.BRAND_REGISTRY[0].unexpected_private_field,"retain me");
});

test("repeated master keys and malformed device codes are flagged",async()=>{
  const buffer=await makeBook({
    BRAND_REGISTRY:[brandHeaders,["14","Apple","apple","Smartphones",1,""]],
    PHONE_MODELS:[modelHeaders,["14","013","Apple","iPhone 13","iphone-13",2021,"smartphone","{}",1,"official","verified",""]],
    DEVICE_VARIANTS:[variantHeaders,["000000","14","013","01","Apple","iPhone 13",4,128,"Midnight","IN","SKU-1",1,1,1,1,""],["000000","14","013","01","Apple","iPhone 13",4,128,"Midnight","IN","SKU-1",1,1,1,1,""]],
  });
  const parsed=await parseWorkbook(buffer,"DEVICE_MASTER.xlsx");
  assert.ok(parsed.issues.some((issue)=>issue.severity==="duplicate"));
  assert.ok(parsed.issues.some((issue)=>issue.field==="device_code"&&issue.message.includes("exactly seven digits")));
  assert.ok(parsed.issues.some((issue)=>issue.message.includes("must match brand/model/variant")));
});

test("supported master workbook layouts can be previewed when empty",async()=>{
  const definitions:Record<string,Record<string,string[]>>={
    "DEVICE_MASTER.xlsx":{BRAND_REGISTRY:["brand_code","brand_name","brand_slug","product_category","status"],PHONE_MODELS:["brand_code","model_code","model_name","model_slug","device_type","status"],DEVICE_VARIANTS:["brand_code","model_code","variant_code","storage_gb","status"]},
    "REPAIR_MASTER.xlsx":{REPAIR_ISSUES:["issue_code","issue_name","status"],REPAIR_PRICES:["device_code","issue_code","customer_price_inr","verified","status"]},
    "BUYBACK_MASTER.xlsx":{CONDITION_GRADES:["condition_grade","grade_name","status"],BUYBACK_RULES:["device_code","condition_grade","estimated_offer_inr","verified","status"]},
    "RESALE_MASTER.xlsx":{RESALE_INVENTORY:["inventory_sku","device_code","condition_grade","stock_quantity","selling_price_inr","listing_status"],CONDITION_GRADES:["condition_grade","grade_name","status"]},
    "ACCESSORIES_MASTER.xlsx":{ACCESSORIES:["accessory_code","accessory_name","selling_price_inr","stock_quantity","status"]},
    "SERVICE_PROVIDER_MASTER.xlsx":{PROVIDERS:["provider_code","business_name","status"]},
    "PRICING_POLICY_MASTER.xlsx":{AGE_DEPRECIATION_POLICY:["policy_code","status"],CONDITION_DEDUCTION_POLICY:["deduction_code","status"],BUYBACK_MARGIN_POLICY:["policy_code","status"]},
  };
  for(const [workbook,sheets] of Object.entries(definitions)){
    const parsed=await parseWorkbook(await makeBook(Object.fromEntries(Object.entries(sheets).map(([name,headers])=>[name,[headers]]))),workbook as Parameters<typeof parseWorkbook>[1]);
    assert.equal(parsed.totalRows,0,`${workbook} should remain an empty template`);
    assert.equal(parsed.issues.length,0,`${workbook} required sheets and headers should be recognized`);
  }
});

test("device template comment links and blank formula template rows preview cleanly",async()=>{
  const book=new ExcelJS.Workbook();
  book.addWorksheet("START_HERE").addRows([["topic","instruction"],["Purpose","Fixture"]]);
  const brands=book.addWorksheet("BRAND_REGISTRY");brands.addRow(brandHeaders);brands.getCell("A1").note="Brand allocations require review.";
  book.addWorksheet("PHONE_MODELS").addRow(modelHeaders);
  const variants=book.addWorksheet("DEVICE_VARIANTS");variants.addRow(variantHeaders);variants.getCell("A2").value={formula:"IF(B2=\"\",\"\",B2)",result:""};
  const zip=await JSZip.loadAsync(await book.xlsx.writeBuffer());
  const relationshipPath="xl/worksheets/_rels/sheet2.xml.rels";
  let relationships=await zip.file(relationshipPath)!.async("string");
  relationships=relationships.replace("../comments2.xml","/xl/comments/comment2.xml").replace("../drawings/vmlDrawing2.vml","/xl/drawings/commentsDrawing2.vml");
  zip.file(relationshipPath,relationships);
  zip.file("xl/comments/comment2.xml",await zip.file("xl/comments2.xml")!.async("nodebuffer"));zip.remove("xl/comments2.xml");
  zip.file("xl/drawings/commentsDrawing2.vml",await zip.file("xl/drawings/vmlDrawing2.vml")!.async("nodebuffer"));zip.remove("xl/drawings/vmlDrawing2.vml");
  const parsed=await parseWorkbook(Buffer.from(await zip.generateAsync({type:"nodebuffer"})),"DEVICE_MASTER.xlsx");
  assert.equal(parsed.totalRows,0);
  assert.equal(parsed.issues.length,0);
});
