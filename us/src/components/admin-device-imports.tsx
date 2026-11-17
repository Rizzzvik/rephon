"use client";

import { useCallback, useEffect, useState } from "react";

type Brand = { id: string; brand_code: string; name: string; slug: string };
type Candidate = { name: string; slug: string; imageUrl?: string };
type PendingModel = { id: string; name: string; model_code: string | null; brand_id: string; brand: { name: string; brand_code: string } | { name: string; brand_code: string }[] };

export function AdminDeviceImports() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [pending, setPending] = useState<PendingModel[]>([]);
  const [results, setResults] = useState<Candidate[]>([]);
  const [query, setQuery] = useState("");
  const [brandId, setBrandId] = useState("");
  const [sourceApproved, setSourceApproved] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/admin/device-imports", { cache: "no-store" });
      const body = await response.json() as { brands?: Brand[]; pending?: PendingModel[]; sourceApproved?: boolean; error?: string };
      if (!response.ok) throw new Error(body.error || "Could not load device imports.");
      setBrands(body.brands ?? []); setPending(body.pending ?? []); setSourceApproved(body.sourceApproved ?? false);
      if (!brandId && body.brands?.[0]) setBrandId(body.brands[0].id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load device imports."); }
  }, [brandId]);
  useEffect(() => { void load(); }, [load]);

  async function search(event: React.FormEvent) {
    event.preventDefault(); setError(""); setNotice(""); setBusy("search");
    try {
      const response = await fetch(`/api/v1/admin/device-imports?q=${encodeURIComponent(query.trim())}`, { cache: "no-store" });
      const body = await response.json() as { data?: Candidate[]; error?: string };
      if (!response.ok) throw new Error(body.error || "External search failed.");
      setResults(body.data ?? []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "External search failed."); }
    finally { setBusy(""); }
  }

  async function importCandidate(candidate: Candidate) {
    setError(""); setNotice(""); setBusy(candidate.slug);
    try {
      const response = await fetch("/api/v1/admin/device-imports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ brandId, name: candidate.name, slug: candidate.slug }) });
      const body = await response.json() as { data?: { modelCode: string | null; matched: boolean; specificationCount: number }; error?: string };
      if (!response.ok) throw new Error(body.error || "Import failed.");
      setNotice(`${candidate.name} imported for review${body.data?.modelCode ? ` · model code ${body.data.modelCode}` : ""}. ${body.data?.specificationCount ?? 0} supported specification fields were queued.`);
      setResults((rows) => rows.filter((row) => row.slug !== candidate.slug));
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Import failed."); }
    finally { setBusy(""); }
  }

  async function review(modelId: string, decision: "approve" | "reject") {
    setError(""); setBusy(modelId);
    try {
      const response = await fetch("/api/v1/admin/device-imports", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ modelId, decision }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Review failed.");
      setNotice(decision === "approve" ? "Model and pending specifications approved. Add verified variants before enabling customer transactions." : "Model rejected and kept inactive.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Review failed."); }
    finally { setBusy(""); }
  }

  return <section className="admin-section">
    <header className="admin-page-heading"><div><span className="admin-eyebrow">DEVICE MASTER</span><h1>External device imports</h1><p>Search the connected source, match a universal brand and queue records for human review.</p></div></header>
    <p className="admin-footnote">{sourceApproved ? "Source is approved and enabled. Imported records remain pending review." : "External source is disabled. Review commercial and upstream terms, then approve and enable it in the source registry before search."} Import does not create device variants, prices, stock, or image permissions.</p>
    <form className="admin-toolbar" onSubmit={(event) => void search(event)}>
      <label className="admin-search">Universal brand<select value={brandId} onChange={(event) => setBrandId(event.target.value)}>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.brand_code} · {brand.name}</option>)}</select></label>
      <label className="admin-search">Search external device<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. iPhone 16 Pro" /></label>
      <button className="admin-button admin-button-primary" disabled={busy === "search" || query.trim().length < 2}>{busy === "search" ? "Searching…" : "Search source"}</button>
    </form>
    {error && <p className="admin-alert" role="alert">{error}</p>}{notice && <p className="admin-feedback" role="status">{notice}</p>}
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Search result</th><th>External slug</th><th>Action</th></tr></thead><tbody>{results.map((item) => <tr key={item.slug}><td><strong>{item.name}</strong></td><td>{item.slug}</td><td><button className="admin-button admin-button-subtle" disabled={!brandId || Boolean(busy)} onClick={() => void importCandidate(item)}>{busy === item.slug ? "Importing…" : "Import for review"}</button></td></tr>)}{!results.length && <tr><td colSpan={3} className="admin-empty">Search results appear here after the source has been configured and approved.</td></tr>}</tbody></table></div>
    <header className="admin-page-heading"><div><span className="admin-eyebrow">PENDING VERIFICATION</span><h2>Models awaiting review</h2><p>Review the model identity and source specifications before activating a model.</p></div></header>
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Master model</th><th>Model code</th><th>Review</th></tr></thead><tbody>{pending.map((model) => { const brand = Array.isArray(model.brand) ? model.brand[0] : model.brand; return <tr key={model.id}><td><strong>{brand?.name} {model.name}</strong></td><td>{brand?.brand_code} · {model.model_code ?? "Code unavailable"}</td><td><button className="admin-button admin-button-primary" disabled={Boolean(busy)} onClick={() => void review(model.id, "approve")}>Approve</button> <button className="admin-button admin-button-subtle" disabled={Boolean(busy)} onClick={() => void review(model.id, "reject")}>Reject</button></td></tr>; })}{!pending.length && <tr><td colSpan={3} className="admin-empty">No imported models are awaiting review.</td></tr>}</tbody></table></div>
  </section>;
}
