import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCustomerSession } from "@/lib/auth/customer";
import { getVerifiedBuybackRule, getVerifiedRepairPrices } from "@/lib/pricing/verified-rules";

type Journey = "buy" | "sell" | "repair";
type Choice = { id: string; label: string };
type AnswerValue = string | Choice | Array<string | Choice> | null;
function label(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object" && "label" in value) return String((value as Choice).label).trim();
  return "";
}
function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object" && "id" in value && "label" in value) return { optionId: String((value as Choice).id), label: String((value as Choice).label) };
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => !["url","file","size","type"].includes(key)).map(([key,item])=>[key,normalize(item)]));
  return value;
}
function stableId(value: string) { return /^[a-z0-9_-]{1,96}$/i.test(value) ? value : `answer:${createHash("sha256").update(value).digest("hex").slice(0,24)}`; }
function matchesMediaType(type:string,bytes:Uint8Array){
  if(type==="image/jpeg")return bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
  if(type==="image/png")return bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47;
  if(type==="image/webp")return String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&String.fromCharCode(...bytes.slice(8,12))==="WEBP";
  if(type==="image/heic")return String.fromCharCode(...bytes.slice(4,12)).includes("ftyp");
  if(type==="video/mp4"||type==="video/quicktime")return String.fromCharCode(...bytes.slice(4,8))==="ftyp";
  return false;
}
function readCustomer(answers: Record<string,AnswerValue>) {
  return Object.fromEntries(["fullName","mobile","email","pinCode","address","street","landmark","city"].map((key)=>[key,label(answers[key])]));
}
function statementAnswer(value:unknown):string{
  if(Array.isArray(value))return value.map(statementAnswer).filter(Boolean).join(", ");
  if(value&&typeof value==="object"&&"label" in value)return String((value as Choice).label).trim();
  if(typeof value==="string")return value.trim();
  if(typeof value==="number"||typeof value==="boolean")return String(value);
  return "";
}
function makeCustomerStatement(journey:Journey,requestCode:string,customer:Record<string,string>,answers:Record<string,AnswerValue>,attachmentCount:number):string{
  const journeyTitle = { buy: "Buy a phone", sell: "Sell a phone", repair: "Repair a phone" }[journey];
  const lines: string[] = [
    `Hi REPHON 24X7, I would like to submit a ${journeyTitle} request.`,
    requestCode ? `Request ID: ${requestCode}` : "",
    "",
    "Customer Details:",
    `• Name: ${customer.fullName || label(answers.fullName) || "Not provided"}`,
    `• Mobile: ${customer.mobile || label(answers.mobile) || "Not provided"}`,
  ];

  if (customer.email || label(answers.email)) lines.push(`• Email: ${customer.email || label(answers.email)}`);
  if (customer.pinCode || label(answers.pinCode)) lines.push(`• PIN Code: ${customer.pinCode || label(answers.pinCode)}`);
  if (answers.servicePreference) lines.push(`• Service Preference: ${statementAnswer(answers.servicePreference)}`);
  if (customer.address || label(answers.address)) lines.push(`• Pickup Address: ${customer.address || label(answers.address)}`);
  if (answers.appointmentDate) lines.push(`• Preferred Date: ${statementAnswer(answers.appointmentDate)}`);

  lines.push("", "Device & Request Details:");

  const brand = statementAnswer(answers.brand);
  const model = statementAnswer(answers.model);
  const variant = statementAnswer(answers.variant);
  const colour = statementAnswer(answers.colour);

  if (brand) lines.push(`• Brand: ${brand}`);
  if (model) lines.push(`• Model: ${model}`);
  if (variant) lines.push(`• Variant: ${variant}`);
  if (colour) lines.push(`• Preferred Colour: ${colour}`);

  if (journey === "repair") {
    if (answers.powersOn) lines.push(`• Powers On: ${statementAnswer(answers.powersOn)}`);
    if (answers.issues) lines.push(`• Selected Issues: ${statementAnswer(answers.issues)}`);

    Object.entries(answers).forEach(([key, val]) => {
      if (key.startsWith("symptoms-")) {
        const issueName = key.replace("symptoms-", "");
        const symptomVal = statementAnswer(val);
        if (symptomVal) lines.push(`• ${issueName} Symptoms: ${symptomVal}`);
      }
    });
  } else if (journey === "sell") {
    if (answers.age) lines.push(`• Phone Age: ${statementAnswer(answers.age)}`);
    if (answers.screenCode) lines.push(`• Screen Condition: ${statementAnswer(answers.screenCode)}`);
    if (answers.bodyCode) lines.push(`• Body Condition: ${statementAnswer(answers.bodyCode)}`);
    if (answers.functional) lines.push(`• Functionality: ${statementAnswer(answers.functional)}`);
    if (answers.batteryStatus) lines.push(`• Battery Condition: ${statementAnswer(answers.batteryStatus)}`);
    if (answers.otherIssues) lines.push(`• Other Issues: ${statementAnswer(answers.otherIssues)}`);
    if (answers.repairHistory) lines.push(`• Repair History: ${statementAnswer(answers.repairHistory)}`);
    if (answers.waterExposure) lines.push(`• Water Damage: ${statementAnswer(answers.waterExposure)}`);
    if (answers.billBox) lines.push(`• Bill & Box: ${statementAnswer(answers.billBox)}`);
  } else if (journey === "buy") {
    if (answers.condition) lines.push(`• Preferred Condition: ${statementAnswer(answers.condition)}`);
    if (answers.batteryHealth) lines.push(`• Battery Health: ${statementAnswer(answers.batteryHealth)}`);
    if (answers.warranty) lines.push(`• Warranty: ${statementAnswer(answers.warranty)}`);
    if (answers.priorities) lines.push(`• Priorities: ${statementAnswer(answers.priorities)}`);
  }

  if (answers.additionalDetails) {
    lines.push(`• Additional Notes: ${statementAnswer(answers.additionalDetails)}`);
  }

  if (attachmentCount) {
    lines.push(`• Attachments: ${attachmentCount} file(s) attached with the website request.`);
  }

  lines.push("", "Please assist me with the next steps.");
  return lines.filter(Boolean).join("\n").slice(0, 3600);
}

