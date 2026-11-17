import type { SupabaseClient } from "@supabase/supabase-js";

type RuleDates = { city: string | null; valid_from: string | null; valid_to: string | null };
type RepairRule = RuleDates & { id: string; issue_code: string; customer_price_inr: number | string | null; warranty_days: number | null };
type BuybackRule = RuleDates & { id: string; estimated_offer_inr: number | string | null };
const cityKey = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, " ");

export function chooseUniqueLiveRule<T extends RuleDates>(rules: T[], city: string | null, today: string, price: (rule: T) => unknown): T | null {
  const dated = rules.filter((rule) => (!rule.valid_from || rule.valid_from <= today) && (!rule.valid_to || rule.valid_to >= today) && price(rule) !== null && price(rule) !== undefined && Number.isFinite(Number(price(rule))) && Number(price(rule)) >= 0);
  const requestedCity = city?.trim() ? cityKey(city) : null;
  const candidates = requestedCity ? dated.filter((rule) => rule.city && cityKey(rule.city) === requestedCity) : [];
  const selected = candidates.length ? candidates : dated.filter((rule) => rule.city === null);
  return selected.length === 1 ? selected[0] : null;
}

export async function getVerifiedRepairPrices(db: SupabaseClient, input: { deviceCode: string; issueCodes: string[]; city: string | null; today?: string }) {
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{7}$/.test(input.deviceCode) || !input.issueCodes.length) return new Map<string, RepairRule>();
  const { data, error } = await db.from("repair_price_rules").select("id,issue_code,customer_price_inr,warranty_days,city,valid_from,valid_to").eq("device_code", input.deviceCode).in("issue_code", input.issueCodes).eq("verified", true).eq("status", 1).not("customer_price_inr", "is", null);
  if (error) throw error;
  const rows = (data ?? []) as RepairRule[];
  const result = new Map<string, RepairRule>();
  for (const issueCode of input.issueCodes) {
    const matching = chooseUniqueLiveRule(rows.filter((row) => row.issue_code === issueCode), input.city, today, (row) => row.customer_price_inr);
    if (matching) result.set(issueCode, matching);
  }
  return result;
}

export async function getVerifiedBuybackRule(db: SupabaseClient, input: { deviceCode: string; screen: string; body: string; functional: string; city: string | null; today?: string }) {
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{7}$/.test(input.deviceCode) || !input.screen || !input.body || !input.functional) return null;
  const { data, error } = await db.from("buyback_rules").select("id,estimated_offer_inr,city,valid_from,valid_to").eq("device_code", input.deviceCode).eq("screen_condition", input.screen).eq("body_condition", input.body).eq("functional_status", input.functional).is("battery_health_min_pct", null).is("battery_health_max_pct", null).eq("verified", true).eq("status", 1).not("estimated_offer_inr", "is", null);
  if (error) throw error;
  return chooseUniqueLiveRule((data ?? []) as BuybackRule[], input.city, today, (rule) => rule.estimated_offer_inr);
}
