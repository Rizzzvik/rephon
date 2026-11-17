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
      const user=await getCustomerSession();
      if(!user) return NextResponse.json({error:"Sign in with Google before submitting a request."},{status:401});
      if(files.reduce((sum,file)=>sum+file.size,0)>20*1024*1024) return NextResponse.json({error:"Attachments must total less than 20 MB."},{status:413});
      const allowedTypes=new Set(["image/jpeg","image/png","image/webp","image/heic","video/mp4","video/quicktime"]);
      if(files.some((file)=>file.size>10*1024*1024||!allowedTypes.has(file.type))) return NextResponse.json({error:"Use JPEG, PNG, WebP or HEIC photos, or MP4/MOV video. Each file must be under 10 MB."},{status:415});
      for(const file of files){const bytes=new Uint8Array(await file.slice(0,16).arrayBuffer());if(!matchesMediaType(file.type,bytes))return NextResponse.json({error:"An attachment does not match its declared image or video type."},{status:415});}
      const customer=readCustomer(original);
      if(customer.fullName.length<2||!/^[0-9]{10}$/.test(customer.mobile)||!/^[0-9]{6}$/.test(customer.pinCode)) return NextResponse.json({error:"Enter your name, 10-digit mobile number, and 6-digit PIN code."},{status:400});
      customer.email=user.email||"";
      const supabase=createSupabaseServerClient();
      const {data:existingCustomer,error:existingCustomerError}=await supabase.from("customers").select("id,auth_user_id").eq("mobile",customer.mobile).maybeSingle();
      if(existingCustomerError) throw existingCustomerError;
      if(existingCustomer?.auth_user_id&&existingCustomer.auth_user_id!==user.id) return NextResponse.json({error:"This mobile number is already linked to another customer account."},{status:409});
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
      const {data:customerRecord,error:customerLookupError}=await supabase.from("customers").select("id,auth_user_id").eq("mobile",customer.mobile).single();
      if(customerLookupError||!customerRecord) throw new Error("The verified customer profile could not be linked.");
      if(customerRecord.auth_user_id&&customerRecord.auth_user_id!==user.id) throw new Error("This phone number is linked to a different customer account.");
      const {error:customerLinkError}=await supabase.from("customers").update({auth_user_id:user.id,email:user.email,last_login_at:new Date().toISOString()}).eq("id",customerRecord.id);
      if(customerLinkError) throw new Error("The customer profile could not be linked.");
      const {data:requestRecord,error:requestRecordError}=await supabase.from("service_requests").select("request_code").eq("questionnaire_submission_id",result.submission_id).single();
      if(requestRecordError||!requestRecord?.request_code) throw new Error("The request reference could not be generated.");
      let indicativeOfferInr:number|null=null;
      let repairPrices:Array<{issueCode:string;priceInr:number;warrantyDays:number|null}> = [];
      let requestedRepairIssueCount=0;
      if(journey==="sell"&&deviceCode&&!result.duplicate){
        const code=(key:string)=>label(original[key]).split("·")[0]?.trim()||"";
        const screen=code("screenCode"),body=code("bodyCode"),functional=code("functional"),city=label(original.city).replace(/[^\p{L}\p{N} -]/gu,"").trim();
        // Customer answers may support a preliminary indicative amount only when one exact verified rule applies.
        // Battery answers are categorical, so rules requiring a numeric battery range are not eligible here.
        if(screen&&body&&functional){
          const rule=await getVerifiedBuybackRule(supabase,{deviceCode,screen,body,functional,city});
          if(rule){
            const {data:sellRequest,error:sellError}=await supabase.from("sell_requests").select("id").eq("submission_id",result.submission_id).single();if(sellError)throw sellError;
            indicativeOfferInr=Number(rule.estimated_offer_inr);
            const {error:quoteError}=await supabase.from("buyback_quotes").insert({sell_request_id:sellRequest.id,rule_id:rule.id,amount_inr:indicativeOfferInr,quote_type:"indicative",status:"pending_review",notes:"Preliminary rule match based on customer responses; inspection is still required."});if(quoteError)throw quoteError;
            const {error:updateError}=await supabase.from("sell_requests").update({indicative_offer_inr:indicativeOfferInr}).eq("id",sellRequest.id);if(updateError)throw updateError;
          }
        }
      }
      if(journey==="sell"&&deviceCode&&result.duplicate){const {data:existingOffer,error:offerError}=await supabase.from("sell_requests").select("indicative_offer_inr").eq("submission_id",result.submission_id).maybeSingle();if(offerError)throw offerError;indicativeOfferInr=existingOffer?.indicative_offer_inr??null;}
      if(journey==="repair"&&deviceCode&&issueCodes.length){
        requestedRepairIssueCount=issueLabels.length;
        const city=label(original.city).replace(/[^\p{L}\p{N} -]/gu,"").trim();
        const matchedPrices=await getVerifiedRepairPrices(supabase,{deviceCode,issueCodes,city:city||null});
        repairPrices=[...matchedPrices.entries()].map(([issueCode,price])=>({issueCode,priceInr:Number(price.customer_price_inr),warrantyDays:price.warranty_days}));
        if(!result.duplicate){const {data:repairRequest,error:repairRequestError}=await supabase.from("repair_requests").select("id").eq("submission_id",result.submission_id).single();if(repairRequestError)throw repairRequestError;const quoteRows=repairPrices.map((price)=>{const matched=matchedPrices.get(price.issueCode);return {repair_request_id:repairRequest.id,rule_id:matched?.id??null,amount_inr:price.priceInr,status:"fixed_verified",issued_by:null};});if(quoteRows.length){const {error:quoteError}=await supabase.from("repair_quotes").insert(quoteRows);if(quoteError)throw quoteError;}if(issueCodes.length!==requestedRepairIssueCount||repairPrices.length!==issueCodes.length){const {error:manualError}=await supabase.from("repair_quotes").insert({repair_request_id:repairRequest.id,rule_id:null,amount_inr:null,status:"manual_quote"});if(manualError)throw manualError;}}
      }
      let uploaded=0;let uploadErrors=0;
      for(const file of result.duplicate?[]:files){
        const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,"_").slice(-90);
        const path=`${result.submission_id}/${crypto.randomUUID()}-${safeName}`;
        const {error:storageError}=await supabase.storage.from("customer-submissions").upload(path,file,{contentType:file.type,upsert:false});
        if(storageError){uploadErrors++;continue;}
        const {error:rowError}=await supabase.from("uploaded_files").insert({submission_id:result.submission_id,storage_path:path,mime_type:file.type,byte_size:file.size});
        if(rowError){await supabase.storage.from("customer-submissions").remove([path]);uploadErrors++;continue;}
        uploaded++;
      }
      return NextResponse.json({data:{reference:result.reference,requestCode:requestRecord.request_code,duplicate:Boolean(result.duplicate),deviceMatched:Boolean(deviceCode),quoteRequired:journey==="repair"?issueCodes.length!==requestedRepairIssueCount||repairPrices.length!==issueCodes.length:journey==="sell"?indicativeOfferInr===null:false,indicativeOfferInr,repairPrices,uploads:{accepted:uploaded,failed:uploadErrors}}},{status:result.duplicate?200:201});
    } catch(error){
      console.error(`${journey} questionnaire submission failed`,error instanceof Error?error.message:"unknown error");
      return NextResponse.json({error:"We could not save this request. Please try again or contact our team."},{status:503});
    }
  };
}
