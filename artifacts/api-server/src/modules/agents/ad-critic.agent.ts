/**
 * Ad Critic Agent
 * Pre-launch creative review: scores ad creatives before spending money.
 * Evaluates hook strength, clarity, CTA, brand safety, policy compliance.
 * Provider: GPT-4o (pattern recognition, creative assessment)
 */

import { runAgent, parseAgentJSON } from "./agent.runner.js";
import { type AgentAction } from "./agent-brain.js";
import type { Logger } from "pino";

export interface CreativeScore {
  dimension: "hook_strength" | "clarity" | "cta_power" | "visual_concept" | "audience_fit" | "policy_risk" | "emotional_resonance" | "pattern_interrupt";
  score: number;      // 0-10
  rationale: string;
  improvement: string; // specific fix
}

export interface AdCriticOutput {
  creative: string;          // what was evaluated
  platform: string;
  overallScore: number;      // weighted average 0-100
  verdict: "kill" | "fix_before_launch" | "launch_with_caution" | "strong" | "exceptional";
  executiveSummary: string;  // 2-sentence verdict
  scores: CreativeScore[];
  criticalIssues: string[];  // issues that will prevent the ad from performing
  quickFixes: string[];      // changes that take <30min and increase score significantly
  strongPoints: string[];    // what is already working well (don't change)
  policyRisks: {
    platform: string;
    riskLevel: "none" | "low" | "medium" | "high" | "certain_rejection";
    issue: string;
    fix: string;
  }[];
  rewrittenHook?: string;    // if hook score < 6, provide rewritten version
  abTestRecommendation: string; // specific variant to test against this creative
  actions: AgentAction[];   // system actions based on critique
}

const AD_CRITIC_PROMPT = `Você é o Agente Ad Critic do NexOS AI — o mais rigoroso avaliador de criativos de anúncios do Brasil.

Sua missão: destruir criativos fracos ANTES de eles consumirem budget. Você salva campanhas inteiras ao identificar o que vai falhar antes de entrar ao ar.

## FRAMEWORK DE AVALIAÇÃO

### 1. HOOK STRENGTH (Peso 30%)
Os primeiros 3 segundos determinam se o anúncio terá chance. Avalie:
- Para vídeo: o primeiro frame para o scroll? O primeiro segundo cria lacuna cognitiva?
- Para estático: o headline/imagem principal cria curiosidade ou desejo imediato?
- Benchmark: um hook score de 8+ significa CTR >2.5% esperado.

**Sinais de hook fraco:**
- Começa com nome da marca/logo (ninguém se importa)
- Começa com contexto ("Olá, sou [nome] e hoje vou falar sobre...")
- Promessa genérica que poderia ser de qualquer concorrente
- Não há tensão nos primeiros 3 segundos

**Sinais de hook forte:**
- Primeira palavra/frame cria estranhamento ou curiosidade
- Específico o suficiente para o avatar se reconhecer imediatamente
- Levanta uma questão que o avatar precisa responder
- Pattern interrupt visual ou verbal

### 2. CLARITY (Peso 20%)
Em 5 segundos, o avatar sabe exatamente para quem é o anúncio, o que está sendo oferecido e qual ação tomar?

### 3. CTA POWER (Peso 15%)
O CTA é específico e cria urgência? "Saiba mais" é fraco. "Garanta sua vaga antes de fechar" é forte.

### 4. AUDIENCE FIT (Peso 15%)
O nível de sofisticação da linguagem, referências e humor bate com o avatar?

### 5. EMOTIONAL RESONANCE (Peso 10%)
Toca em dor real ou desejo real? Ou é informativo/neutro demais?

### 6. POLICY RISK (Peso 10%)
Promessas de renda garantida, afirmações de saúde sem respaldo, preços sem clareza — Meta e Google rejeitam automaticamente.

## REGRAS DE VERDICT
- Score 80+: STRONG ou EXCEPTIONAL — launch agora
- Score 65-79: LAUNCH WITH CAUTION — faça os quick fixes primeiro
- Score 50-64: FIX BEFORE LAUNCH — correções significativas necessárias  
- Score <50: KILL — não desperdice budget; recomece

## SOBRE AÇÕES DO SISTEMA
Se o criativo tem policy risk alto → emita ação PAUSE_CREATIVE
Se hook score < 5 → emita ação REQUEST_CREATIVE com brief do que reescrever
Se score > 80 → emita ação SCALE_BUDGET sugerindo testar com budget inicial maior

**Retorne APENAS JSON válido.**

\`\`\`json
{
  "creative": "string — descrição do criativo avaliado",
  "platform": "string — Meta|Google|TikTok",
  "overallScore": 0,
  "verdict": "kill|fix_before_launch|launch_with_caution|strong|exceptional",
  "executiveSummary": "string — veredicto em 2 frases diretas",
  "scores": [
    {
      "dimension": "hook_strength|clarity|cta_power|visual_concept|audience_fit|policy_risk|emotional_resonance|pattern_interrupt",
      "score": 0,
      "rationale": "string — por que esta nota",
      "improvement": "string — mudança específica para melhorar"
    }
  ],
  "criticalIssues": ["string — problema que vai impedir performance"],
  "quickFixes": ["string — melhoria <30min que aumenta score significativamente"],
  "strongPoints": ["string — o que NÃO mudar"],
  "policyRisks": [
    {
      "platform": "string",
      "riskLevel": "none|low|medium|high|certain_rejection",
      "issue": "string — o que viola a política",
      "fix": "string — como corrigir"
    }
  ],
  "rewrittenHook": "string — versão reescrita do hook se score < 6",
  "abTestRecommendation": "string — variante específica para testar contra este criativo",
  "actions": [
    {
      "type": "PAUSE_CREATIVE|REQUEST_CREATIVE|SCALE_BUDGET",
      "confidence": 0.0,
      "urgency": "immediate|next_12h|next_24h|next_week",
      "rationale": "string",
      "params": {},
      "requiresApproval": false,
      "estimatedImpact": "string"
    }
  ]
}
\`\`\``;

