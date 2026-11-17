import assert from "node:assert/strict";
import test from "node:test";
import { normalizeDeviceSpecifications, normalizeModelName } from "../src/lib/device-specs/normalize.ts";
import { searchExternalDevices } from "../src/lib/device-specs/provider.ts";

test("normalizes known source fields and retains the source label and value", () => {
  const rows = normalizeDeviceSpecifications({ specifications: {
    Display: { "Display Type": "OLED, 120Hz", Resolution: "1290 x 2796 pixels" },
    Platform: { Chipset: "Example chipset" },
    Battery: { "Battery Type": "Li-Ion 4000 mAh", Charging: "25W wired" },
  } });
  assert.deepEqual(rows.map(({ categoryKey, specificationKey }) => [categoryKey, specificationKey]), [
    ["display", "display_type"], ["display", "display_resolution"], ["platform", "chipset"], ["battery", "battery_capacity"], ["battery", "charging"],
  ]);
  assert.equal(rows[0].label, "Display Type");
  assert.equal(rows[0].sourceValue, "OLED, 120Hz");
});

test("omits unknown and missing fields rather than fabricating specifications", () => {
  assert.deepEqual(normalizeDeviceSpecifications({ specifications: { Unknown: { "Made Up": "guess" }, Display: { "Panel Rating": "A+" } } }), []);
  assert.deepEqual(normalizeDeviceSpecifications({}), []);
});

test("normalizes model names for duplicate checks without changing stored labels", () => {
  assert.equal(normalizeModelName("Apple iPhone 16 Pro Max"), normalizeModelName("APPLE  iPhone-16 Pro Max"));
});

test("external device source stays disabled without explicit usage approval", async () => {
  const previous = process.env.DEVICE_SPECS_SOURCE_APPROVED;
  process.env.DEVICE_SPECS_SOURCE_APPROVED = "false";
  try { await assert.rejects(searchExternalDevices("iPhone"), /approved usage review/); }
  finally {
    if (previous === undefined) delete process.env.DEVICE_SPECS_SOURCE_APPROVED;
    else process.env.DEVICE_SPECS_SOURCE_APPROVED = previous;
  }
});
