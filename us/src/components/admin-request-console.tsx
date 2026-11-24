"use client";

import { FormEvent, useEffect, useState } from "react";
import { AdminRequestCommercialActions } from "@/components/admin-request-commercial-actions";

type Contact = { full_name: string; mobile: string; email: string | null; city: string | null; pin_code: string };
type RequestRow = {
  id: string;
  reference: string;
  request_source: string;
  journey: "buy" | "sell" | "repair" | "doorstep" | "callback";
  status: string;
  created_at: string;
  device_code: string | null;
  customers: Contact | Contact[];
  original_answers: Record<string, unknown>;
  customer_statement?: string | null;
  sell_requests: Array<{ id: string; indicative_offer_inr: number | null; final_offer_inr: number | null; buyback_inspections?: Array<{ id: string; final_grade: string; inspected_at: string }> }>;
  repair_requests: Array<{ id: string; issue_codes: string[]; quote_required: boolean }>;
  buy_enquiries: Array<{ id: string }>;
  status_history?: Array<{ previous_status: string | null; new_status: string; created_at: string }>;
  internal_notes?: Array<{ note: string; created_at: string; is_internal: boolean }>;
  assignments?: Array<{ staff_user_id: string | null; provider_code: string | null }>;
  whatsapp_messages?: Array<{ direction: string; message_type: string; message_text: string | null; delivery_status: string; created_at: string }>;
  doorstep_booking?: { service_type: string; address: string; area: string | null; city: string; pin_code: string | null; landmark: string | null; preferred_date: string; preferred_time_slot: string; booking_status: string; provider_code: string | null } | null;
};
type ProviderOption = { provider_code: string; business_name: string; city: string | null; area: string | null };
type ConditionGrade = { grade_code: string; grade_name: string };

const person = (value: RequestRow["customers"]) => Array.isArray(value) ? value[0] : value;
const filters = [["all", "All requests"], ["buy", "Buy"], ["sell", "Sell"], ["repair", "Repair"], ["doorstep", "Doorstep"], ["whatsapp", "WhatsApp"]] as const;
const statuses = ["", "initiated", "otp_verified", "submitted", "under_review", "contacted", "quotation_sent", "awaiting_customer", "confirmed", "assigned", "in_progress", "completed", "cancelled", "rejected"];

