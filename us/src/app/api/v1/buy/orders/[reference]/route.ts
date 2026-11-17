import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{reference:string}>};
export async function GET(_request:Request,{params}:Context){const {reference}=await params;if(!/^WP-BUY-[A-F0-9]{8}$/i.test(reference))return NextResponse.json({error:"Order not found."},{status:404});try{const {data,error}=await createSupabaseServerClient().from("buy_orders").select("reference,status,total_inr,created_at").eq("reference",reference).maybeSingle();if(error)throw error;if(!data)return NextResponse.json({error:"Order not found."},{status:404});return NextResponse.json({data:{reference:data.reference,status:data.status,totalInr:data.total_inr,createdAt:data.created_at}});}catch{return NextResponse.json({error:"Order status is temporarily unavailable."},{status:503});}}
