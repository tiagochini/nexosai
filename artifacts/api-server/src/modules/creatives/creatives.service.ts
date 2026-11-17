import { eq, and, desc } from "drizzle-orm";
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
import { generateCreativeImage } from "./image-provider-chain.js";
import { campaignCreativeObjectKey, createGCSObjectStream, deleteGCSObject, uploadBufferToGCS } from "../../lib/gcs-recordings.js";
import type { Logger } from "pino";

function managedCreativeMediaUrl(campaignId: string, creativeId: string, variant: "preview" | "final", value: string | null): string | null {
  if (!value?.startsWith("campaigns/")) return value;
  return `/api/campaigns/${campaignId}/creatives/${creativeId}/media/${variant}`;
}

async function persistCreativeImage(
  workspaceId: string,
  campaignId: string,
  creativeId: string,
  variant: "preview" | "final",
  dataUrl: string,
): Promise<string> {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match || match[2]!.length > 28_000_000) throw new AppError(502, "A imagem gerada não possui um formato válido", "IMAGE_DATA_MISSING");
  const contentType = `image/${match[1]}`;
  const bytes = Buffer.from(match[2]!, "base64");
  const valid = (contentType === "image/png" && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    || (contentType === "image/jpeg" && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    || (contentType === "image/webp" && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP");
  if (!valid) throw new AppError(502, "A imagem gerada está corrompida", "IMAGE_DATA_MISSING");
  const extension = match[1] === "jpeg" ? "jpg" : match[1];
  const key = campaignCreativeObjectKey(workspaceId, campaignId, creativeId, variant, extension!);
  await uploadBufferToGCS(bytes, key, contentType);
  return key;
}

async function removeReplacedCreativeImage(previousKey: string | null, nextKey: string, log: Logger, creativeId: string): Promise<void> {
  if (previousKey?.startsWith("campaigns/") && previousKey !== nextKey) {
    await deleteGCSObject(previousKey).catch((err) => log.warn({ err, creativeId }, "Could not remove replaced campaign image"));
  }
}

function referenceKey(creative: CampaignCreative): string | null {
  const key = (creative.metadata as Record<string, unknown> | null)?.referenceImageKey;
  const expectedPrefix = `campaigns/${creative.workspaceId}/${creative.campaignId}/creatives/${creative.id}/reference/`;
  return typeof key === "string" && key.startsWith(expectedPrefix) ? key : null;
}

async function getReferenceDataUrl(creative: CampaignCreative): Promise<string | undefined> {
  const key = referenceKey(creative);
  if (!key) return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of createGCSObjectStream(key)) chunks.push(Buffer.from(chunk));
  const meta = await import("../../lib/gcs-recordings.js").then((m) => m.getGCSObjectMeta(key));
  return `data:${meta.contentType};base64,${Buffer.concat(chunks).toString("base64")}`;
}

function creativeLocale(creative: CampaignCreative): string {
  const locale = (creative.metadata as Record<string, unknown> | null)?.creativeLocale;
  return typeof locale === "string" ? locale : "pt-BR";
}

export async function updateCreativeConcept(
  campaignId: string,
  creativeId: string,
  workspaceId: string,
  patch: Partial<CreativeConcept>,
  locale: string,
): Promise<CampaignCreative> {
  const [creative] = await db.select().from(campaignCreativesTable).where(and(
    eq(campaignCreativesTable.id, creativeId), eq(campaignCreativesTable.campaignId, campaignId), eq(campaignCreativesTable.workspaceId, workspaceId),
  )).limit(1);
  if (!creative) throw new NotFoundError("Criativo");
  if (!creative.concept) throw new AppError(400, "Conceito não encontrado", "CONCEPT_NOT_READY");
  if (["preview_generating", "final_generating"].includes(creative.status)) throw new AppError(409, "Aguarde a geração atual terminar antes de editar.", "CREATIVE_BUSY");
  const concept = { ...creative.concept, ...patch };
  const metadata = { ...((creative.metadata ?? {}) as Record<string, unknown>), creativeLocale: locale };
  const [updated] = await db.update(campaignCreativesTable).set({ concept, prompt: concept.dallePrompt, metadata })
    .where(and(eq(campaignCreativesTable.id, creativeId), eq(campaignCreativesTable.workspaceId, workspaceId))).returning();
  return updated!;
}

export async function saveCreativeReferenceImage(
  campaignId: string,
  creativeId: string,
  workspaceId: string,
  bytes: Buffer,
  contentType: string,
): Promise<CampaignCreative> {
  const [creative] = await db.select().from(campaignCreativesTable).where(and(
    eq(campaignCreativesTable.id, creativeId), eq(campaignCreativesTable.campaignId, campaignId), eq(campaignCreativesTable.workspaceId, workspaceId),
  )).limit(1);
  if (!creative) throw new NotFoundError("Criativo");
  if (["preview_generating", "final_generating"].includes(creative.status)) throw new AppError(409, "Aguarde a geração atual terminar antes de trocar a imagem.", "CREATIVE_BUSY");
  const valid = (contentType === "image/png" && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])))
    || (contentType === "image/jpeg" && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    || (contentType === "image/webp" && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP");
  if (!valid) throw new AppError(400, "Envie uma imagem PNG, JPEG ou WebP válida.", "REFERENCE_IMAGE_INVALID");
  const extension = contentType === "image/jpeg" ? "jpg" : contentType.split("/")[1];
  const key = `campaigns/${workspaceId}/${campaignId}/creatives/${creativeId}/reference/reference.${extension}`;
  await uploadBufferToGCS(bytes, key, contentType);
  const previous = referenceKey(creative);
  const metadata = { ...((creative.metadata ?? {}) as Record<string, unknown>), referenceImageKey: key, referenceImageContentType: contentType, imageError: null };
  const [updated] = await db.update(campaignCreativesTable).set({ metadata }).where(eq(campaignCreativesTable.id, creativeId)).returning();
  if (previous && previous !== key) await deleteGCSObject(previous).catch(() => undefined);
  return updated!;
}

export async function removeCreativeReferenceImage(campaignId: string, creativeId: string, workspaceId: string): Promise<CampaignCreative> {
  const [creative] = await db.select().from(campaignCreativesTable).where(and(
    eq(campaignCreativesTable.id, creativeId), eq(campaignCreativesTable.campaignId, campaignId), eq(campaignCreativesTable.workspaceId, workspaceId),
  )).limit(1);
  if (!creative) throw new NotFoundError("Criativo");
  const key = referenceKey(creative);
  const metadata = { ...((creative.metadata ?? {}) as Record<string, unknown>) };
  delete metadata["referenceImageKey"];
  delete metadata["referenceImageContentType"];
  const [updated] = await db.update(campaignCreativesTable).set({ metadata }).where(eq(campaignCreativesTable.id, creativeId)).returning();
  if (key) await deleteGCSObject(key).catch(() => undefined);
  return updated!;
}

export async function getCreativeReference(campaignId: string, creativeId: string, workspaceId: string): Promise<{ key: string; contentType: string } | null> {
  const [creative] = await db.select().from(campaignCreativesTable).where(and(
    eq(campaignCreativesTable.id, creativeId), eq(campaignCreativesTable.campaignId, campaignId), eq(campaignCreativesTable.workspaceId, workspaceId),
  )).limit(1);
  if (!creative) throw new NotFoundError("Criativo");
  const key = referenceKey(creative);
  if (!key) return null;
  const contentType = String((creative.metadata as Record<string, unknown> | null)?.referenceImageContentType ?? "image/png");
  return { key, contentType };
}

export async function listCreatives(
  campaignId: string,
  workspaceId: string,
): Promise<CampaignCreative[]> {
  const creatives = await db
    .select()
    .from(campaignCreativesTable)
    .where(
      and(
        eq(campaignCreativesTable.campaignId, campaignId),
        eq(campaignCreativesTable.workspaceId, workspaceId),
      ),
    )
    .orderBy(desc(campaignCreativesTable.createdAt));
  return creatives.map((creative) => ({
    ...creative,
    metadata: creative.metadata ? {
      ...creative.metadata,
      referenceImageKey: undefined,
      referenceImageUrl: (creative.metadata as Record<string, unknown>).referenceImageKey
        ? `/api/campaigns/${creative.campaignId}/creatives/${creative.id}/media/reference`
        : null,
    } : creative.metadata,
    previewUrl: managedCreativeMediaUrl(creative.campaignId, creative.id, "preview", creative.previewUrl),
    finalUrl: managedCreativeMediaUrl(creative.campaignId, creative.id, "final", creative.finalUrl),
  }));
}

export async function generateConcept(
  campaignId: string,
  workspaceId: string,
  platform: string,
  format: string,
  requestNote: string,
  locale: string,
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

  const languageName = locale === "en-US" ? "inglês americano" : locale === "en-AU" ? "inglês australiano" : locale === "es-LA" ? "espanhol latino-americano" : "português brasileiro";
  const systemPrompt = `Você é o Creative Director da NexOS AI, especialista em criativos visuais de alta conversão.
Crie um conceito criativo completo para ${platform.toUpperCase()} no formato ${format.replace(/_/g, " ")}.

IDIOMA OBRIGATÓRIO: ${languageName}. Todos os textos que uma pessoa verá ou editará — headline, subHeadline, visualDescription, cta, angle, mood, rationale e dallePrompt — devem ser escritos integralmente nesse idioma. Não use inglês ou espanhol como padrão. O prompt da imagem também deve estar no idioma selecionado.

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
  "dallePrompt": "instrução detalhada para gerar a imagem no idioma selecionado, estilo fotográfico profissional, sem texto visível na imagem",
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
      metadata: { creativeLocale: locale },
    })
    .returning();

  log.info({ campaignId, creativeId: creative.id, platform, format }, "Creative concept generated");
  return creative;
}

export async function translateCreativeConcept(
  campaignId: string,
  creativeId: string,
  workspaceId: string,
  locale: string,
  log: Logger,
): Promise<CampaignCreative> {
  const [creative] = await db.select().from(campaignCreativesTable).where(and(
    eq(campaignCreativesTable.id, creativeId), eq(campaignCreativesTable.campaignId, campaignId), eq(campaignCreativesTable.workspaceId, workspaceId),
  )).limit(1);
  if (!creative) throw new NotFoundError("Criativo");
  if (!creative.concept) throw new AppError(400, "Conceito não encontrado", "CONCEPT_NOT_READY");
  if (["preview_generating", "final_generating"].includes(creative.status)) throw new AppError(409, "Aguarde a geração atual terminar antes de traduzir.", "CREATIVE_BUSY");
  const languageName = locale === "en-US" ? "inglês americano" : locale === "en-AU" ? "inglês australiano" : locale === "es-LA" ? "espanhol latino-americano" : "português brasileiro";
  await deductCredits(workspaceId, "creative_brief", log, campaignId, undefined, undefined, undefined, `ws:${workspaceId}:creative:translate:${creativeId}:${locale}`);
  const result = await completeWithAgent(
    "creative_director",
    `Traduza o conceito de criativo fornecido para ${languageName}. Mantenha a mesma estratégia e significado. Todos os campos textuais devem ficar nesse idioma, inclusive dallePrompt. Preserve colorPalette e os códigos técnicos mentalTrigger, platform e format. Retorne somente JSON válido com os mesmos campos do objeto de entrada.`,
    [{ role: "user", content: JSON.stringify(creative.concept) }],
    workspaceId, log, campaignId,
  );
  const translated = parseAgentJSON<CreativeConcept>(result.content, {} as CreativeConcept);
  if (!translated?.headline || !translated?.dallePrompt) throw new AppError(502, "Não foi possível adaptar o conceito ao idioma selecionado.", "CREATIVE_TRANSLATION_FAILED");
  const metadata = { ...((creative.metadata ?? {}) as Record<string, unknown>), creativeLocale: locale };
  const [updated] = await db.update(campaignCreativesTable).set({ concept: translated, prompt: translated.dallePrompt, metadata })
    .where(and(eq(campaignCreativesTable.id, creativeId), eq(campaignCreativesTable.workspaceId, workspaceId))).returning();
  return updated!;
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
      const generatedImage = await generateCreativeImage(
        creative.concept!.dallePrompt,
        creative.format,
        "standard",
        log,
        await getReferenceDataUrl(creative),
        creativeLocale(creative),
      );
      const imageUrl = await persistCreativeImage(workspaceId, creative.campaignId, creative.id, "preview", generatedImage);
      await db
        .update(campaignCreativesTable)
        .set({ status: "preview_ready", previewUrl: imageUrl, imageExpired: false, metadata: { ...((creative.metadata ?? {}) as Record<string, unknown>), imageError: null } })
        .where(eq(campaignCreativesTable.id, creativeId));
      await removeReplacedCreativeImage(creative.previewUrl, imageUrl, log, creativeId);
    } catch (err) {
      log.warn({ creativeId, err }, "Creative image preview generation failed");
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
      const generatedImage = await generateCreativeImage(
        creative.concept!.dallePrompt,
        creative.format,
        "hd",
        log,
        await getReferenceDataUrl(creative),
        creativeLocale(creative),
      );
      const imageUrl = await persistCreativeImage(workspaceId, creative.campaignId, creative.id, "final", generatedImage);
      await db
        .update(campaignCreativesTable)
        .set({
          status: "approved",
          finalUrl: imageUrl,
          approvedAt: new Date(),
          imageExpired: false,
          metadata: { ...((creative.metadata ?? {}) as Record<string, unknown>), imageError: null },
        })
        .where(eq(campaignCreativesTable.id, creativeId));
      await removeReplacedCreativeImage(creative.finalUrl, imageUrl, log, creativeId);

      // Final URL persistence is intentionally the only consequence here.
      // Social publication remains behind the explicit preview/confirmation route;
      // the scheduler can hydrate an already-persisted scheduled row later.
    } catch (err) {
      log.warn({ creativeId, err }, "Creative image final generation failed");
      await db
        .update(campaignCreativesTable)
        .set({
          status: "preview_ready",
          finalUrl: null,
          approvedAt: null,
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
      const generatedImage = await generateCreativeImage(
        creative.concept!.dallePrompt,
        creative.format,
        quality,
        log,
        await getReferenceDataUrl(creative),
        creativeLocale(creative),
      );
      const variant = quality === "hd" ? "final" : "preview";
      const previousKey = variant === "final" ? creative.finalUrl : creative.previewUrl;
      const imageUrl = await persistCreativeImage(workspaceId, creative.campaignId, creative.id, variant, generatedImage);
      const finalStatus = quality === "hd" ? "approved" : "preview_ready";
      const updateData: Record<string, unknown> =
        quality === "hd"
          ? { status: finalStatus, finalUrl: imageUrl, approvedAt: new Date(), imageExpired: false }
          : { status: finalStatus, previewUrl: imageUrl, imageExpired: false };
      await db
        .update(campaignCreativesTable)
        .set(updateData as any)
        .where(eq(campaignCreativesTable.id, creativeId));
      await removeReplacedCreativeImage(previousKey, imageUrl, log, creativeId);
    } catch (err) {
      log.warn({ creativeId, err }, "Creative image regeneration failed");
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
