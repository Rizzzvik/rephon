import Link from "next/link";
import { brandSettings } from "@/lib/brand-settings";
import { WhatsAppLink } from "@/components/whatsapp-link";

const columns = [
  { title: "Services", links: [{ label: "Browse devices", href: "/catalogue" }, { label: "Buy renewed", href: "/buy" }, { label: "Book a repair", href: "/repair" }, { label: "Sell your device", href: "/sell" }, { label: "Doorstep service", href: "/doorstep-service" }, { label: "Nearest service", href: "/nearest-service" }] },
  { title: "Company", links: [{ label: `About ${brandSettings.name}`, href: "/about" }] },
  { title: "Support", links: [{ label: "Track a request", href: "/track-request" }] },
];

export function SiteFooter() {
  return (
    <footer className="global-footer">
      <div className="global-footer-inner">
        <section className="footer-about" aria-labelledby="footer-brand">
          <Link className="footer-brand" href="/" id="footer-brand"><span className="footer-brand-mark">{brandSettings.mark}</span><span>{brandSettings.name}</span></Link>
          <p>Better tech, with a little more life.</p>
          <div className="footer-location"><strong>Here to help</strong><span>Device care, repairs, and renewed tech in one place.</span><a href={`tel:${brandSettings.supportPhone.replace(/[^+\d]/g, "")}`}>{brandSettings.supportPhone}</a><WhatsAppLink label="Chat on WhatsApp" message="Hi REPHON 24X7, I’d like help with your services." /></div>
        </section>
        {columns.map((column) => <nav className="footer-column" aria-label={column.title} key={column.title}>
          <h2>{column.title}</h2>
          {column.links.map((link) => <Link href={link.href} key={link.label}>{link.label}</Link>)}
        </nav>)}
      </div>
      <div className="footer-bottom"><span>© 2026 {brandSettings.name}. All rights reserved.</span><span>Made for a longer life with tech.</span></div>
    </footer>
  );
}

