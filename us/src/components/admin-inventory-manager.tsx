"use client";

import { useCallback, useEffect, useState } from "react";

type ModelInfo = { name: string; brand: { name: string } };
type Item = {
  id: string; inventory_sku: string; device_code: string; condition_grade: string;
  battery_health_pct: number | null; stock_quantity: number; selling_price_inr: number | null;
  calculated_selling_price_inr: number | null; approved_price_override_inr: number | null;
  override_reason: string | null; warranty_days: number | null; city: string | null; listing_status: string;
  device: { model: ModelInfo } | Array<{ model: ModelInfo }>;
};
type RowEdit = { quantity: string; status: string; price: string; reason: string };

export function AdminInventoryManager() {
  const [rows, setRows] = useState<Item[]>([]);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [edit, setEdit] = useState<Record<string, RowEdit>>({});

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch(`/api/v1/admin/inventory?q=${encodeURIComponent(query)}`, { cache: "no-store" });
      const body = await response.json() as { data?: Item[]; error?: string };
      if (!response.ok) throw new Error(body.error || "Could not load stock.");
      const data = body.data ?? [];
      setRows(data);
      setEdit(Object.fromEntries(data.map((item) => [item.id, {
        quantity: String(item.stock_quantity), status: item.listing_status,
        price: item.approved_price_override_inr == null ? "" : String(item.approved_price_override_inr),
        reason: item.override_reason ?? "",
      }])));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load stock."); }
  }, [query]);

  useEffect(() => { void load(); }, [load]);

  async function save(item: Item) {
    const values = edit[item.id];
    setBusy(item.id); setError("");
    try {
      const response = await fetch("/api/v1/admin/inventory", {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: item.id, quantity: values.quantity, listingStatus: values.status, overridePrice: values.price === "" ? null : values.price, overrideReason: values.reason }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Update failed.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Update failed."); }
    finally { setBusy(""); }
  }

  return <section className="admin-section">
    <header className="admin-page-heading"><div><span className="admin-eyebrow">PHYSICAL STOCK CONTROL</span><h1>Refurbished inventory</h1><p>Track verified physical stock, listing availability, and approved price overrides.</p></div></header>
    <form className="admin-toolbar" onSubmit={(event) => { event.preventDefault(); setQuery(queryInput.trim()); }}>
      <label className="admin-search">Search SKU or device code<input value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Inventory SKU / 7-digit device code" /></label>
      <button className="admin-button admin-button-primary">Search</button>
    </form>
    {error && <p className="admin-alert" role="alert">{error}</p>}
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Device</th><th>SKU / code</th><th>Condition</th><th>Physical stock</th><th>Price</th><th>Listing</th><th>Save</th></tr></thead>
      <tbody>{rows.map((item) => {
        const device = Array.isArray(item.device) ? item.device[0] : item.device;
        const value = edit[item.id] ?? { quantity: String(item.stock_quantity), status: item.listing_status, price: "", reason: "" };
        return <tr key={item.id}>
          <td><strong>{device?.model?.brand?.name} {device?.model?.name}</strong><small>{item.city || "Location not set"} · warranty {item.warranty_days ?? "—"} days</small></td>
          <td>{item.inventory_sku}<small>{item.device_code}</small></td>
          <td>{item.condition_grade}<small>{item.battery_health_pct == null ? "Battery not recorded" : `${item.battery_health_pct}% battery`}</small></td>
          <td><input className="admin-cell-input" type="number" min="0" value={value.quantity} onChange={(event) => setEdit((current) => ({ ...current, [item.id]: { ...value, quantity: event.target.value } }))} /></td>
          <td><strong>{item.approved_price_override_inr != null ? `₹${item.approved_price_override_inr.toLocaleString("en-IN")} override` : item.calculated_selling_price_inr != null ? `₹${item.calculated_selling_price_inr.toLocaleString("en-IN")} calculated` : item.selling_price_inr != null ? `₹${item.selling_price_inr.toLocaleString("en-IN")}` : "Price on request"}</strong><details><summary>Override</summary><input className="admin-cell-input" type="number" min="0" placeholder="Approved price" value={value.price} onChange={(event) => setEdit((current) => ({ ...current, [item.id]: { ...value, price: event.target.value } }))} /><input className="admin-cell-input" placeholder="Reason required" value={value.reason} onChange={(event) => setEdit((current) => ({ ...current, [item.id]: { ...value, reason: event.target.value } }))} /></details></td>
          <td><select className="admin-cell-input" value={value.status} onChange={(event) => setEdit((current) => ({ ...current, [item.id]: { ...value, status: event.target.value } }))}>{["draft", "available", "reserved", "sold", "withdrawn"].map((status) => <option key={status} value={status}>{status}</option>)}</select></td>
          <td><button className="admin-button admin-button-subtle" disabled={busy === item.id} onClick={() => void save(item)}>{busy === item.id ? "Saving…" : "Save"}</button></td>
        </tr>;
      })}
      {rows.length === 0 && <tr><td colSpan={7} className="admin-empty">No physical stock records found. Inventory is created from verified workbook rows or by an authorized stock intake workflow.</td></tr>}</tbody>
    </table></div>
    <p className="admin-footnote">Pricing setup sheets do not create stock. Only physical inventory records with quantity above zero can appear in the catalogue.</p>
  </section>;
}
