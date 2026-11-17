export const aboutContentDefaults = {
  lede: "Thoughtful care for the devices you rely on.",
  description: "REPHON 24X7 helps you repair, sell, or find a renewed device with clear choices and dependable support.",
  philosophy: "Make every device decision feel simpler.",
  introHeading: "One place to make your next move.",
  introParagraph1: "Phones are part of everyday life. When one needs attention, has become the wrong fit, or is ready for someone new, the next step should be clear.",
  introParagraph2: "Explore repair, resale, and renewed devices in one place, with the important details confirmed before you commit.",
  promiseHeading: "Clear choices. Considered care.",
  promise1: "Tell us what you need, then we’ll help you understand the available next steps.",
  promise2: "Device condition, service coverage, and availability are checked before anything is agreed.",
  promise3: "Repair and renewed-device choices can keep useful devices in service longer.",
} as const;

export type AboutContent = { -readonly [Key in keyof typeof aboutContentDefaults]: string };
