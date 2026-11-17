import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { brandSettings } from "@/lib/brand-settings";
import "./globals.css";

export const metadata: Metadata = {
  title: `${brandSettings.name} — Phones, repaired and reimagined`,
  description: brandSettings.description,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><SiteHeader />{children}<SiteFooter /></body></html>;
}
