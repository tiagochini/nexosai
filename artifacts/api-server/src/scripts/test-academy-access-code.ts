import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { generateAccessToken } from "../modules/academy/academy-access-code.js";

const originalRandom = Math.random;
try {
  Math.random = () => { throw new Error("Math.random must never generate Academy credentials"); };
  const sample = new Set<string>();
  for (let index = 0; index < 1000; index++) {
    const code = generateAccessToken();
    assert.match(code, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    sample.add(code);
  }
  assert.equal(sample.size, 1000, "smoke check: no duplicates in this sample; not a uniqueness guarantee");
} finally { Math.random = originalRandom; }
// Guard both issuance paths against reintroducing a local insecure generator.
for (const path of ["academy.service.ts", "academy.routes.ts", "academy-access-code.ts"]) {
  const source = await readFile(new URL(`../modules/academy/${path}`, import.meta.url), "utf8");
  assert.ok(!source.includes("Math.random"), `${path} must not use non-cryptographic randomness`);
}
console.log("PASS Academy access codes: CSPRNG independent of Math.random, legacy format and issuance-source regression checks (no issued codes printed)");
