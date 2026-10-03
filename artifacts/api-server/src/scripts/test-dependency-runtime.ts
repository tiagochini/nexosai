import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import express, { type ErrorRequestHandler } from "express";
import multer from "multer";
import nodemailer from "nodemailer";
import { Server } from "socket.io";
import { Storage } from "@google-cloud/storage";

// Offline mail serialization: never contact Gmail or send real messages.
const mail = nodemailer.createTransport({ streamTransport: true, buffer: true });
const message = await mail.sendMail({
  from: '"NexOS Academy" <sender@example.invalid>', to: "student@example.invalid",
  subject: "Academy fixture", html: "<p>Welcome</p>",
});
assert.deepEqual(message.envelope.to, ["student@example.invalid"]);
assert.match(message.message.toString(), /Academy fixture/);
assert.match(message.message.toString(), /<p>Welcome<\/p>/);

// Verify the legacy Google clients can still require the patched UUID v4 API.
const require = createRequire(import.meta.url);
const storageRequire = createRequire(require.resolve("@google-cloud/storage"));
for (const client of ["gaxios", "teeny-request"]) {
  const clientRequire = createRequire(storageRequire.resolve(client));
  const uuid = clientRequire("uuid");
  assert.equal(uuid.validate(uuid.v4()), true);
}
const storage = new Storage({ projectId: "offline-fixture" });
assert.equal(storage.bucket("offline-fixture").file("fixture.txt").name, "fixture.txt");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.post("/body", (req, res) => res.json(req.body));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 16, files: 1, fieldArrayIndexLimit: 100 } });
app.post("/upload", upload.single("file"), (req, res) => res.json({ size: req.file?.size }));
app.use(((err, _req, res, _next) => {
  res.status(400).json({ code: err instanceof multer.MulterError ? err.code : "INVALID_REQUEST" });
}) satisfies ErrorRequestHandler);
const server = createServer(app);
const io = new Server(server);
try {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const json = await fetch(`${base}/body`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: '{"ok":true}',
  });
  assert.deepEqual(await json.json(), { ok: true });
  const form = await fetch(`${base}/body`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "item[name]=fixture",
  });
  assert.deepEqual(await form.json(), { item: { name: "fixture" } });
  const malformed = await fetch(`${base}/body`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{",
  });
  assert.equal(malformed.status, 400);
  for (const size of [16, 17]) {
    const data = new FormData();
    data.set("file", new Blob(["x".repeat(size)]), "fixture.txt");
    const result = await fetch(`${base}/upload`, { method: "POST", body: data });
    assert.equal(result.status, size === 16 ? 200 : 400);
    assert.deepEqual(await result.json(), size === 16 ? { size } : { code: "LIMIT_FILE_SIZE" });
  }
  const sparseArray = new FormData();
  sparseArray.set("items[1000000000]", "fixture");
  const rejectedField = await fetch(`${base}/upload`, { method: "POST", body: sparseArray });
  assert.equal(rejectedField.status, 400);
  assert.deepEqual(await rejectedField.json(), { code: "LIMIT_FIELD_ARRAY_INDEX" });
  // Engine.IO polling handshake and rejection of an unsupported protocol.
  const handshake = await fetch(`${base}/socket.io/?EIO=4&transport=polling`);
  assert.equal(handshake.status, 200);
  const packet = await handshake.text();
  assert.equal(packet[0], "0");
  assert.equal(typeof JSON.parse(packet.slice(1)).sid, "string");
  const badProtocol = await fetch(`${base}/socket.io/?EIO=1&transport=polling`);
  assert.equal(badProtocol.status, 400);
  // A rejected request must not prevent subsequent valid requests.
  assert.equal((await fetch(`${base}/body`, { method: "POST" })).status, 200);
} finally {
  await new Promise<void>((resolve) => io.close(() => resolve()));
}
console.log("Dependency regressions passed: offline mail, Google UUID CJS, JSON/forms, upload limits, Engine.IO and recovery");
