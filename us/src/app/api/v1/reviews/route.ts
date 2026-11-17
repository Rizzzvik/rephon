import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export const dynamic="force-dynamic";
export async function GET(){try{const {data,error}=await createSupabaseServerClient().from("customer_reviews").select("id,author_display,review_text,rating,journey,published_at").eq("status","published").eq("verified_customer",true).order("published_at",{ascending:false}).limit(24);if(error)throw error;return NextResponse.json({data:data??[]});}catch{return NextResponse.json({error:"Customer reviews are unavailable."},{status:503});}}
