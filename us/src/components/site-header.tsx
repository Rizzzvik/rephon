"use client";

import Link from "next/link";
import { brandSettings } from "@/lib/brand-settings";
import { CustomerAuthButton } from "@/components/customer-auth";

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label={`${brandSettings.name} home`}><span className="brand-mark">{brandSettings.mark}</span><span>{brandSettings.name}</span></Link>
      <nav className="main-nav" aria-label="Main navigation">
        <Link href="/">Home</Link>
        <Link href="/buy">Buy</Link>
        <Link href="/repair">Repair</Link>
        <Link href="/sell">Sell</Link>
        <Link href="/nearest-service">Nearest service</Link>
        <Link href="/about">About</Link>
      </nav>
      <div className="header-actions"><Link className="nav-quick-link" href="/doorstep-service">Doorstep service</Link><CustomerAuthButton /></div>
    </header>
  );
}
