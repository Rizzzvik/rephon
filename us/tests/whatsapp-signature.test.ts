import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { isValidMetaSignature } from "../src/lib/whatsapp/signature.ts";

test("Meta webhook signatures use SHA-256 HMAC over the exact raw body", () => {
  const body = '{"object":"whatsapp_business_account","entry":[]}';
  const secret = "unit-test-secret";
  const valid = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  assert.equal(isValidMetaSignature(body, valid, secret), true);
  assert.equal(isValidMetaSignature(body + " ", valid, secret), false);
  assert.equal(isValidMetaSignature(body, "sha256=00", secret), false);
  assert.equal(isValidMetaSignature(body, null, secret), false);
});
