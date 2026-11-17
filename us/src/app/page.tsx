import Link from "next/link";
import { ServiceBenefits } from "@/components/service-benefits";
import { InteractiveShowcase } from "@/components/interactive-showcase";
import { CustomerReviews } from "@/components/customer-reviews";

const quickServices = [
  { title: "Buy renewed", detail: "Find a device that fits", icon: "phone", href: "/buy" },
  { title: "Sell your device", detail: "Get a condition-based valuation", icon: "sell", href: "/sell" },
  { title: "Repair a device", detail: "Choose the repair it needs", icon: "repair", href: "/repair" },
  { title: "Doorstep service", detail: "Request service at your address", icon: "trade", href: "/doorstep-service" },
  { title: "Nearest service", detail: "Find a nearby service centre", icon: "store", href: "/nearest-service" },
] as const;

function ServiceIcon({ name }: { name: (typeof quickServices)[number]["icon"] }) {
  const shapes = {
    phone: <><rect x="8" y="3" width="16" height="26" rx="3" /><path d="M13 7h6M14 25h4" /></>,
    sell: <><rect x="4" y="3" width="15" height="25" rx="3" /><path d="M10 7h4m-3 10h9m-3-4 4 4-4 4" /></>,
    repair: <><path d="M14 5a7 7 0 0 0 8 9l-12 12a3 3 0 0 1-4-4l12-12a7 7 0 0 0 9-8l-4 4-5-1-1-5z" /><path d="m8 23 2 2" /></>,
    trade: <><path d="M5 11h19m-4-4 4 4-4 4M27 21H8m4-4-4 4 4 4" /><rect x="3" y="4" width="7" height="5" rx="1" /><rect x="22" y="22" width="7" height="5" rx="1" /></>,
    store: <><path d="M4 13h24l-2-9H6zM6 13v15h20V13M11 28v-9h8v9M4 13a4 4 0 0 0 8 0 4 4 0 0 0 8 0 4 4 0 0 0 8 0" /></>,
  };
  return <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" aria-hidden="true">{shapes[name]}</svg>;
}

export default function HomePage() {
  return (
    <main>
      <InteractiveShowcase />
      <section className="quick-services" aria-labelledby="quick-services-title">
          <div className="quick-services-heading"><div><p className="eyebrow">Your next move</p><h2 id="quick-services-title">Explore our services.</h2></div><p>Everything your devices need, in one place.</p></div>
          <div className="quick-service-grid">{quickServices.map((service) => <Link className="quick-service-card" href={service.href} key={service.title}>
            <span className="quick-service-art"><ServiceIcon name={service.icon} /></span><span className="quick-service-copy"><strong>{service.title}</strong><small>{service.detail}</small></span>
          </Link>)}</div>
      </section>
      <ServiceBenefits />
      <CustomerReviews />
    </main>
  );
}
