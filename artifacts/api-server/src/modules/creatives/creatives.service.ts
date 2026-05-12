import { eq, desc } from "drizzle-orm";
import {
  db,
  campaignCreativesTable,
  campaignsTable,
  type CampaignCreative,
  type CreativeConcept,
} from "@workspace/db";
import { runCreativeConceptAgent } from "../agents/creative-concept.agent.js";
import { deductCredits } from "../credits/credits.service.js";
import { getOpenAI } from "../ai-gateway/ai-gateway-internal.js";
import { NotFoundError } from "../../lib/errors.js";
import type { Logger } from "pino";

const FORMAT_TO_DALLE_SIZE: Record<string, "1024x1024" | "1792x1024" | "1024x1792"> = {
  feed_square: "1024x1024",
  feed_portrait: "1024x1792",
  stories: "1024x1792",
  banner: "1792x1024",
  carousel_slide: "1024x1024",
};

export async function listCreatives(campaignId: string, workspaceId: string): Promise<CampaignCreative[]> {
  return db
    .select()
    .from(campaignCreativesTable)
    .where(eq(campaignCreativesTable.campaignId, campaignId))
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
    .where(eq(campaignsTable.id, campaignId))
    .limit(1);

  if (!campaign) throw new NotFoundError("Campanha");

  const intakeData = (campaign.intakeData as Record<string, unknown>) ?? {};
  const productName = String(intakeData["product.name"] ?? campaign.title ?? "Produto");
  const productDescription = String(intakeData["product.description"] ?? intakeData["product.category"] ?? "");
  const targetAudience = String(intakeData["audience.description"] ?? intakeData["audience.primary"] ?? "Empreendedores digitais");

  await deductCredits(workspaceId, "creative_brief", log, campaignId);

  const concept = await runCreativeConceptAgent(
    campaignId,
    workspaceId,
    platform,
    format,
    productName,
    productDescription,
    targetAudience,
    requestNote,
    log,
  );

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
    .where(eq(campaignCreativesTable.id, creativeId))
    .limit(1);

  if (!creative) throw new NotFoundError("Criativo");
  if (!creative.concept) throw new Error("Conceito não encontrado");

  await db
    .update(campaignCreativesTable)
    .set({ status: "preview_generating", conceptApprovedAt: new Date() })
    .where(eq(campaignCreativesTable.id, creativeId));

  await deductCredits(workspaceId, "video_low_res", log, creative.campaignId);

  try {
    const imageUrl = await generateDalleImage(
      creative.concept.dallePrompt,
      creative.format,
      "standard",
      log,
    );

    const [updated] = await db
      .update(campaignCreativesTable)
      .set({ status: "preview_ready", previewUrl: imageUrl, imageExpired: false })
      .where(eq(campaignCreativesTable.id, creativeId))
      .returning();

    return updated;
  } catch (err) {
    log.warn({ err }, "DALL-E preview generation failed — storing concept-only state");
    const [updated] = await db
      .update(campaignCreativesTable)
      .set({
        status: "preview_ready",
        previewUrl: null,
        metadata: { imageError: err instanceof Error ? err.message : "generation_failed" },
      })
      .where(eq(campaignCreativesTable.id, creativeId))
      .returning();
    return updated;
  }
}

export async function approvePreviewAndGenerateFinal(
  creativeId: string,
  workspaceId: string,
  log: Logger,
): Promise<CampaignCreative> {
  const [creative] = await db
    .select()
    .from(campaignCreativesTable)
    .where(eq(campaignCreativesTable.id, creativeId))
    .limit(1);

  if (!creative) throw new NotFoundError("Criativo");
  if (!creative.concept) throw new Error("Conceito não encontrado");

  await db
    .update(campaignCreativesTable)
    .set({ status: "final_generating", previewApprovedAt: new Date() })
    .where(eq(campaignCreativesTable.id, creativeId));

  await deductCredits(workspaceId, "video_high_res", log, creative.campaignId);

  try {
    const imageUrl = await generateDalleImage(
      creative.concept.dallePrompt,
      creative.format,
      "hd",
      log,
    );

    const [updated] = await db
      .update(campaignCreativesTable)
      .set({
        status: "approved",
        finalUrl: imageUrl,
        approvedAt: new Date(),
        imageExpired: false,
      })
      .where(eq(campaignCreativesTable.id, creativeId))
      .returning();

    return updated;
  } catch (err) {
    log.warn({ err }, "DALL-E final generation failed");
    const [updated] = await db
      .update(campaignCreativesTable)
      .set({
        status: "approved",
        finalUrl: null,
        approvedAt: new Date(),
        metadata: { imageError: err instanceof Error ? err.message : "generation_failed" },
      })
      .where(eq(campaignCreativesTable.id, creativeId))
      .returning();
    return updated;
  }
}

export async function rejectCreative(
  creativeId: string,
  reason: string,
): Promise<CampaignCreative> {
  const [updated] = await db
    .update(campaignCreativesTable)
    .set({ status: "rejected", rejectionReason: reason })
    .where(eq(campaignCreativesTable.id, creativeId))
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
    .where(eq(campaignCreativesTable.id, creativeId))
    .limit(1);

  if (!creative) throw new NotFoundError("Criativo");
  if (!creative.concept) throw new Error("Conceito não encontrado");

  const creditAction = quality === "hd" ? "video_high_res" : "video_low_res";
  await deductCredits(workspaceId, creditAction, log, creative.campaignId);

  const imageUrl = await generateDalleImage(
    creative.concept.dallePrompt,
    creative.format,
    quality,
    log,
  );

  const targetField = quality === "hd" ? { finalUrl: imageUrl } : { previewUrl: imageUrl };

  const [updated] = await db
    .update(campaignCreativesTable)
    .set({ ...targetField, imageExpired: false })
    .where(eq(campaignCreativesTable.id, creativeId))
    .returning();

  return updated;
}

async function generateDalleImage(
  prompt: string,
  format: string,
  quality: "standard" | "hd",
  log: Logger,
): Promise<string> {
  const size = FORMAT_TO_DALLE_SIZE[format] ?? "1024x1024";
  const openai = getOpenAI();

  log.info({ format, size, quality }, "Generating DALL-E 3 image");

  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt: `${prompt}. IMPORTANT: No text, words, letters, or numbers should appear anywhere in the image. Pure visual only.`,
    n: 1,
    size,
    quality,
    response_format: "url",
  });

  const url = response.data?.[0]?.url;
  if (!url) throw new Error("DALL-E returned no image URL");

  log.info({ url: url.substring(0, 80) }, "DALL-E image generated");
  return url;
}
