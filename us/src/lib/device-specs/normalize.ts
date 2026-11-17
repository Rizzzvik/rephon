export type NormalizedSpecification = {
  categoryKey: string;
  specificationKey: string;
  label: string;
  valueText: string;
  sourceValue: string;
};

const categoryMap: Record<string, string> = {
  general: "general", launch: "general", display: "display", platform: "platform", os: "platform",
  memory: "memory", storage: "memory", "main camera": "main_camera", "rear camera": "main_camera",
  "selfie camera": "selfie_camera", "front camera": "selfie_camera", sound: "sound", audio: "sound",
  comms: "communications", communications: "communications", network: "communications", connectivity: "communications",
  battery: "battery", features: "features", "sensors": "features", miscellaneous: "misc", misc: "misc",
};

const keyMap: Record<string, string> = {
  "release date": "release_date", "announced": "announced", "dimensions": "dimensions", "weight": "weight",
  "build": "build", "sim": "sim", "display type": "display_type", "size": "display_size", "screen size": "display_size",
  "resolution": "display_resolution", "refresh rate": "refresh_rate", "brightness": "brightness", "protection": "screen_protection",
  "os": "operating_system", "operating system": "operating_system", "chipset": "chipset", "cpu": "cpu", "gpu": "gpu",
  "internal": "storage", "internal storage": "storage", "storage": "storage", "ram": "ram", "memory": "memory", "card slot": "memory_card_support",
  "main camera": "rear_camera", "dual": "rear_camera", "triple": "rear_camera", "quad": "rear_camera", "features": "camera_features",
  "selfie camera": "front_camera", "single": "front_camera", "video": "video_recording", "loudspeaker": "loudspeaker",
  "3.5mm jack": "audio_jack", "wlan": "wifi", "bluetooth": "bluetooth", "nfc": "nfc", "radio": "radio", "usb": "usb",
  "technology": "network_technology", "2g bands": "2g_bands", "3g bands": "3g_bands", "4g bands": "4g_bands", "5g bands": "5g_bands",
  "battery type": "battery_capacity", "charging": "charging", "sensors": "sensors", "fingerprint": "fingerprint_sensor",
};

function cleanText(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value)
    .replace(/<br\s*\/?>/gi, " · ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ").trim();
}

function keyFor(label: string) {
  const normalized = label.toLowerCase().replace(/\s+/g, " ").trim();
  return keyMap[normalized] ?? null;
}

export function normalizeDeviceSpecifications(raw: unknown): NormalizedSpecification[] {
  if (!raw || typeof raw !== "object") return [];
  const source = raw as { specifications?: unknown };
  if (!source.specifications || typeof source.specifications !== "object") return [];
  const out: NormalizedSpecification[] = [];
  for (const [category, rawFields] of Object.entries(source.specifications as Record<string, unknown>)) {
    const categoryKey = categoryMap[category.toLowerCase().trim()];
    if (!categoryKey || !rawFields || typeof rawFields !== "object" || Array.isArray(rawFields)) continue;
    for (const [sourceLabel, rawValue] of Object.entries(rawFields as Record<string, unknown>)) {
      const specificationKey = keyFor(sourceLabel);
      const valueText = cleanText(rawValue);
      if (!specificationKey || !valueText) continue;
      out.push({ categoryKey, specificationKey, label: sourceLabel.trim(), valueText, sourceValue: valueText });
    }
  }
  return out;
}

export function normalizeModelName(value: string) {
  return value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
