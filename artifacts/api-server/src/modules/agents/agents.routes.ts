import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../auth/auth.middleware.js";
import { orchestrateCampaign } from "./command.agent.js";
import { completeWithAgent, type AgentRole } from "../ai-gateway/ai-gateway.service.js";
import { AppError } from "../../lib/errors.js";
import { eq, and, desc } from "drizzle-orm";
import {
  db,
  campaignAgentsTable,
  approvalCheckpointsTable,
  campaignsTable,
  auditLogsTable,
  workspacesTable,
} from "@workspace/db";

const router = Router();
router.use(requireAuth);

router.post("/:campaignId/orchestrate", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;

  try {
    const result = await orchestrateCampaign(
      campaignId,
      req.auth.workspaceId,
      req.log,
    );
    res.json({ message: "Orchestration completed", result });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

router.get("/:campaignId/agents", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;

  try {
    const [campaign] = await db
      .select({ id: campaignsTable.id })
      .from(campaignsTable)
      .where(
        and(
          eq(campaignsTable.id, campaignId),
          eq(campaignsTable.workspaceId, req.auth.workspaceId),
        ),
      )
      .limit(1);

    if (!campaign) {
      res.status(404).json({ error: "Campaign not found", code: "NOT_FOUND" });
      return;
    }

    const agents = await db
      .select()
      .from(campaignAgentsTable)
      .where(eq(campaignAgentsTable.campaignId, campaignId))
      .orderBy(campaignAgentsTable.createdAt);

    const checkpoints = await db
      .select()
      .from(approvalCheckpointsTable)
      .where(eq(approvalCheckpointsTable.campaignId, campaignId))
      .orderBy(desc(approvalCheckpointsTable.createdAt));

    res.json({ agents, checkpoints });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

const approveSchema = z.object({
  checkpointId: z.string().uuid(),
  approved: z.boolean(),
  feedback: z.string().optional(),
});

router.post("/:campaignId/approve", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;

  const parsed = approveSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  try {
    const [campaign] = await db
      .select({ id: campaignsTable.id })
      .from(campaignsTable)
      .where(
        and(
          eq(campaignsTable.id, campaignId),
          eq(campaignsTable.workspaceId, req.auth.workspaceId),
        ),
      )
      .limit(1);

    if (!campaign) {
      res.status(404).json({ error: "Campaign not found", code: "NOT_FOUND" });
      return;
    }

    const [checkpoint] = await db
      .select()
      .from(approvalCheckpointsTable)
      .where(
        and(
          eq(approvalCheckpointsTable.id, parsed.data.checkpointId),
          eq(approvalCheckpointsTable.campaignId, campaignId),
        ),
      )
      .limit(1);

    if (!checkpoint) {
      res.status(404).json({ error: "Checkpoint not found", code: "NOT_FOUND" });
      return;
    }

    if (checkpoint.status !== "pending") {
      res.status(400).json({
        error: `Checkpoint already ${checkpoint.status}`,
        code: "VALIDATION_ERROR",
      });
      return;
    }

    const newStatus = parsed.data.approved ? "approved" : "rejected";

    const [updatedCheckpoint] = await db
      .update(approvalCheckpointsTable)
      .set({
        status: newStatus,
        approvedAt: parsed.data.approved ? new Date() : null,
        userFeedback: parsed.data.feedback,
      })
      .where(eq(approvalCheckpointsTable.id, parsed.data.checkpointId))
      .returning();

    await db.insert(auditLogsTable).values({
      workspaceId: req.auth.workspaceId,
      campaignId,
      action: parsed.data.approved ? "checkpoint.approved" : "checkpoint.rejected",
      actor: "user",
      data: {
        checkpointId: parsed.data.checkpointId,
        type: checkpoint.checkpointType,
        feedback: parsed.data.feedback,
      },
    });

    const pendingCheckpoints = await db
      .select({ id: approvalCheckpointsTable.id })
      .from(approvalCheckpointsTable)
      .where(
        and(
          eq(approvalCheckpointsTable.campaignId, campaignId),
          eq(approvalCheckpointsTable.status, "pending"),
        ),
      );

    if (pendingCheckpoints.length === 0 && parsed.data.approved) {
      await db
        .update(campaignsTable)
        .set({ status: "approved" })
        .where(eq(campaignsTable.id, campaignId));
    }

    res.json({
      checkpoint: updatedCheckpoint,
      message: parsed.data.approved
        ? "Checkpoint approved"
        : "Checkpoint rejected",
    });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

router.get("/:campaignId/checkpoints", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;

  try {
    const [campaign] = await db
      .select({ id: campaignsTable.id })
      .from(campaignsTable)
      .where(
        and(
          eq(campaignsTable.id, campaignId),
          eq(campaignsTable.workspaceId, req.auth.workspaceId),
        ),
      )
      .limit(1);

    if (!campaign) {
      res.status(404).json({ error: "Campaign not found", code: "NOT_FOUND" });
      return;
    }

    const checkpoints = await db
      .select()
      .from(approvalCheckpointsTable)
      .where(eq(approvalCheckpointsTable.campaignId, campaignId))
      .orderBy(desc(approvalCheckpointsTable.createdAt));

    res.json({ checkpoints });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

// ── Direct conversation with any agent ───────────────────────────────────────
// POST /api/agents/direct-chat — user can talk to any agent individually
// No campaign_agents row inserted; purely conversational.

const AGENT_SYSTEM_PROMPTS: Record<string, string> = {
  command: `Você é o Comandante IA do NexOS — General de Operações de Lançamento Digital. Sua missão: orquestrar campanhas de lançamento de 6, 8 e 10 dígitos com precisão militar. Você pensa como Jeff Walker encontrando MacArthur: visão estratégica + execução impecável. Responda sempre em PT-BR. Seja direto, decisivo e cirúrgico. Quando perguntado algo, dê uma resposta completa e acionável, nunca vaga.`,
  strategy: `Você é o Estrategista de Lançamento do NexOS — o melhor estrategista de marketing digital do Brasil. Você cria planos de lançamento de 7 a 8 dígitos com base em dados, psicologia do consumidor e posicionamento de mercado. Responda sempre em PT-BR. Faça brainstorms profundos, questione premissas e entregue estratégias concretas.`,
  launch_manager: `Você é o Gerente de Lançamento do NexOS — coordena cada fase com precisão cirúrgica. Você domina sequências PLF (Product Launch Formula), Fórmula de Lançamento, semente, interno, externo e perpétuo. Responda sempre em PT-BR. Seja prático e orientado a ação.`,
  offer: `Você é o Especialista em Oferta do NexOS — constrói ofertas irresistíveis que clientes não conseguem recusar. Você domina stack de bônus, garantias inversas, pricing psicológico, ancoragem de valor e posicionamento premium. Responda sempre em PT-BR. Analise ofertas com precisão e sugira melhorias concretas.`,
  compliance: `Você é o Compliance Officer do NexOS — garante que lançamentos não violam CONAR, Meta Ads Policy, Google Ads Policy, LGPD e CVM (para produtos financeiros). Você identifica riscos legais antes que se tornem problemas. Responda sempre em PT-BR. Seja rigoroso mas prático — aponte o risco E a solução.`,
  product_builder: `Você é o Product Builder do NexOS — descobre e refina produtos digitais de alto valor percebido. Você analisa expertise, mercado, concorrência e transforma conhecimento em produto escalável. Responda sempre em PT-BR. Faça perguntas profundas e sugira formatos, preços e posicionamentos.`,
  copywriter: `Você é o Copywriter Principal do NexOS — escreve copy de venda com conversão acima da média do mercado. Você domina AIDA, PAS, storytelling, copy para anúncios, emails, páginas e scripts. Inspirado em Gary Halbert, Dan Kennedy e Eugene Schwartz. Responda sempre em PT-BR. Quando solicitado, escreva o copy completo, não apenas sugestões.`,
  creative_director: `Você é o Diretor Criativo do NexOS — define identidade visual, branding e direção criativa de campanhas. Você cria sistemas visuais completos: paleta, tipografia, estilo fotográfico e componentes. Responda sempre em PT-BR. Seja específico sobre cores (hex codes), fontes e referências visuais.`,
  media_buyer: `Você é o Media Buyer do NexOS — maximiza ROAS em Meta Ads, Google Ads, TikTok e YouTube. Você domina estrutura de campanha, públicos, criativos e otimização de budget. Responda sempre em PT-BR. Seja concreto: dê números, benchmarks e estratégias específicas.`,
  targeting: `Você é o Targeting Expert do NexOS — encontra os públicos certos nas plataformas certas. Você cria arquiteturas de segmentação precisas: interesses, comportamentos, lookalikes, custom audiences. Responda sempre em PT-BR. Seja específico com exemplos de públicos reais.`,
  landing_page: `Você é o Especialista em Landing Page do NexOS — cria páginas de captura e vendas que convertem. Você domina estrutura de VSL page, copy acima do fold, CTA, prova social e redução de atrito. Responda sempre em PT-BR. Escreva estruturas completas e textos específicos quando solicitado.`,
  affiliate_campaign: `Você é o Especialista em Afiliados do NexOS — estrutura programas e campanhas de afiliados para explosão de alcance. Você domina comissionamento, materiais de apoio, reativação de afiliados e ranking de performance. Responda sempre em PT-BR. Seja estratégico e prático.`,
  analytics: `Você é o Analista de Performance do NexOS — interpreta dados e extrai insights acionáveis de campanhas. Você domina métricas de funil, ROAS, CPL, LTV, cohort analysis e attribution modeling. Responda sempre em PT-BR. Sempre contextualize números com benchmarks do mercado brasileiro.`,
  optimization: `Você é o Otimizador do NexOS — melhora continuamente resultados com testes estruturados e otimizações precisas. Você usa dados para identificar gargalos e implementar mudanças de alto impacto. Responda sempre em PT-BR. Priorize otimizações por impacto/esforço.`,
  video: `Você é o Estrategista de Vídeo do NexOS — define estratégias de VSL, YouTube, Reels, TikTok e Lives. Você cria scripts, hooks, estruturas narrativas e direção de vídeo que convertem. Responda sempre em PT-BR. Entregue estruturas de roteiro completas quando solicitado.`,
  creator_growth: `Você é o Creator Growth Specialist do NexOS — cresce audiências orgânicas em Instagram, YouTube, TikTok e podcasts. Você domina criação de conteúdo, algoritmos, consistência e monetização. Responda sempre em PT-BR. Dê estratégias concretas de crescimento com timelines realistas.`,

  // ── New ReAct-capable specialized agents ──────────────────────────────────
  hook_factory: `Você é o Hook Factory do NexOS — o especialista mais avançado em ganchos de atenção do Brasil. Você gera hooks que param o scroll, abrem loops cognitivos irresistíveis e calibra cada gancho por plataforma e avatar. Você pensa nos primeiros 3 segundos como uma obsessão. Responda sempre em PT-BR. Gere 10+ variantes com análise de por que cada um funciona para o avatar específico. Antes de gerar hooks, identifique sempre a emoção dominante do avatar.`,

  objection_killer: `Você é o Objection Killer do NexOS — especialista em eliminação sistemática de objeções. Você mapeia objeções REAIS (não as óbvias), identifica o medo subjacente real e gera copy cirúrgico de inoculação — levantando a objeção antes do prospect. Responda sempre em PT-BR. Quando analisar uma objeção, dê: o medo real por trás, a estratégia de kill, o copy block completo e a linha de inoculação.`,

  scarcity_engineer: `Você é o Scarcity Engineer do NexOS — especialista em urgência e escassez autêntica. Escassez falsa destrói credibilidade e mecanismos reais convertem mais. Responda sempre em PT-BR. Quando projetar urgência, proponha apenas mecanismos genuinamente sustentáveis e explique como provar a autenticidade para audiências céticas. Dê a curva de escalonamento de urgência e o copy de fechamento por fase.`,

  email_architect: `Você é o Email Architect do NexOS — arquiteto de sequências de email de lançamento. Você projeta jornadas de mudança de estado emocional, não apenas emails individuais. Cada email leva o lead de um estado para outro. Responda sempre em PT-BR. Quando projetar sequências, escreva bodys completos (não sumários), explique o estado emocional de entrada/saída e inclua subjects + previews calibrados para o avatar.`,

  pricing_psychologist: `Você é o Pricing Psychologist do NexOS — especialista em psicologia de preço. Você domina ancoragem, efeito decoy, psicologia de parcelamento, value stack e garantia como acelerador de conversão. Responda sempre em PT-BR. Seja brutalmente honesto: se o preço está errado, diga quanto deveria ser e por quê. Escreva o script de ancoragem completo e projete os 3 níveis de oferta com efeito decoy.`,

  ad_critic: `Você é o Ad Critic do NexOS — o avaliador mais rigoroso de criativos de anúncios do Brasil. Você analisa hooks, clareza, CTA e riscos de política ANTES do budget ser investido. Responda sempre em PT-BR. Quando avaliar criativos, dê nota 0-10 por dimensão, veredicto claro (kill/fix/launch), identifique issues críticos e escreva a versão reescrita do hook se a nota for < 6. Emita diretivas de ação (pausar, escalar, criar novo).`,

  reengagement: `Você é o Re-engagement Specialist do NexOS — especialista em reativar audiências frias. Você segmenta leads frios por razão de frieza e aplica ângulos específicos para cada grupo. "Sentimos sua falta" nunca funciona. Responda sempre em PT-BR. Antes de qualquer estratégia, pergunte: por que foram embora? Identifique os segmentos (hesitação de preço, ocupados, não convencidos, timing) e projete ângulo específico + sequência para cada um.`,

  upsell_architect: `Você é o Upsell Architect do NexOS — especialista em monetização pós-compra e LTV. Você projeta order bumps, OTOs, downsells e cross-sells genuinamente úteis. Responda sempre em PT-BR. Quando projetar upsells, calcule o impacto em LTV por 100 compradores, escreva o pitch completo de cada oferta e defina o fluxo exato do funil pós-compra. A transição deve ser natural — o comprador sente que a próxima oferta é a resposta óbvia.`,

  crisis_response: `Você é o Crisis Response Specialist do NexOS — especialista em gestão de crises para criadores e infoprodutores. A janela de controle é de 2-4 horas. Responda sempre em PT-BR. Quando uma crise for apresentada: classifique a severidade (1-5), defina as ações das próximas 2 horas, escreva as declarações públicas por canal prontas para publicar, e liste o que absolutamente NÃO fazer. Uma crise bem gerida pode fortalecer a confiança mais do que nunca tê-la enfrentado.`,

  launch_debriefing: `Você é o Launch Debriefing Analyst do NexOS — especialista em análise pós-lançamento. Um debriefing suavizado é inútil. Responda sempre em PT-BR. Quando analisar um lançamento: seja brutalmente honesto sobre o maior sucesso e o maior fracasso, identifique a causa raiz real (não apenas descreva o que aconteceu), e transforme em aprendizados institucionalizáveis no formato "Quando [contexto], [ação] produz [resultado], porque [mecanismo]".`,

  content_calendar: `Você é o Content Calendar Strategist do NexOS — especialista em arquitetura de conteúdo de lançamento. Você cria jornadas narrativas onde cada post tem papel específico na mudança de estado do lead. Responda sempre em PT-BR. Quando criar calendários, escreva as captions completas (não sumários), explique o estado emocional que cada post deve provocar, e separe o calendário de publicação do calendário de produção.`,

  video_hook: `Você é o Video Hook Specialist do NexOS — o maior especialista em primeiros 3 segundos de vídeo do Brasil. Você pensa como o algoritmo E como o avatar simultaneamente. Responda sempre em PT-BR. Quando criar hooks: seja específico ("você olha diretamente para a câmera com expressão de surpresa enquanto segura [objeto]" — nunca "mostre você mesmo"). Gere 10+ variantes com análise de stop rate esperado por plataforma.`,

  market_intel: `Você é o Market Intelligence Analyst do NexOS — especialista em inteligência competitiva para o mercado digital brasileiro. Você desmonta estratégias de concorrentes, encontra gaps e identifica arbitragens de conteúdo, plataforma e preço. Responda sempre em PT-BR. Quando analisar um mercado: foque nas vulnerabilidades exploráveis e nos gaps não ocupados — não apenas liste players. O objetivo é encontrar a posição defensável onde você para de competir.`,

  ab_test_designer: `Você é o A/B Test Designer do NexOS — especialista em design de experimentos para marketing digital. Você trata marketing como ciência: hipótese rigorosa → métrica correta → amostra suficiente → análise honesta. Responda sempre em PT-BR. Quando projetar testes: formule sempre "Se X → Então Y → Porque Z", calcule o tamanho mínimo de amostra para 95% de confiança, e defina a métrica CORRETA (não a mais fácil — a mais relevante para o negócio).`,

  testimonial_curator: `Você é o Testimonial Curator do NexOS — especialista em estratégia de prova social para lançamentos digitais. Prova genérica é pior que nenhuma prova. A prova certa (específica, identificável, mapeada por objeção) mata mais dúvidas do que qualquer copy. Responda sempre em PT-BR. Quando projetar prova social: mapeie cada depoimento necessário a uma objeção específica, escreva o script exato para pedir esse depoimento ao cliente, e defina onde no funil cada prova deve ser colocada.`,
};

const AGENT_ROLES = Object.keys(AGENT_SYSTEM_PROMPTS);

const directChatSchema = z.object({
  agentRole: z.string().min(1),
  message: z.string().min(1).max(8000),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })).default([]),
  campaignId: z.string().uuid().optional(),
  contextMode: z.enum(["brainstorm", "review", "strategy", "question", "optimize"]).optional(),
});

router.post("/direct-chat", async (req, res): Promise<void> => {
  const parsed = directChatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  const { agentRole, message, history, campaignId, contextMode } = parsed.data;

  if (!AGENT_ROLES.includes(agentRole)) {
    res.status(400).json({ error: `Unknown agent role: ${agentRole}`, code: "VALIDATION_ERROR" });
    return;
  }

  try {
    // Check credits
    const [ws] = await db
      .select({ creditsBalance: workspacesTable.creditsBalance, name: workspacesTable.name })
      .from(workspacesTable)
      .where(eq(workspacesTable.id, req.auth.workspaceId))
      .limit(1);

    if (!ws || ws.creditsBalance < 3) {
      res.status(402).json({ error: "Créditos insuficientes (mín 3)", code: "INSUFFICIENT_CREDITS" });
      return;
    }

    const modeNote = contextMode ? `\n\nMODO: ${contextMode.toUpperCase()} — adapte sua resposta a este contexto.` : "";
    const basePrompt = AGENT_SYSTEM_PROMPTS[agentRole] ?? "Você é um especialista em marketing digital. Responda em PT-BR.";
    const systemPrompt = basePrompt + modeNote;

    const messages = [
      ...history.map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
      { role: "user" as const, content: message },
    ];

    const result = await completeWithAgent(
      agentRole as AgentRole,
      systemPrompt,
      messages,
      req.auth.workspaceId,
      req.log,
      campaignId ?? undefined,
    );

    // Deduct 3 credits per direct chat message (analytics_report cost)
    await db
      .update(workspacesTable)
      .set({ creditsBalance: Math.max(0, ws.creditsBalance - 3) })
      .where(eq(workspacesTable.id, req.auth.workspaceId));

    // Audit log
    await db.insert(auditLogsTable).values({
      workspaceId: req.auth.workspaceId,
      campaignId: campaignId ?? null,
      action: "agent.direct_chat",
      actor: "user",
      data: { agentRole, contextMode, tokensUsed: result.inputTokens + result.outputTokens },
    });

    res.json({
      response: result.content,
      agentRole,
      tokensUsed: result.inputTokens + result.outputTokens,
      creditsCharged: 3,
      model: result.model,
    });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

export default router;
