import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
type Context={params:Promise<{id:string}>};
export async function GET(_request:Request,{params}:Context){
  const {id}=await params;
  if(id.length>80)return NextResponse.json({error:"Request not found."},{status:404});
  try{const db=createSupabaseServerClient();const {data,error}=await db.from("questionnaire_submissions").select("reference,status,journey,created_at,device_code,sell_requests!inner(final_offer_inr)").eq("reference",id).eq("journey","sell").maybeSingle();if(error)throw error;if(!data)return NextResponse.json({error:"Request not found."},{status:404});return NextResponse.json({data:{reference:data.reference,status:data.status,journey:data.journey,createdAt:data.created_at,deviceCode:data.device_code,finalOfferInr:(data.sell_requests as unknown as {final_offer_inr:number|null}).final_offer_inr}});}catch{return NextResponse.json({error:"Request status is temporarily unavailable."},{status:503});}
}
