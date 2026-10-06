/**
 * Ethics Autocorrect Agent
 *
 * Triggered when content generation fails with a COMPLIANCE_VIOLATION error.
 * Analyzes the failing piece type + strategy context, generates a compliance-safe
 * rewrite directive, and stores it in brainData so the next retry uses it.
 * Also auto-resets the intervention lock so the pipeline resumes without
 * human intervention when possible.
 *
 * Non-blocking: always called via setImmediate / fire-and-forget.
 */

import { eq, and } from "drizzle-orm";
import { db, campaignsTable } from "@workspace/db";
import { completeWithAgent } from "../ai-gateway/ai-gateway.service.js";
import type { Logger } from "pino";

export async function runEthicsAutocorrect(
  campaignId: string,
  workspaceId: string,
  pieceType: string,
  agentName: string,
  errorMessage: string,
  strategyData: Record<string, unknown>,
  intakeData: Record<string, unknown>,
  log: Logger,
): Promise<void> {
  log.info({ campaignId, pieceType, agentName }, "[ETHICS-AUTOCORRECT] Starting compliance rewrite analysis");

  // Mark autocorrection as running
  const [campaign] = await db
    .select({ brainData: campaignsTable.brainData })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);

  if (!campaign) return;

  const brainRaw = ((campaign.brainData ?? {}) as Record<string, unknown>);
  const contentRetry = ((brainRaw["contentRetry"] ?? {}) as Record<string, unknown>);

  await db
    .update(campaignsTable)
    .set({
      brainData: {
        ...brainRaw,
        contentRetry: { ...contentRetry, autocorrectionStatus: "running" },
      } as any,
    })
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)));

  const offerName = String(intakeData["offerName"] ?? intakeData["productName"] ?? "produto");
  const targetAudience = String(intakeData["targetAudience"] ?? intakeData["avatar"] ?? "audiência-alvo");
  const productPrice = String(intakeData["price"] ?? intakeData["offerPrice"] ?? "");
  const strategyJson = JSON.stringify(strategyData).slice(0, 1500);

  const systemPrompt = `Você é o Ethics & Claims Specialist da NexOS AI.

Sua missão: identificar por que um agente de conteúdo foi bloqueado por filtros de compliance (Meta Ads, Google Ads, CONAR, filtros de segurança da OpenAI/Anthropic) e gerar diretrizes de reescrita que eliminem o problema sem perder a força persuasiva.

REGRAS:
- Nunca use claims de renda específica ("Ganhe R$X/mês", "Fature R$X em Y dias")
- Substitua por transformações verificáveis ("Clientes que aplicaram este método relatam...")
- Use "Empatia Estrutural": mostre que você entende a dor antes de apresentar a solução
- Use "Mecanismo Lógico": explique o PORQUÊ funciona, não apenas que funciona
- Mantenha urgência sem falsas escassezes ("Turma X está quase no limite" sem número exato)
- Testemunhos precisam de disclaimer implícito ("resultados variam conforme dedicação")`;

  const userMessage = `Um agente de conteúdo do tipo "${pieceType}" falhou com o seguinte erro:

ERRO: ${errorMessage.slice(0, 400)}

CONTEXTO DO PRODUTO:
- Nome: ${offerName}
- Audiência: ${targetAudience}
- Preço: ${productPrice || "não informado"}

ESTRATÉGIA (resumo):
${strategyJson}

Gere um JSON com as diretrizes de reescrita para destravar este agente:
{
  "complianceIssues": ["issue1", "issue2"],
  "avoidPhrases": ["frase problemática 1", "frase problemática 2"],
  "useInstead": ["alternativa segura 1", "alternativa segura 2"],
  "rewriteDirective": "Instrução clara de uma frase para o agente: como deve reformular o conteúdo para ser aprovado",
  "toneAdjustment": "transformacional|educativo|empatico|inspiracional",
  "platformNotes": "notas específicas para Meta Ads / CONAR"
}`;

  let directive = "";
  try {
    const result = await completeWithAgent(
      "compliance",
      systemPrompt,
      [{ role: "user", content: userMessage }],
      workspaceId,
      log,
      undefined,
    );

    const raw = result.content;
    // Extract JSON
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as Record<string, unknown>;
      directive = String(parsed["rewriteDirective"] ?? "");
      const avoidList = (parsed["avoidPhrases"] as string[] | undefined) ?? [];
      const useList = (parsed["useInstead"] as string[] | undefined) ?? [];
      const platformNotes = String(parsed["platformNotes"] ?? "");

      if (directive) {
        directive = `[COMPLIANCE OVERRIDE — ${pieceType}]\n${directive}\n\nEvitar: ${avoidList.join("; ")}\nUsar em vez: ${useList.join("; ")}\n${platformNotes ? `Notas plataforma: ${platformNotes}` : ""}`;
      }
    }
  } catch (err) {
    log.warn({ err, campaignId, pieceType }, "[ETHICS-AUTOCORRECT] AI call failed — using generic compliance fallback");
    directive = `[COMPLIANCE OVERRIDE — ${pieceType}]\nEvite claims de renda específica. Use linguagem de transformação e resultado verificável. Foque no mecanismo, não no número. Testemunhos com disclaimer implícito.`;
  }

  if (!directive) {
    directive = `[COMPLIANCE OVERRIDE — ${pieceType}]\nConteúdo bloqueado por filtro de segurança. Reescreva focando em transformação, mecanismo lógico e empatia estrutural. Evite: promessas de ganho específico, linguagem hiperbólica, urgência fabricada.`;
  }

  // Re-read brainData (may have changed during AI call)
  const [refreshed] = await db
    .select({ brainData: campaignsTable.brainData })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);

  if (!refreshed) return;

  const brainFresh = ((refreshed.brainData ?? {}) as Record<string, unknown>);
  const retryFresh = ((brainFresh["contentRetry"] ?? {}) as Record<string, unknown>);
  const existingCorrections = ((retryFresh["complianceCorrections"] ?? {}) as Record<string, string>);

  await db
    .update(campaignsTable)
    .set({
      brainData: {
        ...brainFresh,
        contentRetry: {
          ...retryFresh,
          retryCount: 0,
          requiresIntervention: false,
          autocorrectionStatus: "done",
          lastAutocorrectedAt: new Date().toISOString(),
          lastAutocorrectionType: "COMPLIANCE_VIOLATION",
          complianceCorrections: {
            ...existingCorrections,
            [pieceType]: directive,
          },
        },
      } as any,
    })
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)));

  log.info({ campaignId, pieceType }, "[ETHICS-AUTOCORRECT] Compliance directive stored — intervention lock released, retry ready");
}
