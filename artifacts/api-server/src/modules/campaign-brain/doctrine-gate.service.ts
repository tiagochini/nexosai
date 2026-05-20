/**
 * Doctrine Gate — Camada 9: Validação de decisões contra a doutrina
 *
 * "Essa decisão destrói outra parte da estratégia?"
 *
 * Toda recomendação de agente passa por esta camada antes de ser aceita.
 * O Doctrine Gate verifica se o output está alinhado com:
 *   - Princípios estratégicos declarados na doutrina
 *   - Posicionamento aprovado
 *   - Promessas autorizadas
 *   - Nível de consciência da audiência
 *   - Tom e emoção dominante
 *
 * É determinístico — sem IA — validação por regras.
 * Falhas são não-bloqueantes mas reduzem confidence score e emitem alertas.
 *
 * Integration points:
 *  - command.agent.ts: fire-and-forget after each major agent completes
 *  - Writes: doctrineViolations to Campaign Brain + audit log
 */

import { db, campaignsTable, auditLogsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Logger } from "pino";
import type { CampaignBrain } from "./campaign-brain.service.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DoctrineViolation {
  principle:         string;  // Which doctrine principle was violated
  violation:         string;  // Specific violation description
  severity:          "critical" | "warning" | "info";
  agentType:         string;  // Which agent produced the violation
  suggestedCorrection: string;
  detectedAt:        string;
}

export interface DoctrineGateResult {
  passed:            boolean;
  violations:        DoctrineViolation[];
  doctrineScore:     number; // 0-100
  confidenceReduction: number; // points to reduce from agent's confidence
  checkedAt:         string;
}

// ─── Doctrine Principles (the system's beliefs) ───────────────────────────────

interface DoctrinePrinciple {
  id:       string;
  label:    string;
  check:    (output: Record<string, unknown>, brain: CampaignBrain) => DoctrineViolation | null;
}

const DOCTRINE_PRINCIPLES: DoctrinePrinciple[] = [

  // Princípio 1: Posicionamento premium proíbe desespero
  {
    id: "premium_no_desperation",
    label: "Premium não usa desespero",
    check: (output, brain) => {
      if (brain.offer.positioning !== "premium") return null;
      const outputStr = JSON.stringify(output).toLowerCase();
      const desperationSignals = ["últimas vagas", "só hoje", "corre", "depressa", "agora ou nunca", "última chance", "só por hoje"];
      const found = desperationSignals.find(s => outputStr.includes(s));
      if (!found) return null;
      return {
        principle: "premium_no_desperation",
        violation: `Produto premium (R$${brain.offer.price}) não deve usar linguagem de desespero: "${found}" destrói percepção de valor`,
        severity: "critical",
        agentType: "unknown",
        suggestedCorrection: "Substituir urgência de escassez por urgência de oportunidade: 'As últimas vagas de junho garantem acesso à mentoria individual'",
        detectedAt: new Date().toISOString(),
      };
    },
  },

  // Princípio 2: ROAS sustentável — promessas absurdas destroem credibilidade
  {
    id: "sustainable_roas_promise",
    label: "ROAS prometido deve ser sustentável",
    check: (output) => {
      const roasTarget = Number((output as any)?.projections?.roasTarget
        ?? (output as any)?.financialProjection?.roasTarget ?? 0);
      if (roasTarget <= 0 || roasTarget < 20) return null;
      return {
        principle: "sustainable_roas_promise",
        violation: `ROAS alvo de ${roasTarget.toFixed(0)}x é improvável — promessas não realizáveis destroem credibilidade e afetam CSAT`,
        severity: "warning",
        agentType: "financial_projector",
        suggestedCorrection: `Ajustar para ROAS realista de 3–8x. Para ROAS ${roasTarget.toFixed(0)}x seriam necessários criativos com CR > 15%.`,
        detectedAt: new Date().toISOString(),
      };
    },
  },

  // Princípio 3: Awareness baixo exige educação antes de venda
  {
    id: "awareness_education_first",
    label: "Awareness baixo exige educação antes de venda",
    check: (output, brain) => {
      if (brain.icp.awarenessScore > 1) return null; // problem_aware+ → OK to present solution
      const outputStr = JSON.stringify(output).toLowerCase();
      // Check for direct sales language in a low-awareness campaign
      const directSalesSignals = ["compre agora", "adquira", "clique aqui e compre", "vagas abertas"];
      const found = directSalesSignals.find(s => outputStr.includes(s));
      if (!found) return null;
      return {
        principle: "awareness_education_first",
        violation: `Audiência com awareness ${brain.icp.sophisticationLevel} não está pronta para CTA direto de venda — precisa primeiro entender que tem um problema`,
        severity: "warning",
        agentType: "unknown",
        suggestedCorrection: "Sequência: Problema → Consequências → Solução possível → Seu mecanismo → Oferta. CTA direto só na fase de carrinho.",
        detectedAt: new Date().toISOString(),
      };
    },
  },

  // Princípio 4: ROAS ruim no dia 1 não mata campanha
  {
    id: "roas_day1_tolerance",
    label: "Dia 1 de campanha tem ROAS baixo esperado",
    check: (output, brain) => {
      const dayIndex = Number((output as any)?.dayIndex ?? -1);
      if (dayIndex > 3 || dayIndex < 0) return null; // só aplica dias 1–3
      const verdict = String((output as any)?.verdict ?? (output as any)?.overallVerdict ?? "").toLowerCase();
      if (verdict.includes("pausar") || verdict.includes("cancelar")) {
        return {
          principle: "roas_day1_tolerance",
          violation: `Recomendar pause/cancelamento no dia ${dayIndex} é prematuro — ROAS baixo no início do lançamento é esperado enquanto o pixel aprende`,
          severity: "warning",
          agentType: "optimization",
          suggestedCorrection: "Aguardar dias 3–5 antes de qualquer decision de pause. Monitorar frequência e CPM como proxies antes do ROAS.",
          detectedAt: new Date().toISOString(),
        };
      }
      return null;
    },
  },

  // Princípio 5: Frequência alta destrói percepção
  {
    id: "frequency_perception_risk",
    label: "Frequência alta destrói percepção de marca",
    check: (output) => {
      const frequency = Number((output as any)?.campaignStructure?.targetFrequency
        ?? (output as any)?.adFrequency ?? 0);
      if (frequency <= 0 || frequency < 5) return null;
      return {
        principle: "frequency_perception_risk",
        violation: `Frequência alvo de ${frequency.toFixed(1)}x por dia é alta — acima de 4x/dia impacta percepção e aumenta CPM por queda de relevância`,
        severity: frequency >= 8 ? "critical" : "warning",
        agentType: "media_buyer",
        suggestedCorrection: "Manter frequência entre 2–4x para awareness. Usar exclusão de público convertido para não desgastar compradores.",
        detectedAt: new Date().toISOString(),
      };
    },
  },

  // Princípio 6: Promessa deve ser sustentável — verificar forbidden topics
  {
    id: "promise_within_bounds",
    label: "Promessa dentro dos limites autorizados",
    check: (output, brain) => {
      if (brain.narrative.forbiddenTopics.length === 0) return null;
      const outputStr = JSON.stringify(output).toLowerCase();
      const violated = brain.narrative.forbiddenTopics.find(topic =>
        outputStr.includes(topic.toLowerCase()),
      );
      if (!violated) return null;
      return {
        principle: "promise_within_bounds",
        violation: `Output contém tópico proibido pela doutrina: "${violated}" — pode causar problemas de compliance`,
        severity: "critical",
        agentType: "unknown",
        suggestedCorrection: `Remover referências a "${violated}". Tópicos proibidos configurados no onboarding por razões jurídicas ou estratégicas.`,
        detectedAt: new Date().toISOString(),
      };
    },
  },

  // Princípio 7: Tom consistente entre agentes
  {
    id: "tone_consistency",
    label: "Tom consistente entre agentes",
    check: (output, brain) => {
      if (!brain.narrative.tone) return null;
      const outputStr = JSON.stringify(output).toLowerCase();
      // If approved tone is "authority" but output uses casual/slang language
      if (brain.narrative.tone === "authority" && (outputStr.includes("galera") || outputStr.includes("mano,") || outputStr.includes("né?"))) {
        return {
          principle: "tone_consistency",
          violation: `Tom aprovado é '${brain.narrative.tone}' mas output contém linguagem casual — inconsistência de voz da marca`,
          severity: "warning",
          agentType: "copywriter",
          suggestedCorrection: `Revisar linguagem para tom '${brain.narrative.tone}'. Evitar gírias e expressões coloquiais que contrastem com a autoridade posicionada.`,
          detectedAt: new Date().toISOString(),
        };
      }
      return null;
    },
  },
];

