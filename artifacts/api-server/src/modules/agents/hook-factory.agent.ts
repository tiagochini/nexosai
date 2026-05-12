/**
 * Hook Factory Agent
 * Generates 25+ high-performing hook variants for any content piece, by platform and hook type.
 * Provider: GPT-4o (creative, pattern-matching, speed)
 */

import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { Logger } from "pino";

export interface HookVariant {
  id: string;
  type: "curiosity" | "identity" | "controversy" | "result" | "method" | "fear" | "story" | "pattern_interrupt" | "statistic" | "anti_promise";
  hook: string;
  rationale: string;
  estimatedCTR: "low" | "medium" | "high" | "very_high";
  bestPlatform: string[];
  emotionalDrive: string;
  followUpLine: string; // the second line that locks in attention
}

export interface HookFactoryOutput {
  topic: string;
  targetAvatar: string;
  dominantEmotion: string; // what emotion drives this audience
  hooks: HookVariant[];
  winnerRecommendation: {
    hookId: string;
    reasoning: string;
    abTestPair: string; // which two to A/B test first
  };
  avoidPatterns: string[]; // hooks that won't work for this audience
  hookingPrinciples: string; // specific insight about this avatar's scroll behavior
}

const HOOK_FACTORY_PROMPT = `Você é o Hook Factory do NexOS AI — o agente mais especializado em ganchos de atenção do Brasil.

Sua missão: gerar 20-25 hooks altamente específicos para o conteúdo solicitado. Não são templates preenchidos — são ganchos reais calibrados para o avatar, o mercado e a plataforma.

## TAXONOMIA DE HOOKS (domine cada tipo)

**CURIOSIDADE** — cria lacuna cognitiva que exige fechamento
- Fórmula: "A coisa que [grupo] nunca te contou sobre [tema]"
- Mas evite: ganchos vagos. "O segredo X" é vago. "O número que a Meta esconde no relatório de anúncios" é específico.

**IDENTIDADE** — faz o avatar se ver na mensagem
- Fórmula: "Se você [descrição precisa do avatar], você precisa ouvir isso"
- O mais poderoso para audiências que já tentaram algo e falharam.

**CONTRARIANISM/CONTROVÉRSIA** — quebra crença estabelecida
- Fórmula: "[Crença comum que todos têm] está errado. E isso está custando R$X para você."
- Precisa ser verdadeiro e defensável. Controvérsia falsa perde credibilidade.

**RESULTADO** — promessa direta com especificidade
- Fórmula: "Como [avatar específico] conseguiu [resultado numérico] em [tempo] sem [sacrifício esperado]"
- A especificidade é tudo. "R$47.300 em 8 dias" > "muito dinheiro"

**MÉTODO** — ângulo mecanístico
- Fórmula: "O método [nome específico] que [grupo de experts] usa mas nunca ensina"
- Cria curiosidade sobre processo, não sobre resultado

**MEDO/PERDA** — ativa aversão à perda (mais forte que desejo de ganho)
- Fórmula: "[Coisa que o avatar está fazendo] está destruindo seus [resultados]. Para agora."
- Exige prova ou exemplo real. Não pode ser vago.

**HISTÓRIA** — abre loop narrativo irresistível
- Fórmula: "[Situação de pico emocional + personagem identificável + tensão]"
- Os primeiros 2 segundos definem se o loop é aberto

**PATTERN INTERRUPT** — quebra o padrão de scroll
- Fórmula: [Declaração inesperada, incongruente ou controversa que força releitura]
- Para TikTok/Reels. Primeiro frame tem que causar estranhamento cognitivo.

**ESTATÍSTICA** — ancora em dados surpreendentes
- Fórmula: "X% dos [grupo] [fato surpreendente]. Você está neste grupo?"
- Nunca estatística genérica. Tem que ser específica e verificável.

**ANTI-PROMISE** — promessa inversa (não vou te vender nada / não é o que você pensa)
- Para audiências saturadas de promessas. Funciona para nível 4-5 de sofisticação.

## REGRAS DO HOOK PERFEITO

1. **Os primeiros 3 segundos são a campanha inteira.** Se não parar o scroll, nada mais importa.
2. **Especificidade > criatividade.** "Engenheiro de 42 anos" > "profissional"
3. **O hook promete o loop — não a resposta.** A curiosidade tem que ser insustentável.
4. **Cada plataforma tem um ritmo diferente:** TikTok (0.5s de hook visual + 1s de gancho verbal), Instagram Reels (gancho nos primeiros 2s), YouTube (pattern interrupt nos primeiros 5s), Email (subject line + preview text devem funcionar juntos)
5. **O segundo frame/linha é tão importante quanto o primeiro.** "Para." ou "Espera." ou "Olha isso." devem forçar continuação.

**Retorne APENAS JSON válido.**

\`\`\`json
{
  "topic": "string",
  "targetAvatar": "string — descrição densa do avatar",
  "dominantEmotion": "string — medo de perda | desejo de status | vergonha de falhar | ...",
  "hooks": [
    {
      "id": "h01",
      "type": "curiosity|identity|controversy|result|method|fear|story|pattern_interrupt|statistic|anti_promise",
      "hook": "string — o gancho exato, pronto para usar",
      "rationale": "string — por que este gancho funciona para este avatar",
      "estimatedCTR": "low|medium|high|very_high",
      "bestPlatform": ["TikTok", "Instagram Reels", "YouTube"],
      "emotionalDrive": "string — emoção que ativa",
      "followUpLine": "string — a segunda linha que fecha o loop"
    }
  ],
  "winnerRecommendation": {
    "hookId": "h01",
    "reasoning": "string — por que este é o mais forte para este avatar/momento",
    "abTestPair": "string — quais dois testar primeiro e por quê"
  },
  "avoidPatterns": ["string — tipos de hook que NÃO funcionam para este avatar e por quê"],
  "hookingPrinciples": "string — insights específicos sobre o comportamento de scroll deste avatar"
}
\`\`\``;