export function createQuestionnairePostHandler(journey: Journey) {
  return async function POST(request: Request) {
    try {
      const contentLength=Number(request.headers.get("content-length")||0);
      if(contentLength>22*1024*1024) return NextResponse.json({error:"Request is too large. Keep each photo under 10 MB."},{status:413});
      const type=request.headers.get("content-type")||"";
      let payload: { answers?:Record<string,AnswerValue>; idempotencyKey?:string };
      let files: File[]=[];
      if(type.includes("multipart/form-data")){
        const form=await request.formData();const raw=form.get("submission");
        if(typeof raw!=="string") return NextResponse.json({error:"Questionnaire answers are missing."},{status:400});
        payload=JSON.parse(raw) as typeof payload;
        files=form.getAll("files").filter((item):item is File=>item instanceof File&&item.size>0);
      }else payload=await request.json() as typeof payload;
      const original=payload.answers;
      if(!original||typeof original!=="object"||Array.isArray(original)) return NextResponse.json({error:"Questionnaire answers are required."},{status:400});
      const user = await getCustomerSession().catch(() => null);
      if(files.reduce((sum,file)=>sum+file.size,0)>20*1024*1024) return NextResponse.json({error:"Attachments must total less than 20 MB."},{status:413});
      const allowedTypes=new Set(["image/jpeg","image/png","image/webp","image/heic","video/mp4","video/quicktime"]);
      if(files.some((file)=>file.size>10*1024*1024||!allowedTypes.has(file.type))) return NextResponse.json({error:"Use JPEG, PNG, WebP or HEIC photos, or MP4/MOV video. Each file must be under 10 MB."},{status:415});
      for(const file of files){const bytes=new Uint8Array(await file.slice(0,16).arrayBuffer());if(!matchesMediaType(file.type,bytes))return NextResponse.json({error:"An attachment does not match its declared image or video type."},{status:415});}
      const customer=readCustomer(original);
      if(customer.fullName.length<2||!/^[0-9]{10}$/.test(customer.mobile)||!/^[0-9]{6}$/.test(customer.pinCode)) return NextResponse.json({error:"Enter your name, 10-digit mobile number, and 6-digit PIN code."},{status:400});
      if(user?.email) customer.email=user.email;
      const supabase=createSupabaseServerClient();
      const idempotencyKey=typeof payload.idempotencyKey==="string"&&payload.idempotencyKey.length<=160?payload.idempotencyKey:null;
      const answerCopy=Object.fromEntries(Object.entries(original).filter(([key])=>!["fullName","mobile","email","pinCode","address","street","landmark","city","photos","media"].includes(key)));
      const normalized=normalize(answerCopy) as Record<string,unknown>;
      const choiceMap=Object.fromEntries(Object.entries(answerCopy).map(([key,value])=>[stableId(key),normalize(value)]));
      const model=label(original.model);const brand=label(original.brand);let deviceCode:string|null=null;
      const selectedVariantId = original.variant && typeof original.variant === "object" && !Array.isArray(original.variant) && typeof original.variant.id === "string" ? original.variant.id : "";
      const selectedModelId = original.model && typeof original.model === "object" && !Array.isArray(original.model) && typeof original.model.id === "string" ? original.model.id : "";
      const selectedBrandId = original.brand && typeof original.brand === "object" && !Array.isArray(original.brand) && typeof original.brand.id === "string" ? original.brand.id : "";
      if(/^\d{7}$/.test(selectedVariantId)&&selectedModelId){
        const deviceQuery=supabase.from("phone_variants").select("device_code,model_id,storage_gb,color,model:phone_models!inner(id,name,verification_status,brand_id,brand:phone_brands!inner(id,name))").eq("device_code",selectedVariantId).eq("model_id",selectedModelId).limit(1);
        const {data,error}=await deviceQuery;
        if(error) throw error;
        const found=(data??[])[0];
        const m=found?.model as unknown as {id:string;name:string;brand_id:string;brand:{id:string;name:string}|{id:string;name:string}[]}|undefined;
        const b=m?(Array.isArray(m.brand)?m.brand[0]:m.brand):undefined;
        if(found&&m?.id===selectedModelId&&m.name.toLowerCase()===model.toLowerCase()&&b?.id===selectedBrandId&&b.name.toLowerCase()===brand.toLowerCase())deviceCode=found.device_code;
      }
      const issueValues=Array.isArray(original.issues)?original.issues:[];
      const issueLabels=issueValues.map(label).filter(Boolean);let issueCodes:string[]=[];
      if(journey==="repair"&&issueLabels.length){const {data:knownIssues,error:issueError}=await supabase.from("repair_issues").select("issue_code,issue_name").eq("status",1).in("issue_name",issueLabels);if(issueError)throw issueError;issueCodes=(knownIssues??[]).map((item)=>item.issue_code);}
      const normalizedRecord={...normalized,issueCodes,reportedCondition:normalized,preferences:normalized,diagnostics:Object.fromEntries(Object.entries(normalized).filter(([key])=>key.startsWith("symptoms-")||key==="additionalDetails"))};
      const {data:created,error:createError}=await supabase.rpc("create_questionnaire_submission",{
        p_journey:journey,p_customer:customer,p_answers:choiceMap,p_normalized:normalizedRecord,p_device_code:deviceCode,p_idempotency_key:idempotencyKey,
      });
      if(createError) throw new Error(createError.message);
      const result=Array.isArray(created)?created[0]:created;
      if(!result?.reference||!result?.submission_id) throw new Error("The request could not be saved.");

      if (user?.id) {
        try {
          const {data:customerRecord}=await supabase.from("customers").select("id").eq("mobile",customer.mobile).maybeSingle();
          if(customerRecord) {
            await supabase.from("customers").update({auth_user_id:user.id,email:user.email,last_login_at:new Date().toISOString()}).eq("id",customerRecord.id);
          }
        } catch { /* auth linking is optional */ }
      }

      let requestCode: string = result.reference;
      let requestRecord: { request_code: string; request_details?: unknown } | null = null;
      try {
        const {data}=await supabase.from("service_requests").select("request_code,request_details").eq("questionnaire_submission_id",result.submission_id).maybeSingle();
        if(data?.request_code){
          requestRecord = data;
          requestCode = data.request_code;
        }
      } catch { /* fallback to direct creation */ }

      if(!requestRecord) {
        try {
          const fallbackCode = result.reference?.replace(/^WP-[A-Z]+-/, "").slice(0, 6) || Math.floor(100000 + Math.random() * 900000).toString();
          const { data: inserted } = await supabase.from("service_requests").insert({
            request_code: fallbackCode,
            customer_id: result.customer_id,
            request_type: journey,
            request_source: "website",
            questionnaire_submission_id: result.submission_id,
            device_code: deviceCode,
            status: "submitted",
            request_details: normalizedRecord
          }).select("request_code,request_details").maybeSingle();
          if(inserted?.request_code){
            requestRecord = inserted;
            requestCode = inserted.request_code;
          }
        } catch { /* proceed with reference */ }
      }

      const customerStatement=makeCustomerStatement(journey,requestCode,customer,original,files.length);
      try {
        const existingDetails=requestRecord?.request_details&&typeof requestRecord.request_details==="object"&&!Array.isArray(requestRecord.request_details)?requestRecord.request_details as Record<string,unknown>:normalizedRecord;
        await supabase.from("service_requests").update({request_details:{...existingDetails,customer_statement:customerStatement}}).eq("request_code",requestCode);
      } catch { /* statement update is non-fatal */ }

      let indicativeOfferInr:number|null=null;
      let repairPrices:Array<{issueCode:string;priceInr:number;warrantyDays:number|null}> = [];
      let requestedRepairIssueCount=0;
      if(journey==="sell"&&deviceCode&&!result.duplicate){
        const code=(key:string)=>label(original[key]).split("·")[0]?.trim()||"";
        const screen=code("screenCode"),body=code("bodyCode"),functional=code("functional"),city=label(original.city).replace(/[^\p{L}\p{N} -]/gu,"").trim();
        if(screen&&body&&functional){
          try {
            const rule=await getVerifiedBuybackRule(supabase,{deviceCode,screen,body,functional,city});
            if(rule){
              const {data:sellRequest}=await supabase.from("sell_requests").select("id").eq("submission_id",result.submission_id).maybeSingle();
              if(sellRequest){
                indicativeOfferInr=Number(rule.estimated_offer_inr);
                await supabase.from("buyback_quotes").insert({sell_request_id:sellRequest.id,rule_id:rule.id,amount_inr:indicativeOfferInr,quote_type:"indicative",status:"pending_review",notes:"Preliminary rule match based on customer responses; inspection is still required."});
                await supabase.from("sell_requests").update({indicative_offer_inr:indicativeOfferInr}).eq("id",sellRequest.id);
              }
            }
          } catch { /* optional pricing rule */ }
        }
      }
      if(journey==="sell"&&deviceCode&&result.duplicate){
        try {
          const {data:existingOffer}=await supabase.from("sell_requests").select("indicative_offer_inr").eq("submission_id",result.submission_id).maybeSingle();
          indicativeOfferInr=existingOffer?.indicative_offer_inr??null;
        } catch { /* ignore */ }
      }
      if(journey==="repair"&&deviceCode&&issueCodes.length){
        try {
          requestedRepairIssueCount=issueLabels.length;
          const city=label(original.city).replace(/[^\p{L}\p{N} -]/gu,"").trim();
          const matchedPrices=await getVerifiedRepairPrices(supabase,{deviceCode,issueCodes,city:city||null});
          repairPrices=[...matchedPrices.entries()].map(([issueCode,price])=>({issueCode,priceInr:Number(price.customer_price_inr),warrantyDays:price.warranty_days}));
          if(!result.duplicate){
            const {data:repairRequest}=await supabase.from("repair_requests").select("id").eq("submission_id",result.submission_id).maybeSingle();
            if(repairRequest){
              const quoteRows=repairPrices.map((price)=>{
                const matched=matchedPrices.get(price.issueCode);
                return {repair_request_id:repairRequest.id,rule_id:matched?.id??null,amount_inr:price.priceInr,status:"fixed_verified",issued_by:null};
              });
              if(quoteRows.length){
                await supabase.from("repair_quotes").insert(quoteRows);
              }
            }
          }
        } catch { /* optional verified pricing */ }
      }
      let uploaded=0;let uploadErrors=0;
      for(const file of result.duplicate?[]:files){
        try {
          const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,"_").slice(-90);
          const path=`${result.submission_id}/${crypto.randomUUID()}-${safeName}`;
          const {error:storageError}=await supabase.storage.from("customer-submissions").upload(path,file,{contentType:file.type,upsert:false});
          if(storageError){uploadErrors++;continue;}
          const {error:rowError}=await supabase.from("uploaded_files").insert({submission_id:result.submission_id,storage_path:path,mime_type:file.type,byte_size:file.size});
          if(rowError){await supabase.storage.from("customer-submissions").remove([path]);uploadErrors++;continue;}
          uploaded++;
        } catch { uploadErrors++; }
      }
      return NextResponse.json({data:{reference:result.reference,requestCode,customerStatement,duplicate:Boolean(result.duplicate),deviceMatched:Boolean(deviceCode),quoteRequired:false,indicativeOfferInr,repairPrices,uploads:{accepted:uploaded,failed:uploadErrors}}},{status:result.duplicate?200:201});
    } catch(error){
      console.error(`${journey} questionnaire submission failed:`, error instanceof Error?error.message:error);
      const message = error instanceof Error ? error.message : "Unable to save your request. Please try again.";
      return NextResponse.json({error: message},{status:500});
    }
  };
}
