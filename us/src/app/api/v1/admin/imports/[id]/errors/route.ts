import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const csv = (value: unknown) => `"${String(value ?? "").replaceAll('"','""')}"`;

export async function GET(_request: Request, { params }: Context) {
  try {
    await requireStaff(["catalogue_manager", "inventory_manager"], "imports.manage");
    const { id } = await params;
    const { data, error } = await createSupabaseServerClient().from("import_errors").select("sheet_name,row_number,severity,field_name,message,row_data").eq("batch_id",id).order("sheet_name").order("row_number");
    if (error) throw error;
    const lines = [["sheet","row","severity","field","message","row_data"],...(data??[]).map((item)=>[item.sheet_name,item.row_number,item.severity,item.field_name,item.message,JSON.stringify(item.row_data)])].map((row)=>row.map(csv).join(",")).join("\r\n");
    return new NextResponse(lines,{headers:{"content-type":"text/csv; charset=utf-8","content-disposition":`attachment; filename="import-${id}-errors.csv"`,"cache-control":"no-store"}});
  } catch (error) {
    const message=error instanceof Error?error.message:"Error report unavailable";
    const status=message==="Authentication required"?401:message.includes("authorised")?403:503;
    return NextResponse.json({error:message},{status});
  }
}
