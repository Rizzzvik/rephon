import { brandGreeting, brandSettings } from "@/lib/brand-settings";

const defaultMessage = brandGreeting("I’d like to know more about your services.");

export function whatsAppHref(message = defaultMessage) {
  const number = brandSettings.whatsappPhone.replace(/\D/g, "");
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export function WhatsAppLink({ className = "", message = defaultMessage, label = "Contact us" }: { className?: string; message?: string; label?: string }) {
  return <a className={`whatsapp-button ${className}`} href={whatsAppHref(message)} target="_blank" rel="noreferrer">{label}</a>;
}
