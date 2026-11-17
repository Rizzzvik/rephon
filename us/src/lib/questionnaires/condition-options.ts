export interface ConditionOption { id: string; code: string; label: string; description: string; illustration: string; }

export const SCREEN_CONDITIONS: ConditionOption[] = [
  { id: "screen-excellent", code: "S1", label: "Excellent", description: "No visible scratches, cracks or display defects. Touch works properly.", illustration: "clean" },
  { id: "screen-minor-scratches", code: "S2", label: "Minor scratches", description: "Very light scratches, mainly visible under direct light. No cracks.", illustration: "fine-scratch" },
  { id: "screen-noticeable-scratches", code: "S3", label: "Noticeable scratches", description: "Visible surface scratches. Display remains functional.", illustration: "scratches" },
  { id: "screen-cracked-glass", code: "S4", label: "Cracked glass", description: "Front glass is cracked. Display may still work.", illustration: "cracked" },
  { id: "screen-display-defects", code: "S5", label: "Display defects", description: "Lines, spots, dead pixels, flickering or discolouration.", illustration: "lines" },
  { id: "screen-touch-issue", code: "S6", label: "Touchscreen issue", description: "Some areas do not respond, or touch is unresponsive.", illustration: "touch" },
  { id: "screen-not-working", code: "S7", label: "Display not working", description: "Screen is black or not visible. Phone may still power on.", illustration: "black" },
  { id: "screen-unknown", code: "S8", label: "Not sure", description: "I cannot determine the screen condition.", illustration: "unknown" },
];

export const BODY_CONDITIONS: ConditionOption[] = [
  { id: "body-like-new", code: "B1", label: "Like New", description: "No visible scratches, dents or damage.", illustration: "clean" },
  { id: "body-minor-wear", code: "B2", label: "Minor Wear", description: "Small scratches or light usage marks.", illustration: "fine-scratch" },
  { id: "body-noticeable-wear", code: "B3", label: "Noticeable Wear", description: "Visible scratches or cosmetic marks.", illustration: "scratches" },
  { id: "body-dents", code: "B4", label: "Dents", description: "Dents, damaged corners or frame marks.", illustration: "dented" },
  { id: "body-back-damage", code: "B5", label: "Back Panel Damage", description: "Cracked or damaged back glass or panel.", illustration: "cracked" },
  { id: "body-frame-damage", code: "B6", label: "Frame Damage", description: "Bent frame, damaged edges or deformation.", illustration: "frame" },
  { id: "body-severe-damage", code: "B7", label: "Severe Damage", description: "Multiple defects or significant damage.", illustration: "severe" },
  { id: "body-unknown", code: "B8", label: "Not sure", description: "I cannot determine the body condition.", illustration: "unknown" },
];

export const QUALITY_GRADES = [
  { id: "like-new", label: "Like New", description: "Almost no visible signs of use." },
  { id: "excellent", label: "Excellent", description: "Very minor signs of use, with no major cosmetic defects." },
  { id: "good", label: "Good", description: "Visible but moderate signs of use." },
  { id: "fair", label: "Fair", description: "Noticeable cosmetic wear; disclosed defects may be present." },
  { id: "all", label: "Show all conditions", description: "Show every listed grade." },
];
