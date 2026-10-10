import assert from "node:assert/strict";
process.env["META_E2E_TEST_MODE"] = "false";
const { fetchPostComments } = await import("../modules/social-moderation/social-moderation.service.js");
const { pool } = await import("@workspace/db");
const original = globalThis.fetch;
try {
  const fields: string[] = [];
  globalThis.fetch = (async (input: string | URL) => {
    const query = new URL(input.toString()).searchParams.get("fields")!;
    fields.push(query);
    return new Response(JSON.stringify({ data: query.includes("text")
      ? [{ id: "ig-comment", text: "mapa", from: { id: "reader", username: "tester" }, timestamp: "test" }]
      : [{ id: "fb-comment", message: "facebook", from: { id: "reader", name: "Tester" }, timestamp: "test", parent: { id: "parent" } }] }), { status: 200 });
  }) as typeof fetch;
  const instagram = await fetchPostComments("ig-post", "offline-token", "instagram");
  assert.equal(instagram[0]?.message, "mapa");
  assert.deepEqual(instagram[0]?.from, { id: "reader", name: "tester" });
  const facebook = await fetchPostComments("fb-post", "offline-token", "facebook_page");
  assert.equal(facebook[0]?.message, "facebook");
  assert.equal(facebook[0]?.parent?.id, "parent");
  assert.deepEqual(fields, ["id,text,from,timestamp", "id,message,from,timestamp,parent"]);
  console.log("PASS comment reader: Instagram text/username, Facebook message/name and parent; offline transport");
} finally { globalThis.fetch = original; await pool.end(); }
