import assert from "node:assert/strict";
import test from "node:test";
import { createCatalogueGetHandler } from "../src/lib/catalogue/handler.ts";
import type { CatalogueFilters, PhoneVariant } from "../src/lib/catalogue/types.ts";

const sample: PhoneVariant = {
  id: "variant-1",
  modelId: "model-1",
  storageGb: 128,
  color: "Black",
  model: { id: "model-1", name: "Example Phone", brand: { name: "Example", slug: "example" } },
};

test("GET catalogue passes validated filters and returns catalogue data", async () => {
  let received: CatalogueFilters | undefined;
  const handler = createCatalogueGetHandler(async (filters) => {
    received = filters;
    return { data: [sample], count: 1 };
  });
  const response = await handler(new Request("https://example.test/api/catalogue?brand=EXAMPLE&limit=10&q=phone"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(received, { brand: "example", limit: 10, offset: 0, search: "phone" });
  assert.deepEqual(await response.json(), { data: [sample], count: 1 });
});

test("GET catalogue returns a generic 503 when the catalogue store fails", async () => {
  const handler = createCatalogueGetHandler(async () => { throw new Error("sensitive backend detail"); });
  const response = await handler(new Request("https://example.test/api/catalogue"));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "Catalogue is temporarily unavailable" });
});
