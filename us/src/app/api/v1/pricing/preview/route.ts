import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getResaleListingPrice } from "@/lib/pricing/resale";
import { getVerifiedBuybackRule, getVerifiedRepairPrices } from "@/lib/pricing/verified-rules";

type Answer = string | { id?: string; label?: string } | Array<string | { id?: string; label?: string }> | undefined;
type Answers = Record<string, Answer>;
type ReferencePrice = { label: string; amountInr: number };

const label = (value: Answer) => typeof value === "string"
  ? value.trim()
  : value && typeof value === "object" && !Array.isArray(value)
    ? String(value.label ?? "").trim()
    : "";
const code = (value: Answer) => label(value).split("·")[0]?.trim() ?? "";
const json = (data: Record<string, unknown>) => NextResponse.json({ data });
const referenceValue = (value: unknown): number | null => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
};

export async function POST(request: Request) {
  try {
    const body = await request.json() as { journey?: string; answers?: Answers };
    if (!["buy", "sell", "repair"].includes(body.journey ?? "") || !body.answers) {
      return NextResponse.json({ error: "A supported journey and answers are required." }, { status: 400 });
    }

    const answers = body.answers;
    const selectedVariant = answers.variant && typeof answers.variant === "object" && !Array.isArray(answers.variant)
      ? answers.variant
      : null;
    const variantLabel = label(answers.variant);
    const deviceCode = /^\d{7}$/.test(selectedVariant?.id ?? "")
      ? selectedVariant!.id!
      : /^\d{7}$/.test(variantLabel)
        ? variantLabel
        : "";
    let modelId = answers.model && typeof answers.model === "object" && !Array.isArray(answers.model)
      ? String(answers.model.id ?? "")
      : "";

    if (!deviceCode && !/^[0-9a-f-]{36}$/i.test(modelId)) {
      return json({ quoteRequired: true, amountInr: null, reason: "Choose a model to view its catalogue prices." });
    }

    const db = createSupabaseServerClient();
    if (deviceCode) {
      const { data: variant, error } = await db.from("phone_variants").select("device_code,model_id")
        .eq("device_code", deviceCode).maybeSingle();
      if (error) throw error;
      if (variant) modelId = variant.model_id;
      else if (!/^[0-9a-f-]{36}$/i.test(modelId)) {
        return json({ quoteRequired: true, amountInr: null, reason: "This configuration is not in the catalogue. We’ll confirm its options with you." });
      }
    }

    if (body.journey === "buy") {
      if (deviceCode) {
        const wanted = label(answers.condition).toLowerCase();
        const { data: grades, error: gradeError } = await db.from("condition_grades").select("grade_code,grade_name").eq("status", 1);
        if (gradeError) throw gradeError;
        const matchingGradeCodes = (grades ?? []).filter((grade) => !wanted || grade.grade_name.toLowerCase() === wanted || grade.grade_name.toLowerCase().includes(wanted)).map((grade) => grade.grade_code);
        const { data, error } = await db.from("resale_inventory").select("condition_grade,stock_quantity,selling_price_inr,approved_price_override_inr")
          .eq("device_code", deviceCode).eq("listing_status", "available").gt("stock_quantity", 0)
          .in("condition_grade", matchingGradeCodes.length ? matchingGradeCodes : ["__no_matching_grade__"]).limit(100);
        if (error) throw error;
        const prices = (data ?? []).map((row) => getResaleListingPrice({ approvedOverride: row.approved_price_override_inr, sellingPrice: row.selling_price_inr })).filter((value): value is number => value !== null);
        if (prices.length === 1) return json({ quoteRequired: false, amountInr: prices[0], kind: "current_listing", note: "Current listing price. Stock is confirmed before purchase." });
      }

      const { data, error } = await db.from("model_market_price_tags").select("buy_price_inr,market_scope,price_as_of")
        .eq("model_id", modelId).not("buy_price_inr", "is", null).order("price_as_of", { ascending: false, nullsFirst: false }).limit(1);
      if (error) throw error;
      const amountInr = referenceValue(data?.[0]?.buy_price_inr);
      return json(amountInr === null
        ? { quoteRequired: true, amountInr: null, reason: "No catalogue price is available for this model yet. Contact us for a quote." }
        : { quoteRequired: true, amountInr, kind: "catalogue_reference", reason: "This model reference is shown from the catalogue. Exact variant and current stock availability need confirmation." });
    }

    if (body.journey === "sell") {
      if (deviceCode) {
        const screen = code(answers.screenCode);
        const bodyCondition = code(answers.bodyCode);
        const functional = code(answers.functional);
        const battery = code(answers.batteryStatus);
        if (screen && bodyCondition && functional && ["BAT1", "BAT2"].includes(battery)) {
          const city = label(answers.city).replace(/[^\p{L}\p{N} -]/gu, "").trim();
          const rule = await getVerifiedBuybackRule(db, { deviceCode, screen, body: bodyCondition, functional, city: city || null });
          if (rule) return json({ quoteRequired: false, amountInr: Number(rule.estimated_offer_inr), kind: "condition_valuation", note: "Condition-based valuation. The final offer is confirmed after inspection." });
        }
      }

      const { data, error } = await db.from("model_market_price_tags").select("sell_baseline_inr,market_scope,price_as_of")
        .eq("model_id", modelId).not("sell_baseline_inr", "is", null).order("price_as_of", { ascending: false, nullsFirst: false }).limit(1);
      if (error) throw error;
      const amountInr = referenceValue(data?.[0]?.sell_baseline_inr);
      return json(amountInr === null
        ? { quoteRequired: true, amountInr: null, reason: "No catalogue sell reference is available for this model yet. Contact us for a valuation." }
        : { quoteRequired: true, amountInr, kind: "catalogue_reference", reason: "Model-level sell reference from the catalogue. Device condition and final offer are confirmed after inspection." });
    }

    const issueAnswer = answers.issues;
    const issueLabels = (Array.isArray(issueAnswer) ? issueAnswer : [issueAnswer]).map((item) => label(item as Answer)).filter(Boolean);
    if (!issueLabels.length) return json({ quoteRequired: true, amountInr: null, reason: "Choose the repair issues to check catalogue repair references." });

    if (deviceCode) {
      const { data: issues, error: issueError } = await db.from("repair_issues").select("issue_code,issue_name").in("issue_name", issueLabels);
      if (issueError) throw issueError;
      const codes = (issues ?? []).map((row) => row.issue_code);
      if (codes.length === issueLabels.length) {
        const city = label(answers.city).replace(/[^\p{L}\p{N} -]/gu, "").trim();
        const prices = await getVerifiedRepairPrices(db, { deviceCode, issueCodes: codes, city: city || null });
        if (prices.size === codes.length) {
          const amountInr = [...prices.values()].reduce((sum, row) => sum + Number(row.customer_price_inr), 0);
          return json({ quoteRequired: false, amountInr, kind: "condition_repair", note: "Current condition-based repair price. A technician confirms the final scope." });
        }
      }
    }

    const { data: repairReferences, error: repairError } = await db.from("model_repair_price_tags")
      .select("component_code,component_name,price_inr").eq("model_id", modelId).not("price_inr", "is", null).order("component_name").limit(100);
    if (repairError) throw repairError;
    const referencePrices: ReferencePrice[] = (repairReferences ?? []).flatMap((row) => {
      const amountInr = referenceValue(row.price_inr);
      return amountInr === null ? [] : [{ label: row.component_name || row.component_code, amountInr }];
    });
    return json({ quoteRequired: true, amountInr: null, reason: referencePrices.length ? "Catalogue component prices are shown below. Contact us to confirm the price for your selected repair." : "No repair price references are available for this model yet. Contact us for a quote.", referencePrices });
  } catch (error) {
    console.error("price preview failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Current pricing could not be checked." }, { status: 503 });
  }
}
