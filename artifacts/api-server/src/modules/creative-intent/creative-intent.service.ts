/**
 * Creative Intent Layer — Pipeline de Direção Criativa Profissional
 *
 * "Primeiro conceito. Depois produção."
 *
 * Etapa 1 (BARATO): Sistema gera 3 direções conceituais com Confidence Score
 * Etapa 2: Usuário aprova a direção que mais ressoa
 * Etapa 3 (PREMIUM): Sistema produz criativos finais usando a direção aprovada
 *
 * Benefícios:
 * - Reduz GPU waste / token waste drasticamente
 * - Usuário sente controle e colaboração (IA trabalha COM você)
 * - Créditos pesados só gastam após aprovação humana
 * - Resolve alucinação criativa cara
 */

import { eq } from "drizzle-orm";
import { db, campaignsTable } from "@workspace/db";
import { runAgent, parseAgentJSON } from "../agents/agent.runner.js";
import { deductCredits } from "../credits/credits.service.js";
import { getCampaignBrain } from "../campaign-brain/campaign-brain.service.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import type { Logger } from "pino";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreativeDraft {
  index: number;                 // 0 | 1 | 2
  title: string;                 // "Direção A: Transformação Radical"
  archetype: string;             // authority | aspiration | fear_removal | curiosity | community
  hook: string;                  // Frase de abertura — o primeiro 3 segundos
  tone: string;                  // "autoritária" | "empática" | "desafiadora"
  dominantEmotion: string;       // "ambição" | "medo de perder" | "curiosidade"
  visualStyle: string;           // Descrição completa do estilo visual
  rhythm: string;                // "acelerado" | "reflexivo" | "dramático" | "provocador"
  cta: string;                   // CTA principal desta direção
  narrativeFraming: string;      // A narrativa em 2 frases
  platformFit: string[];         // ["instagram", "youtube", "tiktok", "facebook"]
  confidenceScore: number;       // 0-100 (overall alignment)
  icpAlignment: number;          // 0-100 % (fit com ICP da campanha)
  retentionPrediction: number;   // 0-100 % (previsão de retenção de audiência)
  keyInsight: string;            // Por que esta direção pode funcionar
  risk: string;                  // Principal risco desta abordagem
  creditCost: number;            // Créditos estimados para gerar versão final
}

export interface CreativeIntentData {
  status: "pending_approval" | "approved" | "generating_final";
  generatedAt: string;
  approvedDraftIndex: number | null;
  approvedAt: string | null;
  approvedByUserId?: string;
  drafts: CreativeDraft[];
  creditsSpent: number;          // Créditos gastos nesta etapa (barata)
}

// ─── Credit costs ──────────────────────────────────────────────────────────────

const INTENT_CREDIT_COST = 10; // creative_brief action — cheap ideation
const FINAL_GENERATION_ESTIMATE: Record<string, number> = {
  video_short: 80,
  video_long: 150,
  copy_bundle: 40,
  landing_page: 55,
  full_campaign: 180,
};

// ─── Main service ─────────────────────────────────────────────────────────────

