import assert from "node:assert/strict";
import test from "node:test";
import { parseCatalogueFilters } from "../src/lib/catalogue/validation.ts";

test("catalogue filters use safe pagination defaults", () => {
  assert.deepEqual(parseCatalogueFilters(new URLSearchParams()), { limit: 24, offset: 0 });
});

test("catalogue filters normalize brand and bound pagination", () => {
  assert.deepEqual(
    parseCatalogueFilters(new URLSearchParams("brand=Apple&limit=999&offset=12&q=iPhone")),
    { brand: "apple", limit: 100, offset: 12, search: "iPhone" },
  );
});

test("invalid and negative pagination falls back safely", () => {
  assert.deepEqual(parseCatalogueFilters(new URLSearchParams("limit=-1&offset=NaN")), { limit: 24, offset: 0 });
});
