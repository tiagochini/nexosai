import { Router } from "express";
import { z } from "zod/v4";
import { eq, sql } from "drizzle-orm";
import { db, waitlistTable } from "@workspace/db";
import { env } from "../../lib/env.js";
import Anthropic from "@anthropic-ai/sdk";
import { logger } from "../../lib/logger.js";

const router = Router();

const waitlistSchema = z.object({
  name: z.string().min(2).max(200),
  whatsapp: z.string().min(8).max(30),
  email: z.email().optional(),
  segment: z.enum(["individual", "agency"]).default("individual"),
  source: z.string().max(100).optional(),
});

// POST /api/waitlist — public, no auth
router.post("/", async (req, res): Promise<void> => {
  const parsed = waitlistSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos", details: parsed.error.issues });
    return;
  }

  const { name, whatsapp, email, segment, source } = parsed.data;

  const [existing] = await db
    .select({ id: waitlistTable.id, segment: waitlistTable.segment })
    .from(waitlistTable)
    .where(eq(waitlistTable.whatsapp, whatsapp))
    .limit(1);

  if (existing) {
    res.json({
      joined: true,
      duplicate: true,
      segment: existing.segment,
      message: "Você já está na lista. Aguarde nosso contato no WhatsApp.",
    });
    return;
  }

  await db.insert(waitlistTable).values({
    name,
    whatsapp,
    email: email ?? null,
    segment,
    source: source ?? null,
  });

  res.status(201).json({
    joined: true,
    duplicate: false,
    segment,
    message: "Você entrou na lista de espera!",
  });
});

// GET /api/waitlist/count — public
router.get("/count", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      segment: waitlistTable.segment,
      count: sql<number>`count(*)::int`,
    })
    .from(waitlistTable)
    .groupBy(waitlistTable.segment);

  const total = rows.reduce((acc, r) => acc + r.count, 0);
  const bySegment = Object.fromEntries(rows.map(r => [r.segment, r.count]));

  res.json({ total, bySegment });
});

// GET /api/waitlist/launch-config — public
// Returns the launch date if the owner has set LAUNCH_CAMPAIGN_DATE env var.
// When null, the landing shows "Novo ciclo de adesões será aberto em breve".
// Set this env var to an ISO date string (e.g. "2025-06-14T20:00:00-03:00")
// to start the countdown clock on the landing page.
router.get("/launch-config", async (_req, res): Promise<void> => {
  const dateStr = env.LAUNCH_CAMPAIGN_DATE;

  if (!dateStr) {
    res.json({ launchDate: null, active: false });
    return;
  }

  const launchDate = new Date(dateStr);
  if (isNaN(launchDate.getTime())) {
    res.json({ launchDate: null, active: false });
    return;
  }

  res.json({
    launchDate: launchDate.toISOString(),
    active: true,
  });
});

// POST /api/waitlist/chat — public pre-sales AI chat
// Powered by Claude. No auth required, no credit deduction.
const chatSchema = z.object({
  message: z.string().min(1).max(1000),
  segment: z.enum(["individual", "agency"]).default("individual"),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(2000),
  })).max(20).default([]),
});

