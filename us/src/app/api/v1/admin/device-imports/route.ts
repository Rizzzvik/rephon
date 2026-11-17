import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchExternalDeviceDetails, searchExternalDevices } from "@/lib/device-specs/provider";
import { normalizeDeviceSpecifications, normalizeModelName } from "@/lib/device-specs/normalize";

export const dynamic = "force-dynamic";

async function sourceApproval() {
  const { data, error } = await createSupabaseAdminClient().from("external_device_source_registry")
    .select("usage_review_status,is_enabled").eq("source_key", "mobile-specs-api").maybeSingle();
  if (error) throw error;
  return Boolean(data?.is_enabled && data.usage_review_status === "approved");
}

export async function GET(request: Request) {
  try {
    await requireStaff(["catalogue_manager"], "catalogue.manage");
    const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 100) || "";
    const db = createSupabaseAdminClient();
    const sourceApproved = await sourceApproval();
    const [brandsResult, pendingResult, pendingSourceResult] = await Promise.all([
      db.from("phone_brands").select("id,brand_code,name,slug").eq("is_active", true).eq("status", 1).order("name"),
      db.from("phone_models").select("id,brand_id,model_code,name,verification_status,brand:phone_brands!inner(name,brand_code)").eq("verification_status", "needs_review").order("created_at", { ascending: false }).limit(100),
      db.from("device_specification_sources").select("model_id,model:phone_models!inner(id,brand_id,model_code,name,verification_status,brand:phone_brands!inner(name,brand_code))").eq("verification_status", "pending_review").order("retrieved_at", { ascending: false }).limit(200),
    ]);
    if (brandsResult.error) throw brandsResult.error;
    if (pendingResult.error) throw pendingResult.error;
    if (pendingSourceResult.error) throw pendingSourceResult.error;
    const results = sourceApproved && query.length >= 2 ? await searchExternalDevices(query) : [];
    const pendingMap = new Map<string, NonNullable<typeof pendingResult.data>[number]>();
    for (const model of pendingResult.data ?? []) pendingMap.set(model.id, model);
    for (const source of pendingSourceResult.data ?? []) {
      const model = Array.isArray(source.model) ? source.model[0] : source.model;
      if (model) pendingMap.set(model.id, model as NonNullable<typeof pendingResult.data>[number]);
    }
    return NextResponse.json({ data: results, brands: brandsResult.data ?? [], pending: [...pendingMap.values()], sourceApproved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "External device search is unavailable.";
    const status = message === "Authentication required" ? 401 : message.includes("authorised") ? 403 : 503;
    return NextResponse.json({ error: status < 500 ? message : "External device source is unavailable or still awaiting usage approval." }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireStaff(["catalogue_manager"], "catalogue.manage");
    const body = await request.json() as { brandId?: unknown; name?: unknown; slug?: unknown };
    if (typeof body.brandId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.brandId) || typeof body.name !== "string" || typeof body.slug !== "string") {
      return NextResponse.json({ error: "Choose a universal brand and a device from the search results." }, { status: 400 });
    }
    const db = createSupabaseAdminClient();
    if (!await sourceApproval()) return NextResponse.json({ error: "External source use is not approved and enabled in the source register." }, { status: 409 });
    const [{ data: brand, error: brandError }, details] = await Promise.all([
      db.from("phone_brands").select("id,brand_code,name,slug").eq("id", body.brandId).eq("is_active", true).eq("status", 1).maybeSingle(),
      fetchExternalDeviceDetails(body.slug),
    ]);
    if (brandError) throw brandError;
    if (!brand) return NextResponse.json({ error: "Choose an active brand from the universal registry." }, { status: 400 });
    if (!details.model?.trim()) return NextResponse.json({ error: "The source did not return a model name." }, { status: 422 });
    const modelName = details.model.trim().slice(0, 160);
    const normalized = normalizeModelName(modelName);
    const { data: existingModels, error: modelError } = await db.from("phone_models").select("id,name,model_code,verification_status,is_active")
      .eq("brand_id", brand.id).eq("is_active", true).limit(1000);
    if (modelError) throw modelError;
    const matched = (existingModels ?? []).find((model) => normalizeModelName(model.name) === normalized);
    let modelId = matched?.id ?? null;
    let modelCode = matched?.model_code ?? null;
    if (matched) {
      const { error } = await db.from("external_model_mappings").upsert({ source_key: "mobile-specs-api", external_slug: body.slug, external_name: modelName, external_brand_slug: details.brand ? normalizeModelName(details.brand).replace(/\s+/g, "-") : brand.slug, model_id: matched.id, review_status: "matched", last_seen_at: new Date().toISOString(), external_data: details }, { onConflict: "source_key,external_slug" });
      if (error) throw error;
    } else {
      const yearMatch = details.release_date?.match(/(?:19|20)\d{2}/);
      const { data, error } = await db.rpc("create_pending_external_model", {
        p_brand_code: brand.brand_code, p_model_name: modelName, p_model_slug: modelName, p_external_slug: body.slug,
        p_source_key: "mobile-specs-api", p_raw_data: details, p_launch_year: yearMatch ? Number(yearMatch[0]) : null,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      modelId = row?.model_id ?? null; modelCode = row?.model_code ?? null;
    }
    if (!modelId) throw new Error("The external record could not be associated with a master model.");
    const normalizedSpecs = normalizeDeviceSpecifications(details.specifications);
    const seenKeys = new Set<string>();
    const specs = normalizedSpecs.filter((spec) => { if (seenKeys.has(spec.specificationKey)) return false; seenKeys.add(spec.specificationKey); return true; }).map((spec, index) => ({
      model_id: modelId, category_key: spec.categoryKey, specification_key: spec.specificationKey,
      label: spec.label, value_text: spec.valueText, source_value: spec.sourceValue,
      verification_status: "pending_review", sort_order: index,
    }));
    let sourceId: string | null = null;
    if (!matched) {
      const { data: sourceRow, error } = await db.from("device_specification_sources").select("id").eq("model_id", modelId).eq("external_slug", body.slug).order("retrieved_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      sourceId = sourceRow?.id ?? null;
    }
    if (!sourceId) {
      const { data: source, error } = await db.from("device_specification_sources").insert({
        source_name: "mobile-specs-api", source_url: "https://github.com/RevengerNick/mobile-specs-api", external_slug: body.slug,
        model_id: modelId, verification_status: "pending_review", verification_method: "admin_external_import", raw_response: details,
      }).select("id").single();
      if (error) throw error;
      sourceId = source.id;
    }
    if (specs.length) {
      const { data: existingSpecs, error: existingError } = await db.from("device_specifications").select("specification_key").eq("model_id", modelId).is("variant_id", null);
      if (existingError) throw existingError;
      const existingKeys = new Set((existingSpecs ?? []).map((row) => row.specification_key));
      const newSpecs = specs.filter((spec) => !existingKeys.has(spec.specification_key)).map((spec) => ({ ...spec, source_id: sourceId }));
      const { error } = newSpecs.length ? await db.from("device_specifications").insert(newSpecs) : { error: null };
      if (error) throw error;
    }
    const { error: mappingError } = await db.from("external_model_mappings").upsert({ source_key: "mobile-specs-api", external_slug: body.slug, external_name: modelName, external_brand_slug: details.brand ? normalizeModelName(details.brand).replace(/\s+/g, "-") : brand.slug, model_id: modelId, review_status: matched ? "matched" : "pending_review", last_seen_at: new Date().toISOString(), external_data: details }, { onConflict: "source_key,external_slug" });
    if (mappingError) throw mappingError;
    const { data: job, error: jobError } = await db.from("device_import_jobs").insert({ source_key: "mobile-specs-api", job_type: "details", query: modelName, job_status: "completed", result_count: 1, requested_by: user.id, started_at: new Date().toISOString(), completed_at: new Date().toISOString(), result_cache: { modelId, modelCode, matched: Boolean(matched), specifications: specs.length } }).select("id").single();
    if (jobError) throw jobError;
    await createSupabaseServerClient().from("activity_logs").insert({ actor_id: user.id, entity_type: "device_import_job", entity_id: job.id, action: "external_device_imported", details: { modelId, externalSlug: body.slug, matched: Boolean(matched), specCount: specs.length } });
    return NextResponse.json({ data: { jobId: job.id, modelId, modelCode, matched: Boolean(matched), pendingReview: !matched, specificationCount: specs.length } }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "External model import failed.";
    const status = message === "Authentication required" ? 401 : message.includes("authorised") ? 403 : 503;
    return NextResponse.json({ error: status < 500 ? message : "The model could not be imported. Check source approval, migration status, and the selected record." }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const { user } = await requireStaff(["catalogue_manager"], "catalogue.manage");
    const body = await request.json() as { modelId?: unknown; decision?: unknown };
    if (typeof body.modelId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.modelId) || !["approve", "reject"].includes(String(body.decision))) return NextResponse.json({ error: "Choose a model and review decision." }, { status: 400 });
    const db = createSupabaseAdminClient();
    const approved = body.decision === "approve";
    const status = approved ? "verified" : "rejected";
    const now = new Date().toISOString();
    const { data: currentModel, error: modelFindError } = await db.from("phone_models").select("id,name,model_code,verification_status").eq("id", body.modelId).maybeSingle();
    if (modelFindError) throw modelFindError;
    if (!currentModel) return NextResponse.json({ error: "Model not found." }, { status: 404 });
    const { data: model, error } = currentModel.verification_status === "needs_review"
      ? await db.from("phone_models").update({ verification_status: status, status: approved ? 1 : 0, is_active: approved, updated_at: now }).eq("id", body.modelId).select("id,name,model_code").maybeSingle()
      : { data: currentModel, error: null };
    if (error) throw error;
    if (!model) return NextResponse.json({ error: "Model not found." }, { status: 404 });
    const updates = await Promise.all([
      db.from("device_specifications").update({ verification_status: status, verified_by: approved ? user.id : null, verified_at: approved ? now : null, updated_at: now }).eq("model_id", model.id).eq("verification_status", "pending_review"),
      db.from("device_specification_sources").update({ verification_status: status, verified_by: approved ? user.id : null, verified_at: approved ? now : null }).eq("model_id", model.id).eq("verification_status", "pending_review"),
      db.from("external_model_mappings").update({ review_status: approved ? "approved" : "rejected" }).eq("model_id", model.id),
    ]);
    const updateError = updates.find((result) => result.error)?.error;
    if (updateError) throw updateError;
    await createSupabaseServerClient().from("activity_logs").insert({ actor_id: user.id, entity_type: "phone_model", entity_id: model.id, action: `external_model_${body.decision}d`, details: { modelCode: model.model_code } });
    return NextResponse.json({ data: { id: model.id, verificationStatus: status, active: approved } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Model review failed.";
    const status = message === "Authentication required" ? 401 : message.includes("authorised") ? 403 : 503;
    return NextResponse.json({ error: status < 500 ? message : "The model review could not be saved." }, { status });
  }
}
