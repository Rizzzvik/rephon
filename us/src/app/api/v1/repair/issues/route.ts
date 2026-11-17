import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export const dynamic="force-dynamic";
export async function GET(){try{const {data,error}=await createSupabaseServerClient().from("repair_issues").select("issue_code,issue_name,issue_category,description").eq("status",1).order("issue_category").order("issue_name");if(error)throw error;return NextResponse.json({data:data??[]});}catch{return NextResponse.json({error:"Repair options are unavailable."},{status:503});}}
