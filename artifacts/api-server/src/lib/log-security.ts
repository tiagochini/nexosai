// Sanitize before serialization: never mutate request objects, errors or bindings.
export const LOG_REDACTED = "[REDACTED]";
const sensitiveKey = /(?:password|passwd|secret|token|apikey|authorization|cookie|credential|privatekey|clientkey|email|phone|cpf|cnpj|fingerprint|ipaddress|remoteaddress|signedurl)/i;
const privateFields = new Set([
  "body", "rawbody", "requestbody", "responsebody", "payload", "data", "headers",
  "prompt", "messages", "content", "transcript", "screenshot", "buffer", "query",
  "params", "sql", "parameters", "detail", "stack", "cause", "note", "queryerror",
  "url", "uri", "connectionstring", "name", "fullname", "address", "recipient",
  "msg", "message", "text", "contractwarn", "response", "result", "stdout", "stderr",
  "preview", "rawpreview", "rawtail", "feedback", "geminidata", "videodata",
  "title", "lessontitle", "campaignname", "strategyname", "summary", "description",
  "snippet", "instructions", "answer", "output", "input", "settings", "metadata", "config",
  "question", "reply", "keyword", "keywords", "highlight", "originalname", "leadname",
  "pagename", "avatarname", "igusername", "handle", "confirmationcode", "codigo",
  "rawresponse", "rawevent", "rawprovider", "errbody", "from", "to", "key", "gcskey",
  "dbhost", "dbname", "dbuser", "items", "posts", "issues", "warnings", "violations",
  "blockers", "risks", "positioning", "private",
]);
const tokenCounters = new Set(["tokens", "inputtokens", "outputtokens", "totaltokens", "cachedtokens"]);

function dataProperty(object: object, key: string): unknown {
  let current: object | null = object;
  for (let depth = 0; current && depth < 8; depth++, current = Object.getPrototypeOf(current)) {
    const descriptor = Object.getOwnPropertyDescriptor(current, key);
    if (descriptor) return descriptor.value;
  }
  return undefined;
}

export function sanitizeLogText(value: string): string {
  return value.slice(0, 4000)
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s<>"']+/gi, LOG_REDACTED)
    .replace(/\bBearer\s+[^\s,"';]+/gi, `Bearer ${LOG_REDACTED}`)
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, LOG_REDACTED)
    .replace(/\b(?:sk-|gh[pousr]_|xox[baprs]-|AIza|AKIA)[A-Za-z0-9_-]{12,}\b/g, LOG_REDACTED)
    .replace(/\b(?:access[_-]?token|refresh[_-]?token|api[_-]?key|password|secret|authorization|cookie)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;&]+)/gi, LOG_REDACTED)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, LOG_REDACTED)
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*/g, LOG_REDACTED)
    + (value.length > 4000 ? "[TRUNCATED]" : "");
}

function safeError(value: object): Record<string, unknown> {
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const code = descriptors["code"]?.value;
  const status = descriptors["status"]?.value ?? descriptors["statusCode"]?.value;
  return {
    type: "Error", message: LOG_REDACTED,
    ...(typeof code === "string" && /^(?:ERR_[A-Z_]{1,60}|E(?:CONNREFUSED|CONNRESET|TIMEDOUT|PIPE|NOENT|ACCES)|[0-9]{5})$/.test(code) ? { code } : {}),
    ...(typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599 ? { statusCode: status } : {}),
  };
}

export function sanitizeLogValue(value: unknown): unknown {
  const seen = new WeakSet<object>();
  function visit(input: unknown, depth: number, field = ""): unknown {
    const key = field.replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (tokenCounters.has(key) && typeof input === "number" && Number.isFinite(input)) return input;
    if (sensitiveKey.test(key) || privateFields.has(key)) return LOG_REDACTED;
    if (/(?:err|error|exception)(?:text|message|response|detail)?$/.test(key) || ["reason", "rejected", "failuremessage", "failuremsg", "failurestack"].includes(key)) {
      return typeof input === "object" && input !== null ? safeError(input) : LOG_REDACTED;
    }
    if (typeof input === "string") return sanitizeLogText(input);
    if (input === null || typeof input === "boolean" || typeof input === "number") return input;
    if (typeof input !== "object") return "[OMITTED]";
    if (key === "req") return {
      id: visit(dataProperty(input, "id"), depth + 1),
      method: visit(dataProperty(input, "method"), depth + 1),
      route: visit(dataProperty(input, "route") ?? "[unmatched]", depth + 1),
    };
    if (key === "res") {
      const status = dataProperty(input, "statusCode");
      return { statusCode: typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599 ? status : "[INVALID_STATUS]" };
    }
    if (depth >= 8) return "[DEPTH_LIMIT]";
    if (seen.has(input)) return "[CIRCULAR]";
    seen.add(input);
    if (input instanceof Error) return safeError(input);
    if (Buffer.isBuffer(input) || ArrayBuffer.isView(input)) return LOG_REDACTED;
    if (input instanceof Date) return Number.isNaN(input.getTime()) ? "[INVALID_DATE]" : input.toISOString();
    if (Array.isArray(input)) return input.slice(0, 100).map((item) => visit(item, depth + 1));
    // Do not invoke getters, toJSON methods, or inspect opaque SDK objects.
    const result: Record<string, unknown> = {};
    for (const [name, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(input)).slice(0, 100)) {
      if (!descriptor.enumerable) continue;
      if (["__proto__", "prototype", "constructor", "hasOwnProperty", "toJSON"].includes(name)) continue;
      result[sanitizeLogText(name)] = "value" in descriptor ? visit(descriptor.value, depth + 1, name) : "[ACCESSOR]";
    }
    return result;
  }
  try { return visit(value, 0); } catch { return "[UNSERIALIZABLE]"; }
}

export function safeHttpRequest(req: { id?: unknown; method?: unknown; raw?: { route?: { path?: unknown } } }) {
  // Raw URLs and dynamic path segments can contain invitation/access tokens.
  // Keep request ID and method; correlate endpoint context through static log messages.
  return { id: req.id, method: req.method };
}
