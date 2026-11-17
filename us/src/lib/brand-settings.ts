/** Shared customer-facing brand identity. Keep logo/contact values configurable. */
export const brandSettings = {
  name: "REPHON 24X7",
  mark: "R",
  tagline: "Device care · renewed tech · one place",
  description: "Book device repairs, explore renewed phones, and get a quote for your device.",
  supportPhone: "+91 93153 34243",
  supportEmail: "",
  whatsappPhone: "919315334243",
  logoUrl: "",
} as const;

export function brandGreeting(message: string) {
  return `Hi ${brandSettings.name}, ${message}`;
}
