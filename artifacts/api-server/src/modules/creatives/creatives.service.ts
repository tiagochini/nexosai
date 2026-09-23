import { eq, and, desc } from "drizzle-orm";
import OpenAI from "openai";
import {
  db,
  campaignCreativesTable,
  contentPiecesTable,
  campaignsTable,
  type CampaignCreative,
  type CreativeConcept,
} from "@workspace/db";
import { completeWithAgent } from "../ai-gateway/ai-gateway.service.js";
import { parseAgentJSON } from "../agents/agent.runner.js";
import { deductCredits } from "../credits/credits.service.js";
import { NotFoundError, AppError } from "../../lib/errors.js";
import { env } from "../../lib/env.js";
import type { Logger } from "pino";

const FORMAT_TO_DALLE_SIZE: Record<string, "1024x1024" | "1536x1024" | "1024x1536"> = {
  feed_square:    "1024x1024",
  feed_portrait:  "1024x1536",
  stories:        "1024x1536",
  banner:         "1536x1024",
  carousel_slide: "1024x1024",
};

function buildOpenAIClient(): OpenAI {
  if (env.OPENAI_API_KEY) return new OpenAI({ apiKey: env.OPENAI_API_KEY });
  if (env.AI_INTEGRATIONS_OPENAI_API_KEY && env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
    return new OpenAI({
      apiKey: env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  throw new AppError(503, "OPENAI_API_KEY não configurado — geração de imagem indisponível", "AI_UNAVAILABLE");
}

export async function listCreatives(
  campaignId: string,
  workspaceId: string,
): Promise<CampaignCreative[]> {
  return db
    .select()
    .from(campaignCreativesTable)
    .where(
      and(
        eq(campaignCreativesTable.campaignId, campaignId),
        eq(campaignCreativesTable.workspaceId, workspaceId),
      ),
    )
    .orderBy(desc(campaignCreativesTable.createdAt));
}

export async function generateConcept(
  campaignId: string,
  workspaceId: string,
  platform: string,
  format: string,
  requestNote: string,
  log: Logger,
): Promise<CampaignCreative> {
  const [campaign] = await db
    .select()
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);
  if (!campaign) throw new NotFoundError("Campanha");

  const intakeData = (campaign.intakeData as Record<string, unknown>) ?? {};
  const productName = String(
    intakeData["product.name"] ?? intakeData["productName"] ?? campaign.title ?? "Produto",
  );
  const productDescription = String(
    intakeData["product.description"] ?? intakeData["product.category"] ?? "",
  );
  const targetAudience = String(
    intakeData["audience.description"] ??
      intakeData["audience.primary"] ??
      intakeData["targetAudience"] ??
      "Empreendedores digitais",
  );

  // [C3-STANDALONE] idempotency: one concept charge per campaign+platform+format combination
  await deductCredits(workspaceId, "creative_brief", log, campaignId, undefined, undefined, undefined, `ws:${workspaceId}:creative:concept:${campaignId}:${platform}:${format}`);

  const systemPrompt = `Você é o Creative Director da NexOS AI, especialista em criativos visuais de alta conversão para o mercado digital brasileiro.
Crie um conceito criativo completo para ${platform.toUpperCase()} no formato ${format.replace(/_/g, " ")}.

Retorne APENAS um JSON válido, sem texto extra, no formato:
{
  "headline": "título impactante (máx 8 palavras)",
  "subHeadline": "subtítulo de apoio (máx 15 palavras)",
  "visualDescription": "descrição detalhada da cena visual — elementos, composição, iluminação, emoções, pessoas",
  "colorPalette": ["#hex1", "#hex2", "#hex3"],
  "cta": "texto do CTA (máx 5 palavras)",
  "mentalTrigger": "authority|transformation|scarcity|curiosity|social_proof|urgency",
  "angle": "ângulo persuasivo único em 1 frase curta",
  "mood": "atmosfera visual — ex: energético, sofisticado, aspiracional",
  "platform": "${platform}",
  "format": "${format}",
  "dallePrompt": "prompt DALL-E 3 em inglês, ultra-detalhado, estilo fotográfico profissional, SEM TEXTO nem letras na imagem",
  "rationale": "explicação em 2 frases de por que estas escolhas maximizam conversão"
}`;

  const userContent = `Produto: ${productName}
${productDescription ? `Descrição: ${productDescription}` : ""}
Público-alvo: ${targetAudience}
Plataforma: ${platform} | Formato: ${format}
${requestNote ? `Briefing adicional do usuário: ${requestNote}` : ""}

Crie um conceito criativo de alta conversão.`;

  const result = await completeWithAgent(
    "creative_director",
    systemPrompt,
    [{ role: "user", content: userContent }],
    workspaceId,
    log,
    campaignId,
  );

  const concept = parseAgentJSON<CreativeConcept>(result.content, {} as CreativeConcept);
  if (!concept || !concept.headline) {
    throw new AppError(500, "Falha ao gerar conceito criativo — resposta inválida da IA", "AI_PARSE_ERROR");
  }

  const [creative] = await db
    .insert(campaignCreativesTable)
    .values({
      campaignId,
      workspaceId,
      status: "concept_ready",
      platform: platform as any,
      format: format as any,
      requestNote: requestNote || null,
      concept,
      prompt: concept.dallePrompt,
    })
    .returning();

  log.info({ campaignId, creativeId: creative.id, platform, format }, "Creative concept generated");
  return creative;
}

export async function approveConceptAndGeneratePreview(
  creativeId: string,
  workspaceId: string,
  log: Logger,
): Promise<CampaignCreative> {
  const [creative] = await db
    .select()
    .from(campaignCreativesTable)
    .where(and(eq(campaignCreativesTable.id, creativeId), eq(campaignCreativesTable.workspaceId, workspaceId)))
    .limit(1);
  if (!creative) throw new NotFoundError("Criativo");
  if (!creative.concept) throw new AppError(400, "Conceito não encontrado", "CONCEPT_NOT_READY");

  // [C3-STANDALONE] idempotency: one preview charge per creative — concept approval is a one-time action
  await deductCredits(workspaceId, "video_low_res", log, creative.campaignId, undefined, undefined, undefined, `ws:${workspaceId}:creative:preview:${creativeId}`);

  await db
    .update(campaignCreativesTable)
    .set({ status: "preview_generating", conceptApprovedAt: new Date() })
    .where(eq(campaignCreativesTable.id, creativeId));

  setImmediate(async () => {
    try {
      const imageUrl = await generateDalleImage(
        creative.concept!.dallePrompt,
        creative.format,
        "standard",
        log,
      );
      await db
        .update(campaignCreativesTable)
        .set({ status: "preview_ready", previewUrl: imageUrl, imageExpired: false })
        .where(eq(campaignCreativesTable.id, creativeId));
    } catch (err) {
      log.warn({ creativeId, err }, "DALL-E preview generation failed");
      await db
        .update(campaignCreativesTable)
        .set({
          status: "concept_ready",
          metadata: { imageError: err instanceof Error ? err.message : "generation_failed" },
        })
        .where(eq(campaignCreativesTable.id, creativeId));
    }
  });

  const [updated] = await db
    .select()
    .from(campaignCreativesTable)
    .where(eq(campaignCreativesTable.id, creativeId))
    .limit(1);
  return updated;
}

export async function approvePreviewAndGenerateFinal(
  creativeId: string,
  workspaceId: string,
  log: Logger,
): Promise<CampaignCreative> {
  const [creative] = await db
    .select()
    .from(campaignCreativesTable)
    .where(and(eq(campaignCreativesTable.id, creativeId), eq(campaignCreativesTable.workspaceId, workspaceId)))
    .limit(1);
  if (!creative) throw new NotFoundError("Criativo");
  if (!creative.concept) throw new AppError(400, "Conceito não encontrado", "CONCEPT_NOT_READY");

  // [C3-STANDALONE] idempotency: one final charge per creative — preview approval is a one-time action
  await deductCredits(workspaceId, "video_high_res", log, creative.campaignId, undefined, undefined, undefined, `ws:${workspaceId}:creative:final:${creativeId}`);

  await db
    .update(campaignCreativesTable)
    .set({ status: "final_generating", previewApprovedAt: new Date() })
    .where(eq(campaignCreativesTable.id, creativeId));

  setImmediate(async () => {
    try {
      const imageUrl = await generateDalleImage(
        creative.concept!.dallePrompt,
        creative.format,
        "hd",
        log,
      );
      await db
        .update(campaignCreativesTable)
        .set({
          status: "approved",
          finalUrl: imageUrl,
          approvedAt: new Date(),
          imageExpired: false,
        })
        .where(eq(campaignCreativesTable.id, creativeId));

      // Final URL persistence is intentionally the only consequence here.
      // Social publication remains behind the explicit preview/confirmation route;
      // the scheduler can hydrate an already-persisted scheduled row later.
    } catch (err) {
      log.warn({ creativeId, err }, "DALL-E HD generation failed");
      await db
        .update(campaignCreativesTable)
        .set({
          status: "approved",
          finalUrl: null,
          approvedAt: new Date(),
          metadata: { imageError: err instanceof Error ? err.message : "generation_failed" },
        })
        .where(eq(campaignCreativesTable.id, creativeId));
    }
  });

  const [updated] = await db
    .select()
    .from(campaignCreativesTable)
    .where(eq(campaignCreativesTable.id, creativeId))
    .limit(1);
  return updated;
}

export async function rejectCreative(
  creativeId: string,
  workspaceId: string,
  reason: string,
): Promise<CampaignCreative> {
  const [updated] = await db
    .update(campaignCreativesTable)
    .set({ status: "rejected", rejectionReason: reason || null })
    .where(
      and(
        eq(campaignCreativesTable.id, creativeId),
        eq(campaignCreativesTable.workspaceId, workspaceId),
      ),
    )
    .returning();
  if (!updated) throw new NotFoundError("Criativo");
  return updated;
}

export async function regenerateImage(
  creativeId: string,
  workspaceId: string,
  quality: "standard" | "hd",
  log: Logger,
): Promise<CampaignCreative> {
  const [creative] = await db
    .select()
    .from(campaignCreativesTable)
    .where(and(eq(campaignCreativesTable.id, creativeId), eq(campaignCreativesTable.workspaceId, workspaceId)))
    .limit(1);
  if (!creative) throw new NotFoundError("Criativo");
  if (!creative.concept) throw new AppError(400, "Conceito não encontrado", "CONCEPT_NOT_READY");

  const creditAction = quality === "hd" ? "video_high_res" : "video_low_res";
  // [C3-STANDALONE] 5-minute bucket key: same regen within 5 min = blocked; new regen after = charged.
  const idemBucket = Math.floor(Date.now() / 300_000);
  await deductCredits(workspaceId, creditAction, log, creative.campaignId, undefined, undefined, undefined, `ws:${workspaceId}:creative:regen:${creativeId}:${quality}:${idemBucket}`);

  const targetStatus = quality === "hd" ? "final_generating" : "preview_generating";
  await db
    .update(campaignCreativesTable)
    .set({ status: targetStatus as any, metadata: {} })
    .where(eq(campaignCreativesTable.id, creativeId));

  setImmediate(async () => {
    try {
      const imageUrl = await generateDalleImage(
        creative.concept!.dallePrompt,
        creative.format,
        quality,
        log,
      );
      const finalStatus = quality === "hd" ? "approved" : "preview_ready";
      const updateData: Record<string, unknown> =
        quality === "hd"
          ? { status: finalStatus, finalUrl: imageUrl, approvedAt: new Date(), imageExpired: false }
          : { status: finalStatus, previewUrl: imageUrl, imageExpired: false };
      await db
        .update(campaignCreativesTable)
        .set(updateData as any)
        .where(eq(campaignCreativesTable.id, creativeId));
    } catch (err) {
      log.warn({ creativeId, err }, "DALL-E regeneration failed");
      const rollback = quality === "hd" ? "preview_ready" : "concept_ready";
      await db
        .update(campaignCreativesTable)
        .set({
          status: rollback as any,
          metadata: { imageError: err instanceof Error ? err.message : "generation_failed" },
        })
        .where(eq(campaignCreativesTable.id, creativeId));
    }
  });

  const [updated] = await db
    .select()
    .from(campaignCreativesTable)
    .where(eq(campaignCreativesTable.id, creativeId))
    .limit(1);
  return updated;
}

async function generateDalleImage(
  prompt: string,
  format: string,
  quality: "standard" | "hd",
  log: Logger,
): Promise<string> {
  const size = FORMAT_TO_DALLE_SIZE[format] ?? "1024x1024";
  const gptImageQuality = quality === "hd" ? "high" : "medium";
  const openai = buildOpenAIClient();

  log.info({ format, size, quality: gptImageQuality }, "Generating image (gpt-image-1)");

  const response = await openai.images.generate({
    model: "gpt-image-1",
    prompt: `${prompt}. IMPORTANT: No text, words, letters, or numbers anywhere in the image. Pure visual composition only.`,
    n: 1,
    size,
    quality: gptImageQuality,
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new Error("gpt-image-1 returned no image data");

  const dataUrl = `data:image/png;base64,${b64}`;
  log.info({ bytes: b64.length }, "gpt-image-1 image generated");
  return dataUrl;
}
