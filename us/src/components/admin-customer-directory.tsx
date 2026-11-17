"use client";

import { useCallback, useEffect, useState } from "react";

type Customer = { id: string; full_name: string | null; mobile: string; email: string | null; city: string | null; pin_code: string | null; created_at: string; last_login_at: string | null; auth_user_id: string | null; account_status: "active" | "blocked" | "deleted"; requestCount: number };
type Result = { data?: Customer[]; count?: number; error?: string };

export function AdminCustomerDirectory() {
  const [rows, setRows] = useState<Customer[]>([]);
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState("");
  const [page, setPage] = useState(0);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const response = await fetch(`/api/v1/admin/customers?q=${encodeURIComponent(applied)}&page=${page}`, { cache: "no-store" }); const result = await response.json() as Result; if (!response.ok) throw new Error(result.error || "Could not load customers."); setRows(result.data ?? []); setCount(result.count ?? 0); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load customers."); }
    finally { setLoading(false); }
  }, [applied, page]);
  useEffect(() => { void load(); }, [load]);
  async function toggle(customer: Customer) {
    setBusyId(customer.id); setError("");
    try { const response = await fetch("/api/v1/admin/customers", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: customer.id, accountStatus: customer.account_status === "blocked" ? "active" : "blocked" }) }); const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error || "Could not update account."); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update account."); }
    finally { setBusyId(""); }
  }
  return <section className="admin-section"><header className="admin-page-heading"><div><span className="admin-eyebrow">CUSTOMER OPERATIONS</span><h1>Customers</h1><p>Verified customer records and their service history.</p></div><div className="admin-count"><strong>{count.toLocaleString()}</strong><span>customer records</span></div></header>
    <form className="admin-toolbar" onSubmit={(event) => { event.preventDefault(); setPage(0); setApplied(q.trim()); }}><label className="admin-search">Search by name, phone, or email<input value={q} onChange={(event) => setQ(event.target.value)} placeholder="e.g. +91… or name@example.com" /></label><button className="admin-button admin-button-primary">Search</button></form>
    {error && <p role="alert" className="admin-alert">{error}</p>}
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Customer</th><th>Phone</th><th>Location</th><th>Requests</th><th>Joined</th><th>Account</th><th></th></tr></thead><tbody>{rows.map((customer) => <tr key={customer.id}><td><strong>{customer.full_name || "Name not provided"}</strong><small>{customer.email || "Email not provided"}</small></td><td>{customer.mobile}<small>{customer.auth_user_id ? "Google account linked" : "Account not linked"}</small></td><td>{[customer.city, customer.pin_code].filter(Boolean).join(" · ") || "—"}</td><td>{customer.requestCount}</td><td>{new Date(customer.created_at).toLocaleDateString()}</td><td><span className={`admin-status ${customer.account_status}`}>{customer.account_status}</span></td><td>{customer.account_status !== "deleted" && <button className="admin-button admin-button-subtle" disabled={busyId === customer.id} onClick={() => void toggle(customer)}>{busyId === customer.id ? "Saving…" : customer.account_status === "blocked" ? "Restore" : "Block"}</button>}</td></tr>)}{!loading && rows.length === 0 && <tr><td colSpan={7} className="admin-empty">No customers found.</td></tr>}{loading && <tr><td colSpan={7} className="admin-empty">Loading customer records…</td></tr>}</tbody></table></div>
    <footer className="admin-pagination"><span>Showing {rows.length ? page * 25 + 1 : 0}–{Math.min((page + 1) * 25, count)} of {count}</span><div><button className="admin-button admin-button-subtle" disabled={page === 0 || loading} onClick={() => setPage((value) => value - 1)}>Previous</button><button className="admin-button admin-button-subtle" disabled={(page + 1) * 25 >= count || loading} onClick={() => setPage((value) => value + 1)}>Next</button></div></footer>
  </section>;
}
