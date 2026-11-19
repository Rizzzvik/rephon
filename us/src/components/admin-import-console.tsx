"use client";

import { useEffect, useState } from "react";

type Batch = { id: string; workbook: string; file_name: string; status: string; total_rows: number; valid_rows: number; invalid_rows: number; duplicate_rows: number; imported_rows: number; created_at: string };
type Preview = Batch & { sheets: Array<{name:string;headers:string[];recognized:string[];unknown:string[];missing:string[];rowCount:number}>; issues: Array<{sheet:string;row:number;severity:string;field?:string;message:string}> };
const workbooks = ["DEVICE_MASTER.xlsx","REPAIR_MASTER.xlsx","BUYBACK_MASTER.xlsx","RESALE_MASTER.xlsx","ACCESSORIES_MASTER.xlsx","SERVICE_PROVIDER_MASTER.xlsx","PRICING_POLICY_MASTER.xlsx","REPHON_24X7_COMPLETE_MODEL_CATALOGUE_2019_2026.xlsx"];

async function readApiJson<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();
  try {
    return JSON.parse(body) as T;
  } catch {
    if (response.redirected) {
      throw new Error("Your staff session may have expired. Sign in again, then retry the workbook preview.");
    }
    if (contentType.includes("text/html") || /^\s*<!doctype html|^\s*<html/i.test(body)) {
      throw new Error(`The import API returned a webpage instead of JSON (HTTP ${response.status}). The deployed Worker may be missing this API route or may have failed while processing the workbook. Check the Cloudflare Worker logs and confirm the latest GitHub commit is deployed.`);
    }
    throw new Error(`The import API returned an unreadable response (HTTP ${response.status}). Retry once; if it persists, check the Cloudflare Worker logs.`);
  }
}

export function AdminImportConsole() {
  const [history, setHistory] = useState<Batch[]>([]);
  const [workbook, setWorkbook] = useState(workbooks[0]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const loadHistory = async () => {
    const response = await fetch("/api/v1/admin/imports", { cache: "no-store" });
    const body = await readApiJson<{data?:Batch[];error?:string}>(response);
    if (!response.ok) throw new Error(body.error || `Could not load import history (HTTP ${response.status}).`);
    setHistory(body.data ?? []);
  };
  useEffect(() => { void loadHistory(); }, []);

  const inspect = async () => {
    if (!file) { setMessage("Choose an .xlsx workbook first."); return; }
    setBusy(true); setMessage(""); setPreview(null);
    try {
      const form = new FormData(); form.set("workbook", workbook); form.set("file", file);
      const response = await fetch("/api/v1/admin/imports", { method: "POST", body: form });
      const body = await readApiJson<{data?:Preview;error?:string}>(response);
      if (!response.ok || !body.data) throw new Error(body.error || "The workbook could not be previewed.");
      setPreview(body.data); await loadHistory();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Import preview failed."); }
    finally { setBusy(false); }
  };
  const commit = async () => {
    if (!preview) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/v1/admin/imports/${preview.id}`, { method: "POST", headers: { "content-type":"application/json" }, body: JSON.stringify({ action:"commit" }) });
      const body = await readApiJson<{data?:{importedRows:number};error?:string}>(response);
      if (!response.ok) throw new Error(body.error || "Import could not be committed.");
      setMessage(`Import complete. ${body.data?.importedRows ?? 0} rows written.`); setPreview(null); setFile(null); await loadHistory();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Import commit failed."); }
    finally { setBusy(false); }
  };

  return <main className="admin-page"><div className="admin-heading"><p className="eyebrow">CONTROLLED DATA TOOLS</p><h1>Master workbook imports</h1><p>Preview, validate, and confirm business data before it becomes available to the website.</p></div>
    <section className="admin-panel"><div className="admin-panel-heading"><div><p className="eyebrow">STAGE 1 — SELECT</p><h2>Choose a master workbook</h2></div><span>Excel .xlsx · max 12 MB</span></div><div className="admin-import-form"><label>Workbook<select value={workbook} onChange={(event)=>{setWorkbook(event.target.value);setPreview(null);}}>{workbooks.map((name)=><option key={name}>{name}</option>)}</select></label><label>File<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event)=>{setFile(event.target.files?.[0]??null);setPreview(null);}} /></label><button type="button" className="glow-button" disabled={busy||!file} onClick={inspect}>{busy?"Working…":"Preview workbook"}</button></div>{message&&<p className="admin-message" role="status">{message}</p>}</section>
    {preview&&<section className="admin-panel admin-preview"><div className="admin-panel-heading"><div><p className="eyebrow">STAGES 2–4 — PREVIEW & VALIDATE</p><h2>{preview.file_name}</h2></div><div className="admin-counts"><span>{preview.total_rows} rows</span><span>{preview.valid_rows} valid</span><span className={preview.invalid_rows?"has-errors":""}>{preview.invalid_rows} errors</span><span>{preview.duplicate_rows} duplicates</span></div></div>
      <div className="admin-sheet-grid">{preview.sheets.map((sheet)=><article key={sheet.name}><strong>{sheet.name}</strong><small>{sheet.rowCount} records</small><p>Recognised: {sheet.recognized.join(", ")||"none"}</p>{sheet.missing.length>0&&<p className="admin-error">Missing: {sheet.missing.join(", ")}</p>}{sheet.unknown.length>0&&<p className="admin-warning">Unrecognised columns (retained in preview): {sheet.unknown.join(", ")}</p>}</article>)}</div>
      <div className="admin-confirm-row"><p>Review the workbook and row counts before committing. Workbooks with errors or duplicate rows cannot be imported.</p><button className="glow-button" type="button" disabled={busy||preview.invalid_rows>0||preview.duplicate_rows>0||preview.status!=="preview"} onClick={commit}>Confirm and import</button></div>
    </section>}
    <section className="admin-panel"><div className="admin-panel-heading"><div><p className="eyebrow">AUDIT TRAIL</p><h2>Recent imports</h2></div><button type="button" onClick={()=>void loadHistory()}>Refresh</button></div><div className="admin-history">{history.length?history.map((batch)=><article key={batch.id}><div><strong>{batch.workbook}</strong><small>{batch.file_name} · {new Date(batch.created_at).toLocaleString()}</small></div><span>{batch.imported_rows}/{batch.total_rows} rows · {batch.status}</span>{batch.status==="committed"&&<a href={`/api/v1/admin/export/${encodeURIComponent(batch.workbook)}`}>Export current workbook</a>}</article>):<p>No import activity yet.</p>}</div></section>
  </main>;
}
