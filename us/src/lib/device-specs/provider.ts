export type ExternalDeviceListItem = { name: string; slug: string; imageUrl?: string; detail_url?: string };
export type ExternalDeviceDetails = {
  brand?: string;
  model?: string;
  imageUrl?: string;
  release_date?: string;
  dimensions?: string;
  os?: string;
  storage?: string;
  specifications?: Record<string, Record<string, string>>;
};

function apiBase() {
  const raw = process.env.DEVICE_SPECS_API_URL?.trim();
  if (!raw) throw new Error("Device specifications source is not configured.");
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("Device specifications source URL is invalid."); }
  if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Device specifications API must use HTTPS.");
  return url.toString().replace(/\/$/, "");
}

function enabled() {
  if (process.env.DEVICE_SPECS_SOURCE_APPROVED !== "true") throw new Error("External data source requires an approved usage review.");
  return apiBase();
}

async function requestJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(8000), cache: "no-store", redirect: "error", headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Device source returned HTTP ${response.status}.`);
  return await response.json() as T;
}

export async function searchExternalDevices(query: string) {
  const base = enabled();
  const url = new URL(`${base}/search`);
  url.searchParams.set("query", query.slice(0, 100));
  const response = await requestJson<{ status?: boolean; data?: ExternalDeviceListItem[] } | ExternalDeviceListItem[]>(url.toString());
  const rows = Array.isArray(response) ? response : response.data;
  if (!Array.isArray(rows)) throw new Error("Device source returned an unsupported search response.");
  return rows.filter((row) => row && typeof row.name === "string" && typeof row.slug === "string").slice(0, 20);
}

export async function fetchExternalDeviceDetails(slug: string) {
  if (!/^[a-zA-Z0-9_-]{1,200}$/.test(slug)) throw new Error("External model identifier is invalid.");
  const base = enabled();
  const response = await requestJson<ExternalDeviceDetails | { data?: ExternalDeviceDetails }>(`${base}/${encodeURIComponent(slug)}`);
  const details = "data" in response && response.data ? response.data : response as ExternalDeviceDetails;
  if (!details || typeof details !== "object" || typeof details.model !== "string") throw new Error("Device source returned incomplete model details.");
  return details;
}
