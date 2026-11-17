import test from "node:test";
import assert from "node:assert/strict";
import { chooseUniqueLiveRule } from "../src/lib/pricing/verified-rules.ts";
import { getResaleListingPrice } from "../src/lib/pricing/resale.ts";

type TestRule = { id: string; city: string | null; valid_from: string | null; valid_to: string | null; price: number | null };
const rule = (id: string, city: string | null, price: number | null = 100, valid_from: string | null = null, valid_to: string | null = null): TestRule => ({ id, city, price, valid_from, valid_to });

test("a city exact rule takes precedence over a generic fallback", () => {
  const selected = chooseUniqueLiveRule([rule("default", null, 250), rule("city", "Gurugram", 300)], "gurugram", "2026-11-08", (row) => row.price);
  assert.equal(selected?.id, "city");
});

test("missing city context uses only a generic rule", () => {
  const selected = chooseUniqueLiveRule([rule("city", "Gurugram", 300), rule("default", null, 250)], null, "2026-11-08", (row) => row.price);
  assert.equal(selected?.id, "default");
});

test("ambiguous, expired, future, or missing prices require a quote", () => {
  assert.equal(chooseUniqueLiveRule([rule("a", null), rule("b", null)], null, "2026-11-08", (row) => row.price), null);
  assert.equal(chooseUniqueLiveRule([rule("expired", null, 100, null, "2026-11-07")], null, "2026-11-08", (row) => row.price), null);
  assert.equal(chooseUniqueLiveRule([rule("future", null, 100, "2026-11-09")], null, "2026-11-08", (row) => row.price), null);
  assert.equal(chooseUniqueLiveRule([rule("blank", null, null)], null, "2026-11-08", (row) => row.price), null);
});

test("resale pricing prefers approved overrides, falls back to listed price, and otherwise requests a quote", () => {
  assert.equal(getResaleListingPrice({ approvedOverride: 42_000, sellingPrice: 45_000 }), 42_000);
  assert.equal(getResaleListingPrice({ approvedOverride: null, sellingPrice: 45_000 }), 45_000);
  assert.equal(getResaleListingPrice({ approvedOverride: null, sellingPrice: null }), null);
});
