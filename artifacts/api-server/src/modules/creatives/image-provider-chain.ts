import OpenAI from "openai";
import type { Logger } from "pino";
import { env } from "../../lib/env.js";
import { AppError } from "../../lib/errors.js";

export interface ImageAttempt {
  provider: string;
  model: string;
  run: () => Promise<string>;
}

function verifiedImage(url: string): boolean {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(url);
  if (!match || match[2]!.length > 28_000_000) return false;
  const bytes = Buffer.from(match[2]!, "base64");
  return (match[1] === "png" && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])))
    || (match[1] === "jpeg" && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    || (match[1] === "webp" && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP");
}

export async function executeImageProviderChain(attempts: ImageAttempt[], log: Logger): Promise<string> {
  const failures: { provider: string; model: string; status?: number }[] = [];
  for (const attempt of attempts) {
    try {
      const image = await attempt.run();
      if (!verifiedImage(image)) throw new Error("IMAGE_DATA_MISSING");
      log.info({ provider: attempt.provider, model: attempt.model, usedFallback: failures.length > 0 }, "Creative image delivered");
      return image;
    } catch (error) {
      const detail = error as { status?: number; code?: string };
      // A safety refusal must not be bypassed by changing providers.
      if (detail.code === "content_policy_violation" || detail.code === "IMAGE_SAFETY_BLOCKED") {
        throw new AppError(422, "O pedido de imagem foi bloqueado por segurança. Revise o conceito.", "IMAGE_SAFETY_BLOCKED");
      }
      const failure = { provider: attempt.provider, model: attempt.model, status: detail.status };
      failures.push(failure);
      log.warn(failure, "Creative image provider failed; trying next configured provider");
    }
  }
  throw new AppError(503,
    "Nenhum provedor de imagens configurado conseguiu entregar a imagem. Confira saldo, acesso e disponibilidade dos provedores.",
    "IMAGE_PROVIDERS_FAILED", { failures });
}

export function imageFromGeminiResponse(data: {
  promptFeedback?: { blockReason?: string };
  candidates?: { finishReason?: string; content?: { parts?: { thought?: boolean; inlineData?: { mimeType?: string; data?: string } }[] } }[];
}): string {
  if (data.promptFeedback?.blockReason || data.candidates?.some(c => c.finishReason === "SAFETY" || c.finishReason === "IMAGE_SAFETY")) {
    throw new AppError(422, "Imagem bloqueada por segurança", "IMAGE_SAFETY_BLOCKED");
  }
  const part = data.candidates?.flatMap(c => c.content?.parts ?? [])
    .find(p => !p.thought && p.inlineData?.mimeType?.startsWith("image/") && p.inlineData.data);
  return part ? `data:${part.inlineData!.mimeType};base64,${part.inlineData!.data}` : "";
}

export async function generateCreativeImage(prompt: string, format: string, quality: "standard" | "hd", log: Logger): Promise<string> {
  const landscape = format === "banner";
  const portrait = format === "stories" || format === "feed_portrait";
  const size = landscape ? "1536x1024" : portrait ? "1024x1536" : "1024x1024";
  const fullPrompt = `${prompt}. IMPORTANT: No text, words, letters, or numbers anywhere in the image. Pure visual composition only.`;
  const attempts: ImageAttempt[] = [];
  const addOpenAI = (apiKey: string, baseURL?: string) => {
    attempts.push({ provider: baseURL ? "openai-integration" : "openai", model: "gpt-image-1", run: async () => {
      const client = new OpenAI({ apiKey, baseURL, timeout: 90_000, maxRetries: 0 });
      const response = await client.images.generate({ model: "gpt-image-1", prompt: fullPrompt, n: 1, size, quality: quality === "hd" ? "high" : "medium" });
      const b64 = response.data?.[0]?.b64_json;
      return b64 ? `data:image/png;base64,${b64}` : "";
    } });
  };
  if (env.OPENAI_API_KEY) addOpenAI(env.OPENAI_API_KEY);
  if (env.GEMINI_API_KEY) {
    attempts.push({ provider: "gemini", model: "gemini-2.5-flash-image", run: async () => {
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent", {
        method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: landscape ? "3:2" : portrait ? "2:3" : "1:1" } } }),
        signal: AbortSignal.timeout(90_000),
      });
      if (!response.ok) throw Object.assign(new Error("GEMINI_IMAGE_REQUEST_FAILED"), { status: response.status });
      return imageFromGeminiResponse(await response.json() as Parameters<typeof imageFromGeminiResponse>[0]);
    } });
  }
  if (env.AI_INTEGRATIONS_OPENAI_API_KEY && env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
    addOpenAI(env.AI_INTEGRATIONS_OPENAI_API_KEY, env.AI_INTEGRATIONS_OPENAI_BASE_URL);
  }
  return executeImageProviderChain(attempts, log);
}