// ─── Main Gate ─────────────────────────────────────────────────────────────────

export async function runDoctrineGate(
  campaignId:  string,
  workspaceId: string,
  agentType:   string,
  agentOutput: Record<string, unknown>,
  brain:       CampaignBrain,
  log:         Logger,
): Promise<DoctrineGateResult> {
  const violations: DoctrineViolation[] = [];
  const now = new Date().toISOString();

  for (const principle of DOCTRINE_PRINCIPLES) {
    try {
      const result = principle.check(agentOutput, brain);
      if (result) {
        result.agentType = agentType;
        violations.push(result);
      }
    } catch {
      // Principle check errors must never crash the gate
    }
  }

  const criticalCount = violations.filter(v => v.severity === "critical").length;
  const warningCount  = violations.filter(v => v.severity === "warning").length;

  const doctrineScore = Math.max(0,
    100 - criticalCount * 20 - warningCount * 8,
  );
  const confidenceReduction = criticalCount * 15 + warningCount * 5;
  const passed = criticalCount === 0;

  const result: DoctrineGateResult = {
    passed, violations, doctrineScore, confidenceReduction, checkedAt: now,
  };

  if (violations.length > 0) {
    log.warn({
      campaignId, agentType,
      critical: criticalCount, warnings: warningCount,
      doctrineScore,
      topViolation: violations[0]?.principle,
    }, "Doctrine Gate: violations detected");

    // Write to audit log (non-blocking)
    db.insert(auditLogsTable).values({
      workspaceId,
      campaignId,
      action: "doctrine.gate.violation",
      actor:  agentType,
      data: { violations, doctrineScore, confidenceReduction },
    }).catch(() => {});
  } else {
    log.info({ campaignId, agentType, doctrineScore }, "Doctrine Gate: passed");
  }

  return result;
}

/**
 * Lightweight wrapper — fire-and-forget from command.agent.ts
 */
export function checkDoctrineAsync(
  campaignId:  string,
  workspaceId: string,
  agentType:   string,
  agentOutput: Record<string, unknown>,
  brain:       CampaignBrain,
  log:         Logger,
): void {
  setImmediate(() => {
    runDoctrineGate(campaignId, workspaceId, agentType, agentOutput, brain, log)
      .catch((err: unknown) => {
        log.warn({ err, campaignId, agentType }, "Doctrine Gate failed — non-blocking");
      });
  });
}
