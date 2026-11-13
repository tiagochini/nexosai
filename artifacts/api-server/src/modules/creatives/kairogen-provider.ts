/** Platform-owned media supplier. No customer credentials or billing operations. */
export type JsonObject = Record<string, unknown>;
export type MediaKind = "image" | "video";
export class KairogenError extends Error {
  constructor(public code: string, public fallbackAllowed: boolean, public generationId?: string) {
    super(code);
  }
}
const object = (value: unknown): JsonObject => value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
const text = (value: unknown): string | undefined => typeof value === "string" && value ? value : undefined;

export function toolPayload(result: JsonObject): JsonObject {
  if (result.structuredContent && typeof result.structuredContent === "object") return object(result.structuredContent);
  const blocks = Array.isArray(result.content) ? result.content : [];
  for (const block of blocks) {
    const content = object(block);
    if (content.type === "text" && typeof content.text === "string") {
      try { const parsed = JSON.parse(content.text); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed; } catch { /* non-JSON text is not a generation contract */ }
    }
  }
  return {};
}

export function supplierError(payload: JsonObject, mutation: boolean): KairogenError {
  const detail = object(payload.error);
  const code = String(payload.code ?? payload.error_code ?? detail.code ?? (typeof payload.error === "string" ? payload.error : "")).toLowerCase();
  if (/content_policy|safety|moderation|nsfw/.test(code)) return new KairogenError("IMAGE_SAFETY_BLOCKED", false);
  if (/^(insufficient_credits|insufficient_balance|not_enough_credits|plan_limit_exceeded|plan_restriction|plan_required|upgrade_required|concurrency_limit|concurrency_limit_exceeded|cost_mismatch|credit_cost_mismatch|invalid_parameters|invalid_params|unauthorized|forbidden)$/.test(code)) {
    return new KairogenError("KAIROGEN_UNAVAILABLE", true);
  }
  return new KairogenError(mutation ? "KAIROGEN_OUTCOME_UNKNOWN" : "KAIROGEN_READ_FAILED", !mutation);
}

export interface Generation {
  status: "submitted" | "processing" | "ready" | "failed";
  generationId?: string;
  url?: string;
}

export function generationResult(payload: JsonObject, kind: MediaKind, knownId?: string): Generation {
  const root = object(payload.generation ?? payload.data ?? payload.result ?? payload);
  const generations = Array.isArray(root.generations) ? root.generations : [];
  const generation = generations.length ? object(generations[0]) : root;
  const id = text(generation.generation_id) ?? text(generation.generationId) ?? text(generation.id)
    ?? text(payload.generation_id) ?? knownId;
  const status = String(generation.status ?? payload.status ?? "").toLowerCase();
  if (["failed", "error", "cancelled", "canceled", "failed_refunded"].includes(status)) return { status: "failed", generationId: id };
  const outputs = generation.outputs ?? generation[kind === "image" ? "images" : "videos"] ?? generation.output;
  const first = Array.isArray(outputs) ? outputs[0] : outputs;
  const output = object(first);
  const url = text(generation[kind === "image" ? "image_url" : "video_url"])
    ?? text(generation.output_url) ?? text(output.url) ?? text(output[kind === "image" ? "image_url" : "video_url"])
    ?? text(first) ?? text(generation.url);
  if (url && /^https:\/\//.test(url) && !["queued", "pending", "processing", "running", "submitted", "generating"].includes(status)) {
    return { status: "ready", generationId: id, url };
  }
  if (!id) throw new KairogenError("KAIROGEN_OUTCOME_UNKNOWN", false);
  return { status: status === "queued" || status === "pending" ? "submitted" : "processing", generationId: id };
}

/** Streamable HTTP, including JSON and SSE responses. No automatic mutation retries. */
export class KairogenMcp {
  private session?: string;
  private version?: string;
  private id = 0;
  constructor(private auth: { token: () => Promise<string>; refresh: () => Promise<string> }, private fetcher: typeof fetch = fetch) {}

