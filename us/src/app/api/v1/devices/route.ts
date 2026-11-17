import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export const dynamic="force-dynamic";
export async function GET(request:Request){
  try{const url=new URL(request.url);const service=url.searchParams.get("service");if(service&&!(["buy","sell","repair"].includes(service)))return NextResponse.json({error:"service must be buy, sell or repair."},{status:400});const flags=service==="buy"?"resale_enabled":service==="sell"?"buyback_enabled":service==="repair"?"repair_enabled":null;const db=createSupabaseServerClient();let q=db.from("phone_variants").select("id,device_code,variant_code,ram_gb,storage_gb,color,region,model:phone_models!inner(id,model_code,name,slug,release_year,brand:phone_brands!inner(id,brand_code,name,slug))").eq("is_active",true).eq("status",1).eq("model.is_active",true).eq("model.status",1).eq("model.verification_status","verified").eq("model.brand.is_active",true).eq("model.brand.status",1).order("storage_gb");if(flags)q=q.eq(flags,true);const {data,error}=await q;if(error)throw error;return NextResponse.json({data:data??[]});}
  catch{return NextResponse.json({error:"Device catalogue is unavailable."},{status:503});}
}
