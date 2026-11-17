import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ modelId: string }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    const { modelId } = await params;
    const db = createSupabaseServerClient();
    const { data: model, error } = await db.from("phone_models")
      .select("id,model_code,name,slug,release_year,launch_date,device_type,brand:phone_brands!inner(id,brand_code,name,slug)")
      .eq("id", modelId).eq("is_active", true).eq("status", 1).eq("verification_status", "verified")
      .eq("brand.is_active", true).eq("brand.status", 1).eq("brand.verification_status", "verified").maybeSingle();
    if (error) throw error;
    if (!model) return NextResponse.json({ error: "Verified device model not found." }, { status: 404 });
    const { data: specifications, error: specsError } = await db.from("device_specifications")
      .select("id,category_key,specification_key,label,value_text,sort_order,category:device_specification_categories!inner(category_name,display_order)")
      .eq("model_id", model.id).is("variant_id", null).eq("verification_status", "verified")
      .order("sort_order").limit(100);
    if (specsError) throw specsError;
    const { data: images, error: imagesError } = await db.from("phone_images")
      .select("id,image_url,storage_path,image_type,colour,alt_text,is_primary,sort_order")
      .eq("model_id", model.id).is("variant_id", null).is("device_code", null).eq("status", 1)
      .in("usage_permission", ["owned", "licensed", "manufacturer-approved"]).order("is_primary", { ascending: false }).order("sort_order").limit(12);
    if (imagesError) throw imagesError;
    const approvedImages = await Promise.all((images ?? []).map(async (image) => {
      if (!image.storage_path) return image.image_url.startsWith("https://") ? image : null;
      const { data: link } = await db.storage.from("product-images").createSignedUrl(image.storage_path, 1800);
      return link?.signedUrl ? { ...image, image_url: link.signedUrl } : null;
    }));
    const grouped = new Map<string, { name: string; order: number; values: Array<{ key: string; label: string; value: string }> }>();
    for (const row of specifications ?? []) {
      const category = Array.isArray(row.category) ? row.category[0] : row.category;
      if (!category) continue;
      const group = grouped.get(row.category_key) ?? { name: category.category_name, order: category.display_order, values: [] as Array<{ key: string; label: string; value: string }> };
      group.values.push({ key: row.specification_key, label: row.label, value: row.value_text });
      grouped.set(row.category_key, group);
    }
    const brand = Array.isArray(model.brand) ? model.brand[0] : model.brand;
    return NextResponse.json({ data: {
      id: model.id, modelCode: model.model_code, name: model.name, slug: model.slug,
      releaseYear: model.release_year, launchDate: model.launch_date, deviceType: model.device_type,
      brand, specifications: [...grouped.entries()].map(([key, value]) => ({ key, ...value })).sort((a, b) => a.order - b.order),
      images: approvedImages.filter((image): image is NonNullable<typeof image> => image !== null),
    } });
  } catch {
    return NextResponse.json({ error: "Verified device details are temporarily unavailable." }, { status: 503 });
  }
}
