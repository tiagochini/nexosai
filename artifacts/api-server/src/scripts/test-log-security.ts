import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import express from "express";
import pinoHttp from "pino-http";
import { createSafeLogger } from "../lib/logger.js";
import { LOG_REDACTED, sanitizeLogValue, safeHttpRequest } from "../lib/log-security.js";

const password = randomBytes(24).toString("hex");
const token = ["sk", randomBytes(24).toString("hex")].join("-");
const email = `fixture-${randomBytes(8).toString("hex")}@example.invalid`;
const phone = "+5565999991234";
const url = `https://example.invalid/private/${password}?access_token=${token}`;
const lines: string[] = [];
const log = createSafeLogger({ level: "trace", base: { service: "fixture", apiKey: password } },
  { write: (line: string) => { lines.push(line); } });
const input = { password, Access_Token: token, customer: { email, phone, name: password },
  statusCode: 502, workspaceId: "workspace-fixture", inputTokens: 12, outputTokens: 3,
  response: { body: `unstructured ${password}`, data: { arbitrary: password } },
  nested: [{ CLIENT_SECRET: password, opaque: { authorization: token } }], signedUrl: url };
const snapshot = JSON.stringify(input);
log.error(input, "Provider request failed");
assert.equal(JSON.stringify(input), snapshot, "logging must not mutate caller objects");
const error = Object.assign(new Error(`provider echoed ${password} ${token} ${email}`),
  { code: "ECONNRESET", status: 502, cause: { password }, response: { arbitrary: password } });
log.error({ err: error }, "Provider transport failed");
log.error(error, "Bare error");
log.error({ err: `opaque provider error ${password}` }, "String error");
log.warn({ text: password, msg: password, message: password, lastError: password,
  oaiErr: { message: password, code: "ECONNRESET" }, providerErrorMessage: password, errText: password,
  contractWarn: password, response: { arbitrary: password }, stdout: password, stderr: password,
  tokens: 24, rawPreview: password, rawTail: password, feedback: password, geminiData: password,
  videoData: password, dtErrText: password, failureMsg: password }, "Alternate fields and private DM fixture");
log.info(`Contact ${email}; credential Bearer ${token}; redirect ${url}`);
log.info("Formatted email %s and URL %s", email, url);
const child = log.child({ credentials: { opaque: password }, refreshToken: password });
child.info({ statusCode: 200 }, "Child logger");
child.child({ password }).info("Nested child logger");
child.setBindings({ password });
child.info("Updated child bindings");
log.child({}, { serializers: { custom: () => ({ password, email }) } }).info({ custom: true }, "Custom serializer");
const circular: Record<string, unknown> = { statusCode: 200 }; circular.self = circular;
log.info(circular, "Circular data");
const getter = Object.defineProperty({}, "accessor", { enumerable: true, get() { throw new Error(password); } });
log.info(getter, "Do not invoke getters");
const customJson = { toJSON() { return { opaque: password }; }, statusCode: 200 };
log.info(customJson, "Do not invoke custom serialization");
assert.equal(sanitizeLogValue(Buffer.from(password)), LOG_REDACTED);
assert.equal((sanitizeLogValue({ Input_Tokens: 2, accessToken: password }) as Record<string, unknown>).Input_Tokens, 2);

const app = express();
app.use(pinoHttp({ logger: log, wrapSerializers: false, serializers: { req: safeHttpRequest, res: (res) => ({ statusCode: res.statusCode }) } }));
app.get("/access/:token", (req, res) => {
  req.log.info({ email, body: { password } }, "Access endpoint fixture");
  res.json({ ok: true });
});
const server = createServer(app);
try {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); assert(address && typeof address !== "string");
  const result = await fetch(`http://127.0.0.1:${address.port}/access/${password}?token=${token}`, {
    headers: { Authorization: `Bearer ${token}`, Cookie: `fixture=${password}` },
  });
  assert.equal(result.status, 200);
  await result.arrayBuffer();
  await new Promise((resolve) => setImmediate(resolve));
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

const output = lines.join("");
for (const [label, secret] of Object.entries({ password, token, email, phone })) {
  const leakingFields = lines.filter((line) => line.includes(secret)).map((line) => {
    const record = JSON.parse(line);
    return Object.keys(record).filter((key) => JSON.stringify(record[key]).includes(secret)).join(",");
  });
  assert.equal(leakingFields.length, 0, `Sensitive ${label} fixture reached fields: ${leakingFields.join(";")}`);
}
const records = lines.map((line) => JSON.parse(line));
assert(records.some((record) => record.workspaceId === "workspace-fixture" && record.statusCode === 502 && record.inputTokens === 12));
assert(records.some((record) => record.err?.code === "ECONNRESET" && record.err?.statusCode === 502));
assert(records.some((record) => record.res?.statusCode === 200), "HTTP status code must remain available");
assert(records.some((record) => record.msg === "Provider request failed"));
assert(records.some((record) => record.tokens === 24 && record.oaiErr?.code === "ECONNRESET"));
assert(output.includes(LOG_REDACTED));
console.log("Log security passed: nested secrets/PII, errors, child bindings, interpolation, HTTP paths/headers, cycles and non-mutation");