export async function generateCreativeIntent(
  campaignId:  string,
  workspaceId: string,
  log:         Logger,
): Promise<CreativeIntentData> {
  const [campaign] = await db
    .select()
    .from(campaignsTable)
    .where(eq(campaignsTable.id, campaignId))
    .limit(1);

  if (!campaign || campaign.workspaceId !== workspaceId) {
    throw new NotFoundError("Campaign");
  }

  // PIPELINE_KERNEL: single source of truth
  const { CREATIVE_INTENT_PHASE_ENTRY_STATUSES } = await import("../campaigns/campaigns.service.js");
  if (!(CREATIVE_INTENT_PHASE_ENTRY_STATUSES as readonly string[]).includes(campaign.status)) {
    throw new ValidationError(
      `Cannot generate creative intent for campaign in status "${campaign.status}". Campaign must have a strategy first.`,
    );
  }

  // Check if valid intent already exists (avoid regenerating)
  const existing = ((campaign as any).brainData as any)?.creativeIntent as CreativeIntentData | undefined;
  if (existing?.status === "approved") {
    throw new ValidationError("This campaign already has an approved creative direction. Revoke approval before regenerating.");
  }

  // Deduct credits before AI call — [C3-STANDALONE] idempotency: one charge per campaign creative intent
  await deductCredits(workspaceId, "creative_brief", log, campaignId ?? undefined, undefined, undefined, undefined, `ws:${workspaceId}:creative_intent:${campaignId}`);

  // Get campaign brain for context
  const brain = await getCampaignBrain(campaignId);
  const intake = (campaign.intakeData ?? {}) as Record<string, unknown>;

  const prompt = buildIntentPrompt(campaign, brain, intake);

  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "strategy",
    systemPrompt: `Você é o Diretor de Arte Estratégico do NexOS. Você cria direções criativas conceituais — como um diretor de arte sênior de uma grande agência — antes da produção final. Gere direções distintas, não similares entre si. Cada direção representa uma filosofia criativa diferente. Responda APENAS com JSON válido.`,
    messages: [{ role: "user", content: prompt }],
    log,
  });

  const parsed = parseAgentJSON<{ drafts: Partial<CreativeDraft>[] }>(result.content, { drafts: [] });
  if (!parsed?.drafts || !Array.isArray(parsed.drafts)) {
    throw new ValidationError("Failed to generate creative directions — AI response invalid");
  }

  const drafts: CreativeDraft[] = parsed.drafts.slice(0, 3).map((d, i) => ({
    index: i,
    title:              String(d.title              ?? `Direção ${["A", "B", "C"][i]}`),
    archetype:          String(d.archetype          ?? "aspiration"),
    hook:               String(d.hook               ?? ""),
    tone:               String(d.tone               ?? "empática"),
    dominantEmotion:    String(d.dominantEmotion    ?? "curiosidade"),
    visualStyle:        String(d.visualStyle        ?? ""),
    rhythm:             String(d.rhythm             ?? "acelerado"),
    cta:                String(d.cta                ?? ""),
    narrativeFraming:   String(d.narrativeFraming   ?? ""),
    platformFit:        Array.isArray(d.platformFit) ? d.platformFit.map(String) : ["instagram"],
    confidenceScore:    Math.min(100, Math.max(0, Number(d.confidenceScore    ?? 75))),
    icpAlignment:       Math.min(100, Math.max(0, Number(d.icpAlignment       ?? 70))),
    retentionPrediction:Math.min(100, Math.max(0, Number(d.retentionPrediction ?? 65))),
    keyInsight:         String(d.keyInsight ?? ""),
    risk:               String(d.risk ?? ""),
    creditCost:         FINAL_GENERATION_ESTIMATE.full_campaign,
  }));

  const intentData: CreativeIntentData = {
    status: "pending_approval",
    generatedAt: new Date().toISOString(),
    approvedDraftIndex: null,
    approvedAt: null,
    drafts,
    creditsSpent: INTENT_CREDIT_COST,
  };

  // Merge into brainData
  const currentBrain = ((campaign as any).brainData ?? {}) as Record<string, unknown>;
  await db
    .update(campaignsTable)
    .set({ brainData: { ...currentBrain, creativeIntent: intentData } } as any)
    .where(eq(campaignsTable.id, campaignId));

  log.info({ campaignId, draftCount: drafts.length }, "Creative intent generated");
  return intentData;
}

export async function getCreativeIntent(
  campaignId: string,
  workspaceId: string,
): Promise<CreativeIntentData | null> {
  const [campaign] = await db
    .select({ brainData: (campaignsTable as any).brainData, workspaceId: campaignsTable.workspaceId })
    .from(campaignsTable)
    .where(eq(campaignsTable.id, campaignId))
    .limit(1);

  if (!campaign || campaign.workspaceId !== workspaceId) throw new NotFoundError("Campaign");

  const intent = (campaign.brainData as any)?.creativeIntent as CreativeIntentData | undefined;
  return intent ?? null;
}

export async function approveCreativeDraft(
  campaignId:  string,
  workspaceId: string,
  draftIndex:  number,
  log:         Logger,
): Promise<CreativeIntentData> {
  const [campaign] = await db
    .select()
    .from(campaignsTable)
    .where(eq(campaignsTable.id, campaignId))
    .limit(1);

  if (!campaign || campaign.workspaceId !== workspaceId) throw new NotFoundError("Campaign");

  const currentBrain = ((campaign as any).brainData ?? {}) as Record<string, unknown>;
  const intent = (currentBrain.creativeIntent ?? null) as CreativeIntentData | null;

  if (!intent) throw new ValidationError("No creative intent found. Generate creative directions first.");
  if (draftIndex < 0 || draftIndex >= intent.drafts.length) {
    throw new ValidationError(`Invalid draft index ${draftIndex}. Must be 0–${intent.drafts.length - 1}.`);
  }

  const updated: CreativeIntentData = {
    ...intent,
    status: "approved",
    approvedDraftIndex: draftIndex,
    approvedAt: new Date().toISOString(),
  };

  await db
    .update(campaignsTable)
    .set({ brainData: { ...currentBrain, creativeIntent: updated } } as any)
    .where(eq(campaignsTable.id, campaignId));

  log.info({ campaignId, draftIndex, title: intent.drafts[draftIndex]?.title }, "Creative direction approved");
  return updated;
}

export async function revokeCreativeApproval(
  campaignId:  string,
  workspaceId: string,
  log:         Logger,
): Promise<void> {
  const [campaign] = await db
    .select()
    .from(campaignsTable)
    .where(eq(campaignsTable.id, campaignId))
    .limit(1);

  if (!campaign || campaign.workspaceId !== workspaceId) throw new NotFoundError("Campaign");

  const currentBrain = ((campaign as any).brainData ?? {}) as Record<string, unknown>;
  const intent = (currentBrain.creativeIntent ?? null) as CreativeIntentData | null;
  if (!intent) return;

  const updated: CreativeIntentData = {
    ...intent,
    status: "pending_approval",
    approvedDraftIndex: null,
    approvedAt: null,
  };

  await db
    .update(campaignsTable)
    .set({ brainData: { ...currentBrain, creativeIntent: updated } } as any)
    .where(eq(campaignsTable.id, campaignId));

  log.info({ campaignId }, "Creative direction approval revoked");
}

