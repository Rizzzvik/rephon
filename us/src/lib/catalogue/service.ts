import type { SupabaseClient } from "@supabase/supabase-js";
import type { CatalogueFilters, CatalogueResult, PhoneVariant } from "./types";

export async function listPhoneVariants(
  supabase: SupabaseClient,
  filters: CatalogueFilters,
): Promise<CatalogueResult<PhoneVariant>> {
  let query = supabase
    .from("phone_variants")
    .select("id, device_code, variant_code, model_id, ram_gb, storage_gb, color, model:phone_models!inner(id, name, brand:phone_brands!inner(name, slug))", { count: "exact" })
    .eq("is_active", true)
    .eq("status", 1)
    .eq("model.is_active", true)
    .eq("model.status", 1)
    .eq("model.verification_status", "verified")
    .eq("model.brand.is_active", true)
    .eq("model.brand.status", 1)
    .order("storage_gb", { ascending: true })
    .range(filters.offset ?? 0, (filters.offset ?? 0) + (filters.limit ?? 24) - 1);

  if (filters.brand) query = query.eq("model.brand.slug", filters.brand);
  if (filters.search) query = query.ilike("model.name", `%${filters.search.replace(/[%,()]/g, "\\$&")}%`);

  const { data, count, error } = await query;
  if (error) throw new Error(`Catalogue query failed: ${error.message}`);

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    device_code: string | null;
    variant_code: string | null;
    model_id: string;
    ram_gb: number | null;
    storage_gb: number;
    color: string;
    model: { id: string; name: string; brand: { name: string; slug: string } };
  }>;

  return {
    data: rows.map(({ model_id, device_code, variant_code, ram_gb, storage_gb, ...row }) => ({ ...row, deviceCode: device_code, variantCode: variant_code, modelId: model_id, ramGb: ram_gb, storageGb: storage_gb })),
    count: count ?? 0,
  };
}
