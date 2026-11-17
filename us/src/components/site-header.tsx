"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { brandSettings } from "@/lib/brand-settings";
import { CustomerAuthButton } from "@/components/customer-auth";

export function SiteHeader() {
  const [catalogueOpen, setCatalogueOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!catalogueOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) setCatalogueOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [catalogueOpen]);

  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label={`${brandSettings.name} home`}><span className="brand-mark">{brandSettings.mark}</span><span>{brandSettings.name}</span></Link>
      <nav className="main-nav" aria-label="Main navigation">
        <Link href="/">Home</Link>
        <div className="nav-dropdown" ref={dropdownRef} onKeyDown={(event) => { if (event.key === "Escape") setCatalogueOpen(false); }}>
          <button className="nav-dropdown-trigger" type="button" aria-expanded={catalogueOpen} aria-haspopup="true" onClick={() => setCatalogueOpen((open) => !open)}>
            Our services
          </button>
          {catalogueOpen && <div className="dropdown-menu" role="menu">
            <Link href="/buy" role="menuitem" onClick={() => setCatalogueOpen(false)}>Buy</Link>
            <Link href="/repair" role="menuitem" onClick={() => setCatalogueOpen(false)}>Repair</Link>
            <Link href="/sell" role="menuitem" onClick={() => setCatalogueOpen(false)}>Sell a device</Link>
            <Link href="/nearest-service" role="menuitem" onClick={() => setCatalogueOpen(false)}>Nearest service</Link>
          </div>}
        </div>
        <Link href="/about">About</Link>
      </nav>
      <div className="header-actions"><Link className="nav-quick-link" href="/doorstep-service">Doorstep service</Link><CustomerAuthButton /></div>
    </header>
  );
}
