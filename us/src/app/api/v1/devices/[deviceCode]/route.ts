import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ deviceCode: string }> };

async function signedImages(db: ReturnType<typeof createSupabaseServerClient>, modelId: string, deviceCode: string, variantId: string) {
  const columns = "id,image_url,storage_path,image_type,colour,alt_text,is_primary,sort_order";
  const { data: variantImages, error: variantError } = await db.from("phone_images").select(columns).eq("variant_id", variantId)
    .eq("status", 1).in("usage_permission", ["owned", "licensed", "manufacturer-approved"])
    .order("is_primary", { ascending: false }).order("sort_order").limit(12);
  if (variantError) throw variantError;
  let images = variantImages ?? [];
  if (!images.length) {
    const { data, error } = await db.from("phone_images").select(columns).eq("model_id", modelId).is("variant_id", null).is("device_code", null)
      .eq("status", 1).in("usage_permission", ["owned", "licensed", "manufacturer-approved"])
      .order("is_primary", { ascending: false }).order("sort_order").limit(12);
    if (error) throw error;
    images = data ?? [];
  }
  return Promise.all(images.map(async (image: { id: string; image_url: string; storage_path: string | null; image_type: string; colour: string | null; alt_text: string | null; is_primary: boolean; sort_order: number }) => {
    if (!image.storage_path) return image.image_url.startsWith("https://") ? { ...image, url: image.image_url } : null;
    const { data: signed } = await db.storage.from("product-images").createSignedUrl(image.storage_path, 1800);
    return signed?.signedUrl ? { ...image, url: signed.signedUrl } : null;
  })).then((rows) => rows.filter((row): row is NonNullable<typeof row> => row !== null));
}

export async function GET(_request: Request, { params }: Context) {
  try {
    const { deviceCode } = await params;
    if (!/^\d{7}$/.test(deviceCode)) return NextResponse.json({ error: "Device code must contain seven digits." }, { status: 400 });
    const db = createSupabaseServerClient();
    const { data: device, error } = await db.from("phone_variants")
      .select("id,device_code,variant_code,ram_gb,storage_gb,color,region,model_id,repair_enabled,buyback_enabled,resale_enabled,model:phone_models!inner(id,model_code,name,slug,release_year,launch_date,device_type,brand:phone_brands!inner(id,brand_code,name,slug))")
      .eq("device_code", deviceCode).eq("is_active", true).eq("status", 1)
      .eq("model.is_active", true).eq("model.status", 1).eq("model.verification_status", "verified")
      .eq("model.brand.is_active", true).eq("model.brand.status", 1).eq("model.brand.verification_status", "verified").maybeSingle();
    if (error) throw error;
    if (!device) return NextResponse.json({ error: "Verified device not found." }, { status: 404 });
    const { data: specifications, error: specsError } = await db.from("device_specifications")
      .select("id,category_key,specification_key,label,value_text,sort_order,category:device_specification_categories!inner(category_name,display_order)")
      .eq("model_id", device.model_id).eq("verification_status", "verified").or(`variant_id.is.null,variant_id.eq.${device.id}`)
      .order("sort_order").limit(100);
    if (specsError) throw specsError;
    const groups = new Map<string, { name: string; order: number; values: Array<{ key: string; label: string; value: string }> }>();
    for (const row of specifications ?? []) {
      const category = Array.isArray(row.category) ? row.category[0] : row.category;
      if (!category) continue;
    const group = groups.get(row.category_key) ?? { name: category.category_name, order: category.display_order, values: [] as Array<{ key: string; label: string; value: string }> };
      group.values.push({ key: row.specification_key, label: row.label, value: row.value_text });
      groups.set(row.category_key, group);
    }
    const model = Array.isArray(device.model) ? device.model[0] : device.model;
    const brand = Array.isArray(model.brand) ? model.brand[0] : model.brand;
    const images = await signedImages(db, model.id, deviceCode, device.id);
    return NextResponse.json({ data: {
      id: device.id, deviceCode: device.device_code, variantCode: device.variant_code, ramGb: device.ram_gb,
      storageGb: device.storage_gb, colour: device.color, region: device.region,
      repairEnabled: device.repair_enabled, buybackEnabled: device.buyback_enabled, resaleEnabled: device.resale_enabled,
      model: { id: model.id, modelCode: model.model_code, name: model.name, slug: model.slug, releaseYear: model.release_year, launchDate: model.launch_date, deviceType: model.device_type, brand },
      images, primaryImage: images.find((image) => image.is_primary) ?? images[0] ?? null,
      specifications: [...groups.entries()].map(([key, value]) => ({ key, ...value })).sort((a, b) => a.order - b.order),
    } });
  } catch {
    return NextResponse.json({ error: "Verified device details are temporarily unavailable." }, { status: 503 });
  }
}
