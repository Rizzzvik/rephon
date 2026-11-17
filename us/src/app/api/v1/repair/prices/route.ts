import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getVerifiedRepairPrices } from "@/lib/pricing/verified-rules";
export const dynamic="force-dynamic";
export async function GET(request:Request){
  const params=new URL(request.url).searchParams;const deviceCode=params.get("deviceCode")||"";const issueCode=params.get("issueCode")||"";const city=params.get("city")?.trim();
  if(!/^\d{7}$/.test(deviceCode)||!issueCode||issueCode.length>80)return NextResponse.json({error:"Provide a seven-digit deviceCode and issueCode."},{status:400});
  try{const db=createSupabaseServerClient();const prices=await getVerifiedRepairPrices(db,{deviceCode,issueCodes:[issueCode],city:city||null});const rule=prices.get(issueCode);const data=rule?[{customer_price_inr:rule.customer_price_inr,warranty_days:rule.warranty_days,city:rule.city,valid_from:rule.valid_from,valid_to:rule.valid_to}]:[];return NextResponse.json({data,quoteRequired:!rule});}
  catch{return NextResponse.json({error:"Repair pricing is unavailable. Request a manual quote."},{status:503});}
}
