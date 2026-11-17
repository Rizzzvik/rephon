import Link from "next/link";
import { WhatsAppLink } from "@/components/whatsapp-link";
import { DoorstepRequestForm } from "@/components/doorstep-request-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { aboutContentDefaults, type AboutContent } from "@/lib/content/about";

const serviceCards = [
  { index: "01", title: "Repair", text: "Get help diagnosing a phone issue and choosing a service option.", href: "/repair", label: "Explore repair" },
  { index: "02", title: "Sell", text: "Share your phone details and request a condition review.", href: "/sell", label: "Start a trade-in" },
  { index: "03", title: "Buy renewed", text: "Tell us what you’re looking for and check current availability.", href: "/buy", label: "Find a device" },
];

async function getAboutContent() {
  try {
    const { data } = await createSupabaseServerClient().from("site_content").select("content").eq("content_key", "about").maybeSingle();
    return { ...aboutContentDefaults, ...(data?.content as Partial<AboutContent> | undefined) };
  } catch { return aboutContentDefaults; }
}

export async function AboutUsPage() {
  const content = await getAboutContent();
  return <main className="brand-page">
    <section className="about-editorial">
      <div className="about-editorial-top"><span>REPHON 24X7</span><span>DEVICE CARE · RESALE · RENEWED</span></div>
      <div className="about-editorial-grid">
        <div className="about-editorial-copy"><p className="eyebrow">A better way to care for your tech</p><h1>ABOUT<br /><span>REPHON 24X7.</span></h1><p className="about-lede">{content.lede}</p><p className="about-description">{content.description}</p><Link className="glow-button brand-cta" href="/catalogue">Explore our services</Link></div>
        <div className="about-editorial-art" aria-label="Illustration of phone, tablet and laptop devices"><div className="about-art-orbit"/><span className="about-device about-phone"/><span className="about-device about-tablet"/><span className="about-device about-laptop"/><div className="about-philosophy"><p className="eyebrow">OUR PHILOSOPHY</p><h2>{content.philosophy}</h2><p>Clear options. Considered service. Useful tech, kept in use.</p></div></div>
      </div>
      <div className="about-editorial-bottom"><span>DEVICE CARE, MADE CLEAR</span><span>01 — 03</span></div>
    </section>

    <section className="brand-section about-intro">
      <div className="brand-section-heading"><p className="eyebrow">A more useful device journey</p><h2>{content.introHeading}</h2></div>
      <div className="brand-section-copy"><p>{content.introParagraph1}</p><p>{content.introParagraph2}</p></div>
    </section>

    <section className="brand-section brand-service-section">
      <div className="brand-section-heading"><p className="eyebrow">What we do</p><h2>Three ways forward.</h2></div>
      <div className="brand-service-grid">{serviceCards.map((item) => <article className="brand-service-card" key={item.index}><span>{item.index}</span><h3>{item.title}</h3><p>{item.text}</p><Link href={item.href}>{item.label}<b aria-hidden="true">↗</b></Link></article>)}</div>
    </section>

    <section className="brand-principles about-principles" aria-labelledby="principles-title">
      <div><p className="eyebrow">How we work</p><h2 id="principles-title">{content.promiseHeading}</h2></div>
      <div className="principle-list">
        <article><span>01</span><div><h3>Useful information first</h3><p>{content.promise1}</p></div></article>
        <article><span>02</span><div><h3>Details confirmed with you</h3><p>{content.promise2}</p></div></article>
        <article><span>03</span><div><h3>More life for good tech</h3><p>{content.promise3}</p></div></article>
      </div>
    </section>

    <section className="brand-bottom-cta"><div><p className="eyebrow">Need a hand?</p><h2>Start with what your device needs.</h2></div><WhatsAppLink label="Talk to our team" message="Hi REPHON 24X7, I’d like help choosing a device service." /></section>
  </main>;
}

export function DoorstepServicePage() {
  return <main className="brand-page">
    <section className="brand-hero doorstep-hero">
      <p className="eyebrow">Doorstep service</p>
      <h1>Device care,<br /><span>with less travel.</span></h1>
      <p>Ask our team whether doorstep repair is available for your area. We’ll confirm the service options and visit details with you before anything is booked.</p>
      <div className="brand-hero-actions"><a className="glow-button brand-cta" href="#request-doorstep">Request a visit</a><WhatsAppLink className="brand-secondary-cta" label="Ask about your area" message="Hi REPHON 24X7, can you check doorstep repair availability for my area?" /></div>
      <div className="doorstep-route" aria-label="Doorstep service steps"><span>Tell us the issue</span><i /><span>Check your area</span><i /><span>Confirm the visit</span></div>
    </section>

    <DoorstepRequestForm />

    <section className="brand-section doorstep-steps">
      <div className="brand-section-heading"><p className="eyebrow">A clear process</p><h2>Know what happens next.</h2><p>Each step is confirmed with you, so the service plan fits your device and location.</p></div>
      <div className="doorstep-step-list">
        <article><span>01</span><div><h3>Describe the problem</h3><p>Select the issue and share the phone model through the repair flow.</p></div></article>
        <article><span>02</span><div><h3>Check local coverage</h3><p>Share your PIN code or area so the team can confirm whether a visit is available.</p></div></article>
        <article><span>03</span><div><h3>Review the service details</h3><p>Timing, repair options, and any quote are discussed before a booking is confirmed.</p></div></article>
      </div>
    </section>

    <section className="doorstep-note"><span className="doorstep-note-mark" aria-hidden="true">i</span><div><h2>Coverage is confirmed by area.</h2><p>Doorstep service depends on your location and the repair required. Contact the team to check the current options.</p></div><WhatsAppLink label="Check availability" message="Hi REPHON 24X7, please check whether doorstep service is available for my PIN code or area." /></section>
  </main>;
}
