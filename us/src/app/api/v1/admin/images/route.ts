import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const mimeExtensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic" };
const rights = ["owned", "licensed", "manufacturer-approved"];
function checkMagic(type: string, data: Uint8Array) {
  if (type === "image/jpeg") return data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  if (type === "image/png") return data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47;
  if (type === "image/webp") return String.fromCharCode(...data.slice(0, 4)) === "RIFF" && String.fromCharCode(...data.slice(8, 12)) === "WEBP";
  if (type === "image/heic") return String.fromCharCode(...data.slice(4, 12)).includes("ftyp");
  return false;
}
function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Image request failed";
  const status = message === "Authentication required" ? 401 : message.includes("authorised") ? 403 : message.includes("not configured") ? 503 : 400;
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    await requireStaff(["admin"]);
    const db = createSupabaseServerClient();
    const [{ data, error }, { data: models, error: modelError }] = await Promise.all([
      db.from("phone_images").select("id,device_code,model_id,variant_id,image_url,storage_path,image_type,colour,alt_text,source_name,source_url,usage_permission,is_primary,sort_order,status,created_at,model:phone_models(name,brand:phone_brands(name))").order("created_at", { ascending: false }).limit(100),
      db.from("phone_models").select("id,name,model_code,brand:phone_brands!inner(name,brand_code)").eq("is_active", true).eq("status", 1).eq("verification_status", "verified").order("name").limit(1000),
    ]);
    if (error) throw error;
    if (modelError) throw modelError;
    const rows = await Promise.all((data ?? []).map(async (row) => {
      if (!row.storage_path) return row;
      const { data: link } = await db.storage.from("product-images").createSignedUrl(row.storage_path, 900);
      return { ...row, previewUrl: link?.signedUrl ?? null };
    }));
    return NextResponse.json({ data: rows, models: models ?? [] });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireStaff(["admin"]);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Select an image file." }, { status: 400 });
    if (file.size < 1 || file.size > 8 * 1024 * 1024) return NextResponse.json({ error: "Images must be smaller than 8 MB." }, { status: 413 });
    const type = file.type.toLowerCase();
    if (!mimeExtensions[type]) return NextResponse.json({ error: "Use a JPEG, PNG, WebP, or HEIC photograph." }, { status: 415 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!checkMagic(type, bytes)) return NextResponse.json({ error: "The selected file does not match its declared image type." }, { status: 415 });
    const deviceCode = String(form.get("deviceCode") ?? "").trim();
    const modelId = String(form.get("modelId") ?? "").trim();
    const imageType = String(form.get("imageType") ?? "");
    const altText = String(form.get("altText") ?? "").trim();
    const colour = String(form.get("colour") ?? "").trim();
    const sourceName = String(form.get("sourceName") ?? "").trim();
    const sourceUrl = String(form.get("sourceUrl") ?? "").trim();
    const permission = String(form.get("usagePermission") ?? "");
    const confirms = form.get("confirmPermission") === "yes";
    if ((deviceCode && !/^\d{7}$/.test(deviceCode)) || (!deviceCode && !/^[0-9a-f-]{36}$/i.test(modelId))) return NextResponse.json({ error: "Choose a model or enter a seven-digit device code." }, { status: 400 });
    if (!["front", "back", "side", "gallery", "colour_variant"].includes(imageType)) return NextResponse.json({ error: "Choose a valid image view." }, { status: 400 });
    if (altText.length < 10 || altText.length > 160 || !sourceName || !confirms || !rights.includes(permission)) return NextResponse.json({ error: "Provide useful alt text, a source, an approved usage-rights category, and confirm permission to use the image." }, { status: 400 });
    if (sourceUrl) { try { if (new URL(sourceUrl).protocol !== "https:") throw new Error(); } catch { return NextResponse.json({ error: "Source URL must use HTTPS." }, { status: 400 }); } }
    const db = createSupabaseServerClient();
    let resolvedModelId = modelId || null;
    let variantId: string | null = null;
    let resolvedDeviceCode: string | null = null;
    if (deviceCode) {
      const { data: device, error } = await db.from("phone_variants").select("id,model_id").eq("device_code", deviceCode).maybeSingle();
      if (error) throw error;
      if (!device) return NextResponse.json({ error: "Device code was not found in the master catalogue." }, { status: 404 });
      resolvedModelId = device.model_id; variantId = device.id; resolvedDeviceCode = deviceCode;
    } else {
      const { data: model, error } = await db.from("phone_models").select("id").eq("id", modelId).eq("is_active", true).eq("status", 1).eq("verification_status", "verified").maybeSingle();
      if (error) throw error;
      if (!model) return NextResponse.json({ error: "Choose an active, verified model." }, { status: 404 });
    }
    const path = `${deviceCode || `models/${resolvedModelId}`}/${randomUUID()}.${mimeExtensions[type]}`;
    const { error: uploadError } = await db.storage.from("product-images").upload(path, bytes, { contentType: type, upsert: false });
    if (uploadError) throw uploadError;
    const { data: record, error: insertError } = await db.from("phone_images").insert({
      device_code: resolvedDeviceCode, model_id: resolvedModelId, variant_id: variantId,
      image_url: `storage://product-images/${path}`, storage_path: path, image_type: imageType, colour: colour || null,
      alt_text: altText, source_name: sourceName, source_url: sourceUrl || null, usage_permission: permission,
      is_primary: false, sort_order: 0, status: 1, approved_by: user.id, approved_at: new Date().toISOString(),
    }).select("id,device_code,model_id,variant_id,image_type,alt_text,usage_permission,status").single();
    if (insertError) { await db.storage.from("product-images").remove([path]); throw insertError; }
    const { data: signed } = await db.storage.from("product-images").createSignedUrl(path, 900);
    return NextResponse.json({ data: { ...record, previewUrl: signed?.signedUrl ?? null } }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
