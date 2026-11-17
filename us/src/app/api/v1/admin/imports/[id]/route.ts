import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/staff";
import { commitImport } from "@/lib/imports/commit";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Import action failed";
  const status = message === "Authentication required" ? 401 : message.includes("authorised") ? 403 : message.includes("not configured") ? 503 : 400;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(_request: Request, { params }: Context) {
  try {
    await requireStaff(["catalogue_manager", "inventory_manager"], "imports.manage");
    const { id } = await params;
    const supabase = createSupabaseServerClient();
    const [{ data: batch, error }, { data: issues, error: issueError }] = await Promise.all([
      supabase.from("import_batches").select("id,workbook,file_name,status,total_rows,valid_rows,invalid_rows,duplicate_rows,imported_rows,report,created_at,committed_at").eq("id", id).single(),
      supabase.from("import_errors").select("sheet_name,row_number,severity,field_name,message,row_data").eq("batch_id", id).order("row_number"),
    ]);
    if (error) throw error;
    if (issueError) throw issueError;
    return NextResponse.json({ data: { ...batch, issues: issues ?? [] } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request, { params }: Context) {
  try {
    const { user } = await requireStaff(["catalogue_manager", "inventory_manager"], "imports.manage");
    const body = await request.json() as { action?: string };
    if (body.action !== "commit") return NextResponse.json({ error: "Use action=commit after reviewing the import preview." }, { status: 400 });
    const { id } = await params;
    const supabase = createSupabaseServerClient();
    const { data: batch, error } = await supabase.from("import_batches").select("id,workbook,status,report,total_rows").eq("id", id).single();
    if (error || !batch) return NextResponse.json({ error: "Import preview not found." }, { status: 404 });
    if (batch.status !== "preview") return NextResponse.json({ error: "This import is no longer awaiting confirmation." }, { status: 409 });
    const issues = ((batch.report as { issues?: Array<{severity:string}> } | null)?.issues ?? []);
    if (issues.some((issue) => issue.severity === "error" || issue.severity === "duplicate")) return NextResponse.json({ error: "Resolve all validation errors and duplicate rows, then upload the corrected workbook for a fresh preview." }, { status: 409 });
    const result = await commitImport(supabase, batch as never, user.id);
    return NextResponse.json({ data: { batchId: id, ...result } });
  } catch (error) { return errorResponse(error); }
}
