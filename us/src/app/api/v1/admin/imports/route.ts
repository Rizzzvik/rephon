import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/staff";
import { parseWorkbook, WORKBOOKS, type ImportWorkbook } from "@/lib/imports/workbooks";
import { validateWorkbookReferences } from "@/lib/imports/references";

export const dynamic = "force-dynamic";
const MAX_WORKBOOK_SIZE = 12 * 1024 * 1024;

function errorResponse(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : error && typeof error === "object" && "message" in error && typeof error.message === "string"
      ? error.message
      : "Import request failed";
  const status = message === "Authentication required" ? 401 : message.includes("authorised") ? 403 : message.includes("not configured") ? 503 : 400;
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    await requireStaff(["catalogue_manager", "inventory_manager"], "imports.manage");
    const { data, error } = await createSupabaseServerClient().from("import_batches")
      .select("id,workbook,file_name,status,total_rows,valid_rows,invalid_rows,duplicate_rows,imported_rows,created_at,committed_at")
      .order("created_at", { ascending: false }).limit(50);
    if (error) throw error;
    return NextResponse.json({ data: data ?? [] });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireStaff(["catalogue_manager", "inventory_manager"], "imports.manage");
    const form = await request.formData();
    const file = form.get("file");
    const workbook = form.get("workbook");
    if (!(file instanceof File) || typeof workbook !== "string" || !WORKBOOKS.includes(workbook as ImportWorkbook)) return NextResponse.json({ error: "Choose a supported master workbook and file." }, { status: 400 });
    if (file.size < 1 || file.size > MAX_WORKBOOK_SIZE) return NextResponse.json({ error: "Workbook must be smaller than 12 MB." }, { status: 413 });
    if (!file.name.toLowerCase().endsWith(".xlsx")) return NextResponse.json({ error: "Only .xlsx workbooks are supported." }, { status: 415 });
    const buffer = Buffer.from(await file.arrayBuffer());
    const hash = createHash("sha256").update(buffer).digest("hex");
    const supabase = createSupabaseServerClient();
    const parsed = await parseWorkbook(buffer, workbook as ImportWorkbook);
    parsed.issues.push(...await validateWorkbookReferences(parsed,supabase));
    const { data: existing } = await supabase.from("import_batches").select("id,status").eq("workbook", workbook).eq("file_sha256", hash).maybeSingle();
    if (existing?.status === "committed") return NextResponse.json({ error: "This exact workbook has already been imported.", batchId: existing.id }, { status: 409 });
    const errors = new Set(parsed.issues.filter((issue) => issue.severity === "error" && issue.row > 1).map((issue) => `${issue.sheet}:${issue.row}`)).size + (parsed.issues.some((issue) => issue.severity === "error" && issue.row === 1) ? 1 : 0);
    const duplicates = new Set(parsed.issues.filter((issue) => issue.severity === "duplicate").map((issue) => `${issue.sheet}:${issue.row}`)).size;
    const validRows = Math.max(0, parsed.totalRows - errors - duplicates);
    // Large reference workbooks can contain tens of thousands of staged rows.
    // Compress them before saving in jsonb to keep the PostgREST request small.
    const stagedRowsGzip = gzipSync(Buffer.from(JSON.stringify(parsed.rows))).toString("base64");
    const report = { sheets: parsed.sheets, stagedRowsGzip, issues: parsed.issues, audit: { errorCount: parsed.issues.filter((issue) => issue.severity === "error").length, invalidRowCount: errors, duplicateRowCount: duplicates, warningCount: parsed.issues.filter((issue) => issue.severity === "warning").length } };
    const { data: batch, error } = await supabase.from("import_batches").upsert({
      id: existing?.id,
      workbook,
      uploaded_by: user.id,
      file_name: file.name,
      file_sha256: hash,
      status: "preview",
      total_rows: parsed.totalRows,
      valid_rows: validRows,
      invalid_rows: errors,
      duplicate_rows: duplicates,
      report,
    }, { onConflict: "workbook,file_sha256" }).select("id,status,total_rows,valid_rows,invalid_rows,duplicate_rows").single();
    if (error) throw error;
    await supabase.from("import_errors").delete().eq("batch_id", batch.id);
    if (parsed.issues.length) {
      const records = parsed.issues.map((issue) => ({ batch_id: batch.id, sheet_name: issue.sheet, row_number: issue.row, severity: issue.severity, field_name: issue.field ?? null, message: issue.message, row_data: issue.data ?? {} }));
      const { error: issueError } = await supabase.from("import_errors").insert(records);
      if (issueError) throw issueError;
    }
    return NextResponse.json({ data: { ...batch, sheets: parsed.sheets, issues: parsed.issues } }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
