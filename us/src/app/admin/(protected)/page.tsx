import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/staff";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const { role } = await requireStaff(["admin","super_admin","sales_admin","repair_admin","catalogue_manager","inventory_manager","location_manager","support_agent","inspector"]);
  const db = createSupabaseServerClient();
  const [requests, open, customers, inventory, recent] = await Promise.all([
    db.from("service_requests").select("id", { count: "exact", head: true }),
    db.from("service_requests").select("id", { count: "exact", head: true }).not("status", "in", "(completed,cancelled,rejected)"),
    db.from("customers").select("id", { count: "exact", head: true }),
    db.from("resale_inventory").select("id", { count: "exact", head: true }).eq("listing_status", "available").gt("stock_quantity", 0),
    db.from("service_requests").select("id,request_code,request_type,status,created_at,customer:customers!inner(full_name)").order("created_at", { ascending: false }).limit(7),
  ]);
  const failures = [requests.error, open.error, customers.error, inventory.error, recent.error].filter(Boolean);
  const recentRows = recent.data ?? [];
  return <main className="admin-dashboard">
    <header className="admin-dashboard-heading"><div><p className="eyebrow">OPERATIONS OVERVIEW</p><h1>Good to have you back.</h1><p>Today’s customer activity and inventory at a glance.</p></div><span className="admin-badge">{role.replaceAll("_", " ")}</span></header>
    {failures.length > 0 && <p className="admin-feedback error">Some totals are unavailable. Apply the latest database migration to enable the complete Phase 3 dashboard.</p>}
    <section className="admin-stat-grid" aria-label="Platform summary">
      <article className="admin-stat-card"><small>Total requests</small><strong>{requests.count ?? "—"}</strong><span>Website and connected channels</span></article>
      <article className="admin-stat-card"><small>Needs attention</small><strong>{open.count ?? "—"}</strong><span>Requests not yet closed</span></article>
      <article className="admin-stat-card"><small>Customers</small><strong>{customers.count ?? "—"}</strong><span>Shared customer records</span></article>
      <article className="admin-stat-card"><small>Available stock</small><strong>{inventory.count ?? "—"}</strong><span>Live inventory rows</span></article>
    </section>
    <div className="admin-dashboard-grid">
      <section className="admin-dashboard-panel"><header><h2>Latest requests</h2><Link href="/admin/requests">View request directory</Link></header>
        {recentRows.length ? <div className="admin-recent-requests">{recentRows.map((row)=>{const customer=row.customer as {full_name:string}|{full_name:string}[];const person=Array.isArray(customer)?customer[0]:customer;return <Link key={row.id} href={`/admin/requests?q=${row.request_code}`}><strong>{row.request_code}</strong><span>{person?.full_name||"Customer"}</span><small>{row.request_type} · {row.status.replaceAll("_"," ")}</small></Link>;})}</div> : <p className="admin-empty">{failures.length?"Request data will appear after the Phase 3 migration is applied.":"No customer requests yet."}</p>}
      </section>
      <section className="admin-dashboard-panel"><header><h2>Daily tools</h2><Link href="/admin/imports">Open data tools</Link></header><div className="admin-shortcuts">{[["Review requests","/admin/requests"],["Look up a customer","/admin/customers"],["Manage locations","/admin/locations"],["Manage providers","/admin/providers"],["Review pricing","/admin/pricing"],["Import a workbook","/admin/imports"]].map(([label,href])=><Link href={href} key={href}>{label}</Link>)}</div></section>
    </div>
  </main>;
}
