"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const links = [
  ["Overview", "/admin"], ["Requests", "/admin/requests"], ["WhatsApp inbox", "/admin/whatsapp"], ["Customers", "/admin/customers"],
  ["Locations", "/admin/locations"], ["Providers", "/admin/providers"], ["Device master", "/admin/catalogue"],
  ["Pricing", "/admin/pricing"], ["Inventory", "/admin/inventory"], ["Accessories", "/admin/accessories"],
  ["Device API imports", "/admin/device-imports"], ["Imports & exports", "/admin/imports"], ["Image library", "/admin/images"], ["Website content", "/admin/content"], ["Admin users", "/admin/users"],
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/admin/login") return <>{children}</>;
  const signOut = async () => { await createSupabaseBrowserClient().auth.signOut(); window.location.assign("/admin/login"); };
  return <div className="admin-shell"><aside className="admin-sidebar"><Link className="admin-brand" href="/admin"><span>R</span><b>REPHON 24X7<small>CONTROL PANEL</small></b></Link><nav aria-label="Admin control panel">{links.map(([label, href])=><Link key={href} href={href} className={pathname===href||href!=="/admin"&&pathname.startsWith(`${href}/`)?"active":""}>{label}</Link>)}</nav><div className="admin-sidebar-foot"><span>Protected workspace</span><Link href="/">Open customer site</Link><button type="button" onClick={()=>void signOut()}>Sign out</button></div></aside><div className="admin-main">{children}</div></div>;
}
