import { WhatsAppLink } from "@/components/whatsapp-link";
import Image from "next/image";

export function InteractiveShowcase() {
  return (
    <section className="interactive-showcase" aria-label="Explore REPHON 24X7 devices">
      <article className="showcase-device showcase-tablet" aria-label="Apple tablet">
        <div className="product-render tablet-render"><Image className="product-photo" src="/devices/tablet.png" width={1086} height={1448} alt="" priority /><a className="device-action device-action-light" href="/catalogue">Browse catalogue</a></div>
      </article>
      <article className="showcase-device showcase-laptop" aria-label="Apple laptop">
        <div className="product-render laptop-render"><Image className="product-photo" src="/devices/laptop.png" width={1568} height={1003} alt="" priority /><div className="laptop-screen-content"><p className="eyebrow">REPHON 24X7 · DEVICE STUDIO</p><h1>A good device,<br /><span>ready for what’s next.</span></h1><p>Find your next favorite in our renewed catalogue.</p></div></div>
      </article>
      <article className="showcase-device showcase-phone" aria-label="Apple phone">
        <div className="product-render phone-render"><Image className="product-photo" src="/devices/phone.png" width={1024} height={1536} alt="" priority /><WhatsAppLink className="device-action device-action-light" /></div>
      </article>
    </section>
  );
}