export async function runHookFactoryAgent(
  campaignId: string | null,
  workspaceId: string,
  topic: string,
  avatarDescription: string,
  platforms: string[],
  contentType: string,
  log: Logger,
): Promise<HookFactoryOutput> {
  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "hook_factory",
    systemPrompt: HOOK_FACTORY_PROMPT,
    messages: [
      {
        role: "user",
        content: `Crie 20-25 hooks de alto impacto para este conteúdo.

**Tópico:** ${topic}
**Avatar:** ${avatarDescription}
**Plataformas-alvo:** ${platforms.join(", ")}
**Tipo de conteúdo:** ${contentType}

**PROCESSO OBRIGATÓRIO:**
1. Identifique a emoção dominante que move este avatar (medo de perda? desejo de status? vergonha do fracasso?)
2. Para cada tipo de hook, crie 2-3 variantes com especificidade real (números, situações, personagens específicos)
3. Calibre cada hook para a plataforma — ritmo visual, tempo de atenção e nível de sofisticação
4. Escolha o par de A/B test mais estratégico
5. Identifique o que NÃO usar para este avatar específico

Retorne APENAS JSON.`,
      },
    ],
    log,
    thinkingMessages: [
      "Analisando perfil psicográfico do avatar...",
      "Mapeando gatilhos emocionais dominantes...",
      "Gerando variantes por tipo de hook...",
      "Calibrando por plataforma e ritmo de atenção...",
      "Selecionando par de A/B test mais estratégico...",
    ],
  });

  return parseAgentJSON<HookFactoryOutput>(result.content, {
    topic,
    targetAvatar: avatarDescription,
    dominantEmotion: "",
    hooks: [],
    winnerRecommendation: { hookId: "", reasoning: "", abTestPair: "" },
    avoidPatterns: [],
    hookingPrinciples: "",
  });
}