  private async rpc(method: string, params: JsonObject, mutation = false, notify = false): Promise<JsonObject> {
    const id = ++this.id;
    for (let attempt = 0; attempt < 2; attempt++) {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${attempt ? await this.auth.refresh() : await this.auth.token()}`,
        "Content-Type": "application/json", Accept: "application/json, text/event-stream",
      };
      if (this.session) headers["Mcp-Session-Id"] = this.session;
      if (this.version) headers["MCP-Protocol-Version"] = this.version;
      let response: Response;
      try {
        response = await this.fetcher("https://mcp.kairogen.ai/mcp", {
          method: "POST", headers, redirect: "error", signal: AbortSignal.timeout(mutation ? 60000 : 25000),
          body: JSON.stringify({ jsonrpc: "2.0", ...(notify ? {} : { id }), method, params }),
        });
      } catch { throw new KairogenError(mutation ? "KAIROGEN_OUTCOME_UNKNOWN" : "KAIROGEN_READ_FAILED", !mutation); }
      this.session = response.headers.get("mcp-session-id") ?? this.session;
      if (response.status === 401 && attempt === 0) { await response.body?.cancel(); continue; }
      if (!response.ok) {
        // A moderation rejection can also be HTTP 400/403; never bypass it via another supplier.
        let payload: JsonObject = {};
        try { payload = object(await response.json()); } catch { /* no raw upstream body in errors/logs */ }
        const classified = supplierError(payload, mutation);
        if (classified.code === "IMAGE_SAFETY_BLOCKED") throw classified;
        if (!mutation || classified.fallbackAllowed || [401, 402, 429].includes(response.status)) throw new KairogenError("KAIROGEN_UNAVAILABLE", true);
        throw new KairogenError("KAIROGEN_OUTCOME_UNKNOWN", false);
      }
      if (notify) { await response.body?.cancel(); return {}; }
      let message: JsonObject;
      try {
        if (response.headers.get("content-type")?.includes("text/event-stream")) {
          const reader = response.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = "", bytes = 0;
          let answer: JsonObject | undefined;
          try {
            while (!answer) {
              const { value, done } = await reader.read();
              bytes += value?.length ?? 0;
              if (bytes > 16 * 1024 * 1024) throw new Error("response too large");
              buffer += decoder.decode(value, { stream: !done });
              let boundary;
              while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
                const frame = buffer.slice(0, boundary.index);
                buffer = buffer.slice(boundary.index + boundary[0].length);
                const data = frame.split(/\r?\n/).filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n");
                if (data) { const candidate = object(JSON.parse(data)); if (candidate.id === id) { answer = candidate; break; } }
              }
              if (done && !answer) throw new Error("missing response");
            }
          } finally { await reader.cancel().catch(() => {}); }
          message = answer;
        } else message = object(await response.json());
      } catch { throw new KairogenError(mutation ? "KAIROGEN_OUTCOME_UNKNOWN" : "KAIROGEN_READ_FAILED", !mutation); }
      if (message.id !== id) throw new KairogenError(mutation ? "KAIROGEN_OUTCOME_UNKNOWN" : "KAIROGEN_READ_FAILED", !mutation);
      if (message.error) throw supplierError({ error: message.error }, mutation);
      return object(message.result);
    }
    throw new KairogenError("KAIROGEN_AUTH_REQUIRED", true);
  }

  async connect(): Promise<void> {
    const result = await this.rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "nexos-media", version: "1.0.0" } });
    this.version = text(result.protocolVersion);
    if (!this.version) throw new KairogenError("KAIROGEN_READ_FAILED", true);
    await this.rpc("notifications/initialized", {}, false, true);
  }

  async call(name: string, args: JsonObject = {}): Promise<JsonObject> {
    const allowed = ["list_models", "get_me_context", "get_credits", "estimate_cost", "generate_image", "generate_video", "get_generation"];
    if (!allowed.includes(name)) throw new KairogenError("KAIROGEN_TOOL_FORBIDDEN", false);
    const mutation = name === "generate_image" || name === "generate_video";
    const result = await this.rpc("tools/call", { name, arguments: args }, mutation);
    const payload = toolPayload(result);
    if (result.isError || payload.error || payload.success === false) throw supplierError(payload, mutation);
    if (!Object.keys(payload).length) throw new KairogenError(mutation ? "KAIROGEN_OUTCOME_UNKNOWN" : "KAIROGEN_READ_FAILED", !mutation);
    return payload;
  }
}

export interface KairogenRequest {
  kind: MediaKind;
  prompt: string;
  aspectRatio: string;
  quality?: "standard" | "hd";
  durationSeconds?: number;
  resolution?: string;
  imageUrl?: string;
}
type Caller = { call: (name: string, args?: JsonObject) => Promise<JsonObject> };

/** Use live model schemas. Model-specific keys go in extra_params in BOTH quote and submit. */
export function generationParameters(request: KairogenRequest, model: JsonObject): JsonObject {
  const schema = Array.isArray(model.param_schema) ? model.param_schema.map(object) : [];
  const modes = object(model.modes);
  const mode = request.imageUrl
    ? Object.entries(modes).find(([, value]) => object(value).resolved_mode === "image-to-video")?.[0]
    : text(model.default_mode);
  if (request.imageUrl && !mode) throw new KairogenError("KAIROGEN_UNSUPPORTED_MODEL_MODE", true);
  const active = schema.filter(field => !Array.isArray(field.modes) || !mode || field.modes.includes(mode));
  const extra: JsonObject = {};
  if (mode) extra._mode = mode;
  const set = (key: string, value: unknown, required = false): boolean => {
    const field = active.find(item => item.key === key);
    if (!field) { if (required) throw new KairogenError("KAIROGEN_UNSUPPORTED_PARAMETERS", true); return false; }
    if (Array.isArray(field.options) && !field.options.some(option => object(option).value === value)) throw new KairogenError("KAIROGEN_UNSUPPORTED_PARAMETERS", true);
    extra[key] = value;
    return true;
  };
  const params: JsonObject = { model: model.model_key, quantity: 1, aspect_ratio: request.aspectRatio };
  if (request.kind === "image") {
    set("resolution", request.quality === "hd" ? "2k" : "1k");
  } else {
    set("duration", request.durationSeconds, true);
    if (!set("resolution", request.resolution)) {
      set("size", request.resolution === "1080p" ? "1920*1080" : "1280*720", true);
    }
    if (request.imageUrl) {
      const refs = Array.isArray(model.reference_inputs) ? model.reference_inputs.map(object) : [];
      const ref = refs.find(item => item.role === "first_frame" && (!Array.isArray(item.modes) || item.modes.includes(mode)));
      if (!ref || !text(ref.param_key)) throw new KairogenError("KAIROGEN_UNSUPPORTED_REFERENCE", true);
      set(String(ref.param_key), request.imageUrl, true);
    }
  }
  for (const field of active) {
    if (field.required && field.key !== "prompt" && extra[String(field.key)] === undefined) throw new KairogenError("KAIROGEN_UNSUPPORTED_PARAMETERS", true);
  }
  if (Object.keys(extra).length) params.extra_params = extra;
  return params;
}

export async function submitKairogen(client: Caller, request: KairogenRequest, modelKey: string): Promise<Generation> {
  const context = await client.call("get_me_context");
  const plan = object(context.plan), active = object(context.active);
  const max = plan.maxConcurrentGenerations;
  const activeTotal = active.activeGenerations;
  if (typeof max !== "number" || typeof activeTotal !== "number" || activeTotal >= max) throw new KairogenError("KAIROGEN_BUSY", true);
  const maxKind = plan[request.kind === "image" ? "maxConcurrentImageGenerations" : "maxConcurrentVideoGenerations"];
  const activeKind = active[request.kind === "image" ? "activeImageGenerations" : "activeVideoGenerations"];
  if (typeof maxKind === "number" && typeof activeKind === "number" && activeKind >= maxKind) throw new KairogenError("KAIROGEN_BUSY", true);
  const balance = await client.call("get_credits");
  if (typeof balance.credits_remaining !== "number" || !Number.isFinite(balance.credits_remaining) || balance.credits_remaining <= 0) throw new KairogenError("KAIROGEN_INSUFFICIENT_CREDITS", true);
  const catalog = await client.call("list_models", { type: request.kind });
  const models = Array.isArray(catalog.models) ? catalog.models.map(object) : [];
  const model = models.find(item => item.model_key === modelKey && item.type === request.kind);
  if (!model || !text(plan.planKey)) throw new KairogenError("KAIROGEN_MODEL_UNAVAILABLE", true);
  const params = generationParameters(request, model);
  const quote = await client.call("estimate_cost", { ...params, plan_key: plan.planKey });
  const cost = quote.credit_cost;
  if (typeof cost !== "number" || !Number.isSafeInteger(cost) || cost < 0) throw new KairogenError("KAIROGEN_INVALID_QUOTE", true);
  if (balance.credits_remaining < cost) throw new KairogenError("KAIROGEN_INSUFFICIENT_CREDITS", true);
  const response = await client.call(request.kind === "image" ? "generate_image" : "generate_video", {
    ...params, prompt: request.prompt, expected_credits: cost, wait_for_completion: false,
  });
  return generationResult(response, request.kind);
}