/**
 * Called by execution.routes.ts — returns the approved direction as context string
 * for injection into content generation agents.
 */
export function getApprovedDirectionContext(intent: CreativeIntentData | null): string | null {
  if (!intent || intent.status !== "approved" || intent.approvedDraftIndex == null) return null;
  const draft = intent.drafts[intent.approvedDraftIndex];
  if (!draft) return null;

  return `
## DIREÇÃO CRIATIVA APROVADA PELO USUÁRIO
Título: ${draft.title}
Arquétipo: ${draft.archetype}
Hook de abertura: "${draft.hook}"
Tom: ${draft.tone}
Emoção dominante: ${draft.dominantEmotion}
Estilo visual: ${draft.visualStyle}
Ritmo: ${draft.rhythm}
CTA principal: ${draft.cta}
Enquadramento narrativo: ${draft.narrativeFraming}
Plataformas-alvo: ${draft.platformFit.join(", ")}
Confidence Score: ${draft.confidenceScore}/100 | ICP Alignment: ${draft.icpAlignment}% | Retenção prevista: ${draft.retentionPrediction}%

INSTRUÇÃO: Todos os criativos, copies e peças de conteúdo DEVEM respeitar esta direção aprovada. Não desvie do tom, emoção, ritmo e estilo definidos aqui.`.trim();
}

// ─── Prompt builder ──────────────────────────────────────────────────────────

function buildIntentPrompt(
  campaign: Record<string, unknown>,
  brain: any,
  intake: Record<string, unknown>,
): string {
  const product      = String(intake["product.name"] ?? "produto");
  const price        = Number(intake["product.price"] ?? 0);
  const positioning  = brain?.offer?.positioning ?? "accessible";
  const icp          = brain?.icp?.description ?? String(intake["campaign.targetAudience"] ?? "audiência não definida");
  const awareness    = brain?.icp?.sophisticationLevel ?? "problem_aware";
  const tone         = brain?.narrative?.tone ?? "empática";
  const emotion      = brain?.narrative?.dominantEmotion ?? "curiosidade";
  const mechanism    = brain?.offer?.uniqueMechanism ?? String(intake["product.uniqueMechanism"] ?? "");
  const track        = String((campaign as any).track ?? "six_digits");
  const platforms    = String(intake["campaign.platforms"] ?? "instagram, facebook");

  return `
## BRIEFING DE CAMPANHA
- Produto: ${product}
- Preço: R$${price}
- Posicionamento: ${positioning}
- ICP: ${icp}
- Nível de awareness: ${awareness}
- Tom base aprovado: ${tone}
- Emoção dominante: ${emotion}
- Mecanismo único: ${mechanism || "não definido"}
- Track: ${track}
- Plataformas: ${platforms}

## TAREFA
Crie 3 DIREÇÕES CRIATIVAS CONCEITUAIS distintas para esta campanha.
Cada direção deve representar uma filosofia criativa diferente — não variações do mesmo conceito.

REGRAS:
- Direção A: mais assertiva / direta / transformacional
- Direção B: mais emocional / narrativa / identitária
- Direção C: mais intrigante / curiosidade / contraintuitiva
- Todas devem respeitar o posicionamento ${positioning}
- Se premium: NUNCA usar desespero ou urgência barata
- Hooks devem ser concretos e específicos, não genéricos
- confidenceScore = estimativa honesta de fit com ICP + contexto de mercado (0-100)
- icpAlignment = % de fit emocional/psicológico com o ICP descrito
- retentionPrediction = % estimada de retenção de audiência nos primeiros 5 segundos

Responda com JSON:
{
  "drafts": [
    {
      "title": "Direção A: [nome evocativo]",
      "archetype": "authority|aspiration|fear_removal|curiosity|community",
      "hook": "frase de abertura específica (primeiros 3 segundos)",
      "tone": "tom em 1 palavra",
      "dominantEmotion": "emoção dominante",
      "visualStyle": "descrição do estilo visual em 2-3 frases (cores, energia, pace, referências)",
      "rhythm": "acelerado|reflexivo|dramático|provocador",
      "cta": "CTA principal desta direção",
      "narrativeFraming": "enquadramento da narrativa em 2 frases",
      "platformFit": ["instagram", "tiktok"],
      "confidenceScore": 82,
      "icpAlignment": 88,
      "retentionPrediction": 79,
      "keyInsight": "por que esta abordagem pode funcionar neste contexto",
      "risk": "principal risco desta direção"
    }
  ]
}`.trim();
}
