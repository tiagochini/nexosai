import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const root = new URL("../artifacts/nexos-academy/src/", import.meta.url);
test("Academy owner client has no fixed credentials or query-secret authorization", async () => {
  const owner = await readFile(new URL("pages/owner.tsx", root), "utf8");
  assert.doesNotMatch(owner, /OWNER_PIN|OWNER_SECRET|nexos2025|secret=|x-admin-secret/);
  assert.match(owner, /headers\.set\("Authorization"/);
  assert.match(owner, /\/api\/auth\/login/);
  assert.match(owner, /\/api\/academy\/admin\/session/);
  assert.match(owner, /"Idempotency-Key": key/);
  assert.doesNotMatch(owner, /fetch\([`"]\/api\/academy/);
});
test("Stored flags and URL owner tokens cannot initialize paid/owner access", async () => {
  const app = await readFile(new URL("App.tsx", root), "utf8");
  const magnet = await readFile(new URL("pages/lead-magnet.tsx", root), "utf8");
  assert.doesNotMatch(app + magnet, /NX-FOUNDER-2026|hasStoredAccess|params\.get\("owner"\)/);
  assert.match(app, /\[hasAccess, setHasAccess\] = useState\(false\)/);
  assert.match(app, /\/api\/academy\/verify\//);
});