export async function runAdCriticAgent(
  campaignId: string | null,
  workspaceId: string,
  creativeDescription: string,
  platform: string,
  targetAvatar: string,
  log: Logger,
): Promise<AdCriticOutput> {
  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "ad_critic",
    systemPrompt: AD_CRITIC_PROMPT,
    messages: [
      {
        role: "user",
        content: `Avalie este criativo de anúncio com rigor máximo.

**Criativo:** ${creativeDescription}
**Plataforma:** ${platform}
**Avatar-alvo:** ${targetAvatar}

**PROCESSO:**
1. Avalie cada dimensão com nota 0-10 e justificativa específica
2. Identifique os problemas críticos que vão destruir a performance
3. Liste os quick fixes (mudanças de até 30 minutos)
4. Verifique riscos de política da plataforma
5. Se hook score < 6, reescreva o hook
6. Emita ações de sistema (PAUSE, REQUEST_CREATIVE, etc.) conforme necessário

Seja brutalmente honesto. Um criativo fraco que vai ao ar desperdiça o budget inteiro.
Retorne APENAS JSON.`,
      },
    ],
    log,
    thinkingMessages: [
      "Analisando força do hook e primeiros 3 segundos...",
      "Avaliando clareza, CTA e fit com o avatar...",
      "Verificando riscos de política das plataformas...",
      "Identificando quick fixes e recomendações...",
      "Gerando ações de sistema baseadas na análise...",
    ],
  });

  return parseAgentJSON<AdCriticOutput>(result.content, {
    creative: creativeDescription,
    platform,
    overallScore: 0,
    verdict: "fix_before_launch",
    executiveSummary: result.content,
    scores: [],
    criticalIssues: [],
    quickFixes: [],
    strongPoints: [],
    policyRisks: [],
    abTestRecommendation: "",
    actions: [],
  });
}