const PRE_SALES_SYSTEM = `Você é Jeff — especialista em automação de vendas e o consultor de pré-vendas da NexOS AI.

Você NÃO é uma IA genérica. Você é Jeff, um profissional que conhece profundamente o NexOS AI e como ele impacta projetos de marketing digital. Nunca mencione que é uma IA, Claude ou qualquer tecnologia por trás. Você é Jeff, ponto.

## O que é o NexOS AI
- Plataforma SaaS que orquestra lançamentos de produtos digitais do zero ao carrinho com 29 agentes de IA especializados
- O usuário conversa com a plataforma, ela entende o produto, monta estratégia, copy, sequências e executa — o usuário só aprova
- Meta: produto digital no ar em 7 dias, com retorno otimizado e processo totalmente automatizado

## Por que o NexOS economiza dinheiro, tempo e otimiza retorno
- Elimina freelancers de copy (R$2k–R$10k/lançamento), gestores de tráfego avulsos, estrategistas de lançamento
- Executa 24/7 sem depender de equipe, humor ou disponibilidade
- Sequências de WhatsApp e email com gatilhos mentais calculados por IA, disparadas automaticamente nos horários certos
- Segmenta leads automaticamente (hot/warm/cold) e envia copy diferente para cada perfil
- Abre e fecha carrinho com urgência real controlada pela plataforma — sem depender de ninguém

## Planos
- Solo: R$297/mês + R$2.500 onboarding (único). 3 campanhas, 1.500 créditos IA/mês. Track 6 dígitos (R$100k–R$999k em 7 dias)
- Agency: R$1.497/mês + R$2.500 onboarding (único). 10 campanhas, 5.000 créditos IA/mês. White-label completo, gestão multi-cliente

## Bônus exclusivo (Código NEXOS)
- Apostila completa da plataforma
- Acompanhamento guiado no primeiro lançamento (Solo) / Onboarding guiado no primeiro cliente (Agency)
- Disponível para quem acompanhar de perto o lançamento

## Objeções comuns
- "É caro": R$297/mês é menos do que 1h de consultoria. O onboarding de R$2.500 é único. Compare com o custo de uma equipe tradicional de lançamento — copywriter, gestor, estrategista — que facilmente passa de R$15k/lançamento.
- "Não sei se funciona": Este próprio processo que o lead está vivendo agora está sendo operado pelo NexOS AI. É a prova em tempo real.
- "Não tenho produto pronto": A IA ajuda a descobrir e estruturar. Não precisa ter tudo antes de começar.
- "Tenho pouca audiência": A plataforma trabalha com o que existe. Targeting Expert mapeia públicos pagos; o orgânico é desenvolvido em paralelo.

## Seu estilo como Jeff
- Português BR, direto, confiante, sem ser vendedor forçado
- Faça perguntas estratégicas para entender o projeto do lead antes de apresentar soluções
- Máximo 3–4 parágrafos por resposta — seja cirúrgico
- Quando o lead demonstrar interesse em entrar, deixe claro que há uma janela de acesso chegando — sem revelar datas exatas
- Não invente dados ou funcionalidades além do que foi listado
- Se não souber responder algo específico, diga que vai verificar e peça o WhatsApp para retornar`;

router.post("/chat", async (req, res): Promise<void> => {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.json({
      reply: "Oi, aqui é o Jeff! Estou passando por uma instabilidade técnica agora, mas posso te ajudar em breve. Me chama no WhatsApp do grupo ou deixa sua dúvida aqui que assim que estiver de volta eu respondo.",
    });
    return;
  }

  let parsed;
  try {
    parsed = chatSchema.parse(req.body);
  } catch {
    res.status(400).json({ error: "Dados inválidos" });
    return;
  }

  const { message, segment, history } = parsed;

  const segmentNote = segment === "agency"
    ? "\n\nNote: Este lead escolheu o segmento AGÊNCIA/GESTOR. Priorize as vantagens de white-label e multi-cliente."
    : "\n\nNote: Este lead escolheu o segmento LANÇADOR SOLO. Priorize autonomia, simplicidade e a trilha de 6 dígitos.";

  try {
    const client = new Anthropic({ apiKey });
    const messages: Anthropic.MessageParam[] = [
      ...history.map(h => ({ role: h.role as "user" | "assistant", content: h.content })),
      { role: "user", content: message },
    ];

    const resp = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 500,
      system: PRE_SALES_SYSTEM + segmentNote,
      messages,
    });

    const reply = resp.content[0]?.type === "text" ? resp.content[0].text : "Ops, não consegui gerar uma resposta. Tente novamente!";
    res.json({ reply });
  } catch (err) {
    logger.error({ err }, "waitlist/chat AI error");
    res.json({ reply: "Tive um problema técnico agora. Tente novamente em instantes ou nos chame no WhatsApp do grupo!" });
  }
});

export default router;