export function AdminRequestConsole() {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [status, setStatus] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [draftStatus, setDraftStatus] = useState<Record<string,string>>({});
  const [draftNote, setDraftNote] = useState<Record<string,string>>({});
  const [savingId, setSavingId] = useState("");
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [draftProvider, setDraftProvider] = useState<Record<string,string>>({});
  const [conditionGrades, setConditionGrades] = useState<ConditionGrade[]>([]);

  async function updateRequest(row: RequestRow) {
    setSavingId(row.id); setError("");
    try {
      const response = await fetch("/api/v1/admin/requests", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: row.id, status: draftStatus[row.id] || row.status, note: draftNote[row.id] || "", providerCode: draftProvider[row.id] || undefined }) });
      const result = await response.json() as { data?: { status: string }; error?: string };
      if (!response.ok || !result.data) throw new Error(result.error || "Unable to update the request.");
      setRows((current) => current.map((item) => item.id === row.id ? { ...item, status: result.data!.status } : item));
      setDraftNote((current) => ({ ...current, [row.id]: "" }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update the request."); }
    finally { setSavingId(""); }
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (filter === "whatsapp") params.set("source", "whatsapp");
    else if (filter !== "all") params.set("journey", filter);
    if (status) params.set("status", status);
    if (search) params.set("q", search);
    const suffix = params.size ? `?${params.toString()}` : "";
    fetch(`/api/v1/admin/requests${suffix}`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as { data?: RequestRow[]; providers?: ProviderOption[]; conditionGrades?: ConditionGrade[]; error?: string };
        if (!response.ok) throw new Error(body.error || "Unable to load requests");
        if (active) { setRows(body.data ?? []); setProviders(body.providers ?? []); setConditionGrades(body.conditionGrades ?? []); }
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Unable to load requests"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filter, search, status]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = searchInput.trim();
    if (!value) { setSearch(""); return; }
    setSearch(value);
  }

  return <section className="admin-request-shell">
    <header className="admin-request-heading"><div><p className="eyebrow">STAFF WORKSPACE</p><h1>Customer requests</h1><p>Review requests from the website and other connected channels.</p></div><nav><a href="/admin/imports">Imports</a><a href="/admin/images">Images</a></nav></header>
    <form className="admin-request-search" onSubmit={submitSearch} role="search"><label className="sr-only" htmlFor="request-search">Search requests</label><input id="request-search" maxLength={100} placeholder="Request ID, customer, phone, email, model, or device code" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /><button type="submit">Search</button>{search && <button type="button" onClick={() => { setSearchInput(""); setSearch(""); }}>Clear</button>}</form>
    <nav className="admin-request-tabs" aria-label="Filter requests">{filters.map(([key, label]) => <button key={key} type="button" className={filter === key ? "active" : ""} onClick={() => setFilter(key)}>{label}</button>)}</nav>
    <label className="admin-request-status">Filter by status<select value={status} onChange={(event) => setStatus(event.target.value)}>{statuses.map((value) => <option key={value} value={value}>{value ? value.replaceAll("_", " ") : "All statuses"}</option>)}</select></label>
    {error && <p className="admin-request-message error" role="alert">{error}</p>}
    {loading ? <p className="admin-request-message">Loading requests…</p> : !error && rows.length === 0 ? <p className="admin-request-message">No customer requests match these filters.</p> : <div className="admin-request-list">{rows.map((row) => {
      const customer = person(row.customers);
      const sell = row.sell_requests?.[0];
      const repair = row.repair_requests?.[0];
      const summary = Object.entries(row.original_answers ?? {}).filter(([key]) => !["fullName", "mobile", "email", "pinCode", "address", "street", "landmark", "city", "photos", "media"].includes(key)).slice(0, 8);
      return <article className="admin-request-card" key={row.id}><div className="admin-request-card-head"><span className={`request-type ${row.journey}`}>{row.journey}</span><strong>{row.reference}</strong><span>Source: {row.request_source}</span><time>{new Date(row.created_at).toLocaleString("en-IN")}</time></div><div className="admin-request-details"><div><small>Customer</small><strong>{customer.full_name}</strong><a href={`tel:${customer.mobile}`}>{customer.mobile}</a><span>{[customer.city, customer.pin_code].filter(Boolean).join(" · ")}</span></div><div><small>Request</small><strong>{row.device_code ? `Device ${row.device_code}` : "Device needs confirmation"}</strong><span>Status: {row.status.replaceAll("_", " ")}</span>{sell && <span>{sell.final_offer_inr !== null ? `Final offer ₹${sell.final_offer_inr.toLocaleString("en-IN")}` : sell.indicative_offer_inr !== null ? `Indicative ₹${sell.indicative_offer_inr.toLocaleString("en-IN")}` : "Manual valuation required"}</span>}{repair && <span>{repair.issue_codes.join(", ") || "Repair issue needs manual review"}</span>}</div>{row.doorstep_booking&&<div><small>Doorstep visit</small><strong>{row.doorstep_booking.service_type}</strong><span>{[row.doorstep_booking.address,row.doorstep_booking.area,row.doorstep_booking.city,row.doorstep_booking.pin_code].filter(Boolean).join(", ")}</span><span>{row.doorstep_booking.preferred_date} · {row.doorstep_booking.preferred_time_slot}</span><span>Booking: {row.doorstep_booking.booking_status.replaceAll("_"," ")}</span></div>}</div>{row.customer_statement&&<details className="admin-request-statement"><summary>Customer statement</summary><pre>{row.customer_statement}</pre></details>}{sell||repair?<AdminRequestCommercialActions sellId={sell?.id} repairId={repair?.id} finalOffer={sell?.final_offer_inr} inspected={Boolean(sell?.buyback_inspections?.length)} grades={conditionGrades}/>:null}{summary.length > 0 && <details className="admin-request-answers"><summary>Questionnaire answers</summary><dl>{summary.map(([key, value]) => <div key={key}><dt>{key.replaceAll(/([A-Z])/g, " $1")}</dt><dd>{Array.isArray(value) ? value.map((item) => typeof item === "string" ? item : JSON.stringify(item)).join(", ") : typeof value === "object" && value !== null ? JSON.stringify(value) : String(value ?? "—")}</dd></div>)}</dl></details>}{(row.status_history?.length||row.internal_notes?.length||row.whatsapp_messages?.length)&&<details className="admin-request-answers"><summary>Activity, notes &amp; conversation ({(row.status_history?.length??0)+(row.internal_notes?.length??0)+(row.whatsapp_messages?.length??0)})</summary>{row.status_history?.map((item,index)=><p key={`history-${index}`}><strong>Status: {item.new_status.replaceAll("_"," ")}</strong> · {new Date(item.created_at).toLocaleString("en-IN")}</p>)}{row.internal_notes?.map((item,index)=><p key={`note-${index}`}><strong>Staff note</strong> · {item.note} <small>{new Date(item.created_at).toLocaleString("en-IN")}</small></p>)}{row.whatsapp_messages?.map((item,index)=><p key={`message-${index}`}><strong>WhatsApp {item.direction}</strong> · {item.message_text||`[${item.message_type} message]`} <small>{new Date(item.created_at).toLocaleString("en-IN")}</small></p>)}</details>}<div className="admin-request-update"><label>Update status<select value={draftStatus[row.id] ?? row.status} onChange={(event)=>setDraftStatus((current)=>({...current,[row.id]:event.target.value}))}>{statuses.filter(Boolean).map((value)=><option key={value} value={value}>{value.replaceAll("_"," ")}</option>)}</select></label><label>Assign service provider<select value={draftProvider[row.id] ?? row.assignments?.[0]?.provider_code ?? ""} onChange={(event)=>setDraftProvider((current)=>({...current,[row.id]:event.target.value}))}><option value="">No change</option>{providers.map(provider=><option key={provider.provider_code} value={provider.provider_code}>{provider.business_name}{provider.area||provider.city?` · ${[provider.area,provider.city].filter(Boolean).join(", ")}`:""}</option>)}</select></label><label>Internal note<textarea rows={2} maxLength={5000} placeholder="Optional staff-only note" value={draftNote[row.id]??""} onChange={(event)=>setDraftNote((current)=>({...current,[row.id]:event.target.value}))}/></label><button type="button" disabled={savingId===row.id} onClick={()=>void updateRequest(row)}>{savingId===row.id?"Saving…":"Save update"}</button></div></article>;
    })}</div>}
  </section>;
}
