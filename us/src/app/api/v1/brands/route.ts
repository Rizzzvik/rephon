import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export const dynamic="force-dynamic";
export async function GET(){
  try{const {data,error}=await createSupabaseServerClient().from("phone_brands").select("id,brand_code,name,slug,product_category").order("name");if(error)throw error;return NextResponse.json({data:data??[]});}
  catch{return NextResponse.json({error:"Device catalogue is unavailable."},{status:503});}
}
