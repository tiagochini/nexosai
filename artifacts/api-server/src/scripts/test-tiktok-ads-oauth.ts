import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";

if (!process.env["DATABASE_URL"]) {
  throw new Error("Set DATABASE_URL in the environment before running this test.");
}
const { default: tiktokAdsOAuthRouter } = await import("../modules/integrations/tiktok-ads-oauth.routes.js");

const app = express();
app.use("/api/integrations/tiktok-ads", tiktokAdsOAuthRouter);
const server = app.listen(0);
await once(server, "listening");
const address = server.address();
assert.ok(address && typeof address !== "string");
const baseUrl = `http://127.0.0.1:${address.port}`;

try {
  const missing = await fetch(`${baseUrl}/api/integrations/tiktok-ads/callback`);
  assert.equal(missing.status, 400);
  assert.match(await missing.text(), /Retorno incompleto/);

  const invalidState = await fetch(`${baseUrl}/api/integrations/tiktok-ads/callback?auth_code=fixture-code&state=invalid`);
  assert.equal(invalidState.status, 400);
  assert.match(await invalidState.text(), /Estado de autorização inválido/);
  console.log("TikTok Ads callback route and state validation passed");
} finally {
  server.close();
}
