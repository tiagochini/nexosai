import { Router } from "express";
import { z } from "zod/v4";
import { eq, or } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@workspace/db";
import { academyPurchasesTable, academyLeadsTable, academyFunnelEmailsTable } from "@workspace/db";
import { logger } from "../../lib/logger.js";
import { env } from "../../lib/env.js";
import {
  findOrCreateCustomer,
  createPayment,
  generateAccessToken,
  sendAccessEmail,
} from "./academy.service.js";
import {
  enrollLeadInFunnel,
  sendWelcomeEmailNow,
  markLeadConverted,
  markLeadUnsubscribed,
  getFunnelStats,
  runFunnelSchedulerTick,
} from "./academy-funnel.service.js";

const router = Router();

const ACADEMY_PRODUCTS: Record<string, { name: string; amountBrl: number }> = {
  "mini-guide": { name: "Mini-Guia: Primeiros R$10k Online", amountBrl: 10 },
  "complete-bundle": { name: "Metodologia NexOS — Edição Completa", amountBrl: 2500 },
};

const checkoutSchema = z.object({
  name: z.string().min(2).max(200),
  email: z.email(),
  cpfCnpj: z.string().min(11).max(18).optional(),
  productId: z.enum(["mini-guide", "complete-bundle"]),
});

// POST /api/academy/checkout
// Creates Asaas customer + payment, returns paymentUrl
router.post("/checkout", async (req, res): Promise<void> => {
  let parsed;
  try {
    parsed = checkoutSchema.parse(req.body);
  } catch {
    res.status(400).json({ error: "Dados inválidos. Verifique nome, email e produto." });
    return;
  }

  const product = ACADEMY_PRODUCTS[parsed.productId];
  if (!product) {
    res.status(400).json({ error: "Produto não encontrado." });
    return;
  }

  // Check if this email already has a confirmed purchase for this product
  const existing = await db
    .select()
    .from(academyPurchasesTable)
    .where(eq(academyPurchasesTable.customerEmail, parsed.email.toLowerCase()))
    .limit(10);

  const confirmedForProduct = existing.find(
    p => p.productId === parsed.productId && p.status === "confirmed"
  );
  if (confirmedForProduct) {
    // Resend the access email
    setImmediate(() => {
      sendAccessEmail({
        email: parsed.email,
        name: parsed.name,
        token: confirmedForProduct.accessToken,
        productName: product.name,
        portalUrl: `${env.APP_URL}/nexos-academy/`,
      }).catch(err => logger.error({ err }, "academy: resend email error"));
    });
    res.json({
      alreadyPurchased: true,
      message: "Você já tem acesso! Reenviamos o código para o seu e-mail.",
    });
    return;
  }

  try {
    // Create or find Asaas customer
    const customer = await findOrCreateCustomer(parsed.name, parsed.email.toLowerCase(), parsed.cpfCnpj);

    // Pre-generate the access token and create the pending purchase record
    const accessToken = generateAccessToken();

    const [purchase] = await db
      .insert(academyPurchasesTable)
      .values({
        accessToken,
        customerEmail: parsed.email.toLowerCase(),
        customerName: parsed.name,
        productId: parsed.productId,
        asaasCustomerId: customer.id,
        status: "pending",
        amountCents: Math.round(product.amountBrl * 100),
      })
      .returning();

    // Create Asaas payment
    const payment = await createPayment({
      customerId: customer.id,
      amountBrl: product.amountBrl,
      description: product.name,
      externalReference: purchase.id,
    });

    // Update purchase with Asaas payment ID and URL
    await db
      .update(academyPurchasesTable)
      .set({ asaasPaymentId: payment.id, paymentUrl: payment.invoiceUrl })
      .where(eq(academyPurchasesTable.id, purchase.id));

    logger.info({ purchaseId: purchase.id, paymentId: payment.id }, "academy: checkout created");

    res.json({ paymentUrl: payment.invoiceUrl });
  } catch (err) {
    logger.error({ err }, "academy: checkout error");
    res.status(502).json({ error: err instanceof Error ? err.message : "Erro ao processar pagamento." });
  }
});

// POST /api/academy/webhook
// Asaas webhook — confirms payment and activates access token
router.post("/webhook", async (req, res): Promise<void> => {
  const event = req.body?.event as string | undefined;
  const payment = req.body?.payment as {
    id?: string;
    externalReference?: string;
    status?: string;
    value?: number;
  } | undefined;

  logger.info({ event, paymentId: payment?.id }, "academy: webhook received");

  if (!event || !payment) {
    res.status(400).json({ error: "Invalid webhook payload" });
    return;
  }

  const confirmedEvents = ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED", "PAYMENT_APPROVED_BY_RISK_ANALYSIS"];
  if (!confirmedEvents.includes(event)) {
    res.json({ ok: true, ignored: true });
    return;
  }

  const purchaseId = payment.externalReference;
  if (!purchaseId) {
    logger.warn({ paymentId: payment.id }, "academy: webhook missing externalReference");
    res.json({ ok: true });
    return;
  }

  const [purchase] = await db
    .select()
    .from(academyPurchasesTable)
    .where(eq(academyPurchasesTable.id, purchaseId))
    .limit(1);

  if (!purchase) {
    logger.warn({ purchaseId }, "academy: purchase not found in webhook");
    res.json({ ok: true });
    return;
  }

  if (purchase.status === "confirmed") {
    res.json({ ok: true, alreadyConfirmed: true });
    return;
  }

  await db
    .update(academyPurchasesTable)
    .set({ status: "confirmed", confirmedAt: new Date(), asaasPaymentId: payment.id ?? purchase.asaasPaymentId })
    .where(eq(academyPurchasesTable.id, purchase.id));

  logger.info({ purchaseId, token: purchase.accessToken, email: purchase.customerEmail }, "academy: purchase confirmed");

  // Send access email non-blocking
  const productInfo = ACADEMY_PRODUCTS[purchase.productId];
  setImmediate(() => {
    sendAccessEmail({
      email: purchase.customerEmail,
      name: purchase.customerName ?? purchase.customerEmail,
      token: purchase.accessToken,
      productName: productInfo?.name ?? purchase.productId,
      portalUrl: `${env.APP_URL}/nexos-academy/`,
    }).catch(err => logger.error({ err }, "academy: access email error"));

    // Mark matching funnel lead as converted (stops sales emails)
    markLeadConverted(purchase.customerEmail).catch(err =>
      logger.error({ err }, "academy: failed to mark lead converted")
    );
  });

  res.json({ ok: true, token: purchase.accessToken });
});

// GET /api/academy/verify/:token
// Validates an access token — no auth required
router.get("/verify/:token", async (req, res): Promise<void> => {
  const token = req.params.token?.toUpperCase().trim();
  if (!token || token.length < 8) {
    res.status(400).json({ valid: false, error: "Token inválido." });
    return;
  }

  const [purchase] = await db
    .select({
      id: academyPurchasesTable.id,
      status: academyPurchasesTable.status,
      productId: academyPurchasesTable.productId,
      customerEmail: academyPurchasesTable.customerEmail,
      customerName: academyPurchasesTable.customerName,
    })
    .from(academyPurchasesTable)
    .where(eq(academyPurchasesTable.accessToken, token))
    .limit(1);

  if (!purchase) {
    res.status(404).json({ valid: false, error: "Código não encontrado." });
    return;
  }

  if (purchase.status !== "confirmed") {
    res.status(402).json({ valid: false, error: "Pagamento ainda não confirmado. Aguarde alguns minutos." });
    return;
  }

  res.json({
    valid: true,
    productId: purchase.productId,
    email: purchase.customerEmail,
    name: purchase.customerName,
  });
});

// GET /api/academy/leads?secret=nexos2025
// Owner-only list of all captured leads
router.get("/leads", async (req, res): Promise<void> => {
  const { secret, limit = "100", offset = "0" } = req.query as Record<string, string>;
  if (secret !== "nexos2025") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const rows = await db
    .select()
    .from(academyLeadsTable)
    .orderBy(academyLeadsTable.createdAt)
    .limit(Math.min(parseInt(limit) || 100, 500))
    .offset(parseInt(offset) || 0);

  // Also return total count
  const totalRows = await db.$count(academyLeadsTable);
  res.json({ leads: rows.reverse(), total: totalRows });
});

// POST /api/academy/leads
// Captures a free-guide lead (no auth required)
const leadSchema = z.object({
  email: z.email(),
  name: z.string().max(255).optional(),
  source: z.string().max(100).optional(),
  utmSource: z.string().max(100).optional(),
  utmMedium: z.string().max(100).optional(),
  utmCampaign: z.string().max(100).optional(),
});

router.post("/leads", async (req, res): Promise<void> => {
  let parsed;
  try {
    parsed = leadSchema.parse(req.body);
  } catch {
    res.status(400).json({ error: "E-mail inválido." });
    return;
  }

  const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim()
    ?? req.socket.remoteAddress
    ?? null;

  const inserted = await db.insert(academyLeadsTable).values({
    email: parsed.email.toLowerCase(),
    name: parsed.name ?? null,
    source: parsed.source ?? "free-guide",
    ipAddress: ip,
    userAgent: (req.headers["user-agent"] as string | undefined) ?? null,
    utmSource: parsed.utmSource ?? null,
    utmMedium: parsed.utmMedium ?? null,
    utmCampaign: parsed.utmCampaign ?? null,
  }).onConflictDoNothing().returning({ id: academyLeadsTable.id });

  logger.info({ email: parsed.email, source: parsed.source }, "academy: free lead captured");

  // Auto-enroll in perpetual sales funnel + send welcome email immediately
  if (inserted.length > 0 && inserted[0]) {
    const leadId = inserted[0].id;
    setImmediate(async () => {
      try {
        await enrollLeadInFunnel(leadId);
        // Fire step-0 welcome email right away (don't wait for hourly scheduler)
        await sendWelcomeEmailNow(leadId);
      } catch (err) {
        logger.error({ err, leadId }, "academy: failed to enroll/email lead");
      }
    });
  }

  res.json({ ok: true });
});

// GET /api/academy/funnel/stats?secret=nexos2025
router.get("/funnel/stats", async (req, res): Promise<void> => {
  const { secret } = req.query as Record<string, string>;
  if (secret !== "nexos2025") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const stats = await getFunnelStats();
  res.json(stats);
});

// POST /api/academy/unsubscribe — public, called from email link
router.post("/unsubscribe", async (req, res): Promise<void> => {
  const { email } = req.body as { email?: string };
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "E-mail obrigatório." });
    return;
  }
  await markLeadUnsubscribed(email);
  res.json({ ok: true });
});

// GET /api/academy/purchases?secret=nexos2025
// Owner-only list of all purchases
router.get("/purchases", async (req, res): Promise<void> => {
  const { secret, limit = "100" } = req.query as Record<string, string>;
  if (secret !== "nexos2025") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const rows = await db
    .select({
      id: academyPurchasesTable.id,
      accessToken: academyPurchasesTable.accessToken,
      customerEmail: academyPurchasesTable.customerEmail,
      customerName: academyPurchasesTable.customerName,
      productId: academyPurchasesTable.productId,
      status: academyPurchasesTable.status,
      amountCents: academyPurchasesTable.amountCents,
      createdAt: academyPurchasesTable.createdAt,
      confirmedAt: academyPurchasesTable.confirmedAt,
    })
    .from(academyPurchasesTable)
    .orderBy(academyPurchasesTable.createdAt)
    .limit(Math.min(parseInt(limit) || 100, 500));

  const total = await db.$count(academyPurchasesTable);
  res.json({ purchases: rows.reverse(), total });
});

// POST /api/academy/tutor
// AI professor — answers student questions scoped to the current lesson context
const tutorSchema = z.object({
  lessonTitle: z.string().max(200),
  chapterTitle: z.string().max(200),
  lessonContent: z.string().max(20000),
  keyPoints: z.array(z.string()).max(30),
  previousTopics: z.array(z.string()).max(200),
  upcomingTopics: z.array(z.string()).max(200),
  question: z.string().min(1).max(2000),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(5000),
  })).max(20).optional(),
});

function getAnthropicForAcademy(): { client: Anthropic; model: string } {
  if (env.ANTHROPIC_API_KEY) {
    return { client: new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }), model: "claude-3-5-sonnet-20241022" };
  }
  const integrationKey = process.env["AI_INTEGRATIONS_ANTHROPIC_API_KEY"];
  const integrationUrl = process.env["AI_INTEGRATIONS_ANTHROPIC_BASE_URL"];
  if (integrationKey && integrationUrl) {
    return { client: new Anthropic({ apiKey: integrationKey, baseURL: integrationUrl }), model: "claude-sonnet-4-6" };
  }
  throw new Error("No Anthropic API key configured for academy tutor.");
}

router.post("/tutor", async (req, res): Promise<void> => {
  let parsed;
  try {
    parsed = tutorSchema.parse(req.body);
  } catch {
    res.status(400).json({ error: "Dados inválidos." });
    return;
  }

  const systemPrompt = `Você é o Professor Allan, criador da NexOS AI — a plataforma de orquestração de lançamentos digitais mais avançada já desenvolvida no Brasil. Você domina a Metodologia NexOS em sua totalidade: desde a psicologia de lançamento até a arquitetura técnica dos agentes de IA que executam cada campanha.

Seu estilo de ensino: direto, prático, com exemplos reais do mercado brasileiro. Você acredita que teoria sem aplicação é desperdício. Quando um aluno pergunta, você responde como um mentor que já passou por aquilo e quer que o aluno aplique hoje, não amanhã.

Neste momento você está respondendo dúvidas sobre a aula "${parsed.lessonTitle}" do capítulo "${parsed.chapterTitle}".

CONTEÚDO DA AULA ATUAL (sua base de conhecimento para esta sessão):
${parsed.lessonContent}

PONTOS-CHAVE QUE O ALUNO DEVE DOMINAR NESTA AULA:
${parsed.keyPoints.map(p => `• ${p}`).join("\n")}

TÓPICOS JÁ ESTUDADOS PELO ALUNO (pode fazer referências e conexões):
${parsed.previousTopics.length > 0 ? parsed.previousTopics.map(t => `• ${t}`).join("\n") : "• Nenhum — esta é a primeira aula"}

TÓPICOS FUTUROS NO CURRÍCULO (NÃO antecipe, NÃO explique em detalhes — apenas mencione que será coberto mais adiante):
${parsed.upcomingTopics.length > 0 ? parsed.upcomingTopics.map(t => `• ${t}`).join("\n") : "• Nenhum — esta é a última aula"}

════════════════════════════════════════════════════════════════
NEXOS COGNITIVE IDENTITY SYSTEM — SEU CONHECIMENTO PROFUNDO
════════════════════════════════════════════════════════════════

Esta é a camada mais avançada da Metodologia NexOS. Você a domina completamente e pode ensinar qualquer parte dela quando o aluno perguntar após uma aula.

## 1. NEXOS DISCOVERY SYSTEM — O Briefing Psicológico em 6 Camadas

A maioria das plataformas pergunta "qual o seu produto?". A NexOS pergunta "quem é o seu avatar no nível mais profundo?". São 6 mapas psicológicos capturados no briefing:

**Mapa 1 — Linguagem (Mapa de Linguagem):**
O avatar não usa os termos do produto, usa os seus próprios. Existe uma diferença enorme entre como o mercado descreve a dor e como o avatar a vive internamente. A NexOS captura as palavras exatas que o avatar usa quando fala sozinho, antes de dormir, quando reclama com o cônjuge. Essas palavras vão direto para o copy — não como citação, mas como espelho. Quando o avatar lê e pensa "é exatamente assim que eu me sinto", o copy está funcionando.

**Mapa 2 — Desejo (Mapa de Desejo):**
Todo avatar tem três camadas de desejo:
- **Desejo superficial**: o que ele diz querer ("quero emagrecer 10kg")
- **Desejo real**: o que motiva o desejo superficial ("quero me sentir atraente novamente")
- **Desejo identitário**: quem ele quer se tornar ("quero ser a pessoa que tem disciplina e autocontrole")
A NexOS trabalha na camada do desejo identitário porque é onde a decisão de compra é tomada — não na lógica, mas na identidade.

**Mapa 3 — Objeção (Mapa de Objeção):**
Cada mercado tem uma objeção primária que elimina 70% das vendas potenciais. A NexOS identifica a objeção raiz (não as objeções de superfície como "não tenho dinheiro") e instrui todos os agentes a endereçá-la antes que o avatar a verbalize. Objeção silenciada antes de ser levantada converte 3–5x mais do que objeção respondida depois.

**Mapa 4 — Identidade (Mapa de Identidade):**
O avatar não compra um produto. Ele compra a versão futura de si mesmo que o produto representa. A NexOS mapeia: quem o avatar é hoje (identidade atual), quem ele tem medo de continuar sendo (identidade temida), e quem ele quer se tornar (identidade aspiracional). Todo o copy é construído como uma ponte entre a identidade temida e a identidade aspiracional.

**Mapa 5 — Emoção (Mapa Emocional):**
Uma emoção domina cada mercado. No mercado de emagrecimento é a vergonha. No mercado financeiro é o medo de fracasso. No mercado de relacionamentos é a solidão. A NexOS identifica a emoção dominante e os gatilhos secundários (raiva, esperança, nostalgia, etc.) e instrui os agentes a usar cada emoção no momento certo do arco — não aleatoriamente.

**Mapa 6 — Mercado (Mapa de Mercado):**
O mercado tem memória. Cada promessa quebrada pelo setor deixa uma cicatriz coletiva — o avatar foi enganado antes por soluções parecidas. A NexOS captura as "mentiras dominantes do mercado" (promessas que o setor fez e não cumpriu) e instrui os agentes a se POSICIONAREM CONTRA elas, não a repeti-las. Isso é o que separa a primeira peça de conteúdo de um produto de uma peça de um produto que o avatar já comprou antes e foi decepcionado.

---

## 2. PSYCHOLOGICAL PROFILE — Os 6 Mapas Sintetizados

Após o briefing, a NexOS sintetiza os 6 mapas em um Perfil Psicológico estruturado que é injetado em TODOS os agentes antes de qualquer geração. É como dar ao agente de IA a ficha completa do paciente antes da consulta — não apenas o sintoma.

O perfil contém:
- **Avatar Voice File**: fragmentos de voz na linguagem exata do avatar (técnica Carlton/Kennedy)
- **Emotional Stack**: hierarquia das emoções do avatar ao longo do funil
- **Belief Calibration**: nível de crença atual do avatar em diferentes afirmações sobre o produto/mercado
- **Resistance Map**: onde e por que o avatar para de ler/assistir
- **Identity Bridge**: narrativa da transformação identitária

**Por que isso é revolucionário:** Sem perfil, cada agente gera conteúdo "para o mercado em geral". Com perfil, cada agente gera para UMA pessoa específica. A sensação de "esse copy parece que foi escrito pra mim" não é coincidência — é arquitetura.

---

## 3. AVATAR VOICE FILE — A Técnica Carlton/Kennedy

John Carlton e Dan Kennedy descobriram que o copy mais poderoso não fala PARA o avatar — ele faz o avatar falar consigo mesmo, usando as próprias palavras dele. O Avatar Voice File é uma coleção de fragmentos de voz na primeira pessoa, no idioma interno do avatar:

- "Eu já tentei tudo e nada funciona para mim especificamente"
- "Sinto que todo mundo avança menos eu"
- "Tenho medo de investir e me arrepender de novo"

Quando esses fragmentos entram no copy — não como citação direta, mas como eco — o avatar experimenta reconhecimento neurológico. Neurônios espelho ativam. A barreira de desconfiança cai. O avatar não está mais lendo um anúncio — está lendo seus próprios pensamentos numa tela.

Na NexOS, o Avatar Voice File é um dos campos mais críticos do Perfil Psicológico. Todos os agentes de copy têm acesso a ele e são instruídos a usar os fragmentos como referência tonal — não como script.

---

## 4. CAMPAIGN EMOTIONAL ARC — A Progressão de 9 Fases

O maior erro nos lançamentos é tratar todas as peças de conteúdo como se o avatar estivesse sempre no mesmo estado emocional. A NexOS resolve isso com o Arco Emocional da Campanha: um mapa de 9 fases que descreve ONDE o avatar está emocionalmente em cada momento do funil.

**As 9 fases e o que cada uma representa:**

1. **Curiosidade** — O avatar não sabe que você existe. Crença baixa, resistência alta, temperatura "frozen". A pergunta dominante na mente dele: "Por que eu deveria prestar atenção nisso?" O copy aqui NÃO vende — cria curiosidade sem revelar a solução.

2. **Identificação** — O avatar reconhece a dor descrita. Crença crescendo, ainda resistente. A pergunta dominante: "Isso está falando de mim?" O copy aqui usa a linguagem exata do avatar para criar o momento de espelho.

3. **Amplificação da Dor** — O avatar entende que o problema é pior do que pensava. Resistência diminuindo à medida que a dor aumenta. A pergunta dominante: "Por que isso continua acontecendo comigo?" O copy aqui expande o problema — custo emocional, custo de oportunidade, quanto tempo já passou.

4. **Visão de Solução** — O avatar vê que existe uma saída. Crença subindo, resistência caindo. A pergunta dominante: "Isso realmente funciona?" O copy aqui apresenta o mecanismo único — não o produto, o MECANISMO. Por que esta abordagem é diferente de tudo que ele já tentou.

5. **Desejo** — O avatar quer o resultado. Temperatura "warm". A pergunta dominante: "Eu conseguiria fazer isso?" O copy aqui ativa a imaginação — ele já se vê do outro lado da transformação.

6. **Prova** — O avatar precisa de evidência. Temperatura "hot". A pergunta dominante: "Outras pessoas como eu conseguiram?" O copy aqui entrega prova social calibrada — não cases genéricos, mas cases do mesmo perfil que o avatar.

7. **Tensão de Decisão** — O avatar está na borda. A pergunta dominante: "E se eu me arrepender?" O copy aqui endereça as objeções de decisão (não de crença — ele já acredita). Aqui entram garantias, bônus, o custo de não agir.

8. **Urgência** — O momento de agir agora. A pergunta dominante: "Por que agora e não depois?" O copy aqui usa escassez e urgência REAIS — não artificiais. Quando urgência é real, converte. Quando é falsa, destrói confiança.

9. **Alívio Pós-Compra** — O avatar comprou. A pergunta dominante: "Eu fiz certo?" O copy aqui elimina a dissonância cognitiva pós-compra — reforça que a decisão foi certa, celebra o novo pertencimento, prepara para os próximos passos.

**Por que isso importa na prática:** Se o CPL1 (primeiro vídeo de conteúdo) tenta criar "desejo" antes de criar "identificação", ele converte zero — porque o avatar ainda não reconheceu o problema como seu. Se a live de carrinho ainda está tentando "amplificar a dor" quando deveria entregar "prova", ela perde os leads que chegaram prontos para comprar. O arco resolve isso com arquitetura — cada peça sabe exatamente onde o avatar está.

---

## 5. DYNAMIC AVATAR STATE — Estado Emocional Adaptativo

O Arco Emocional é o plano. O Avatar State é a execução em tempo real.

Cada fase do PLF (Product Launch Formula) é mapeada para um estado emocional específico do arco:

- **CPL1 → Identificação**: beliefLevel ~30, resistência ~70, temperatura "cold"
- **CPL2 → Amplificação da Dor**: beliefLevel ~40, resistência ~60, temperatura "cold"
- **CPL3 → Visão de Solução**: beliefLevel ~60, resistência ~40, temperatura "warm"
- **Live de Carrinho → Prova + Tensão de Decisão**: beliefLevel ~80, resistência ~20, temperatura "hot"
- **Emails de Carrinho → Urgência**: beliefLevel ~85, resistência ~15, temperatura "hot"

O sistema também adapta o estado com base no engajamento real dos leads:
- Se os contatos estão abrindo, clicando, respondendo (engajamento "up") → o estado avança: mais crença, menos resistência, temperatura mais quente
- Se o engajamento está baixo → o estado recua: o copy do próximo item precisa reconstruir a base antes de avançar

Isso fecha o loop entre a psicologia planejada e o comportamento real dos leads.

---

## 6. MEMORY PRIORITIZATION — Os 7 Âncoras Emocionais

Em lançamentos longos, a IA processa muita informação. Os 7 Âncoras de Memória Emocional são os campos que NUNCA podem ser perdidos ou esquecidos entre agentes — eles são a identidade psicológica do avatar e da campanha:

1. **Medo central do avatar** — a emoção mais profunda que está por trás de toda resistência
2. **Desejo dominante** — o que ele realmente quer no nível identitário
3. **Identidade aspiracional** — quem ele quer se tornar com o produto
4. **Objeção principal** — a razão número 1 pela qual ele NÃO compraria
5. **Linguagem específica** — as palavras exatas que ele usa (não as palavras do mercado)
6. **Traumas de mercado** — promessas que o setor já quebrou para esse avatar (o que ele já tentou e não funcionou)
7. **Mecanismo desejado** — qual tipo de solução ele acredita que poderia funcionar para ele

Esses 7 campos são injetados em TODOS os agentes, em TODA geração, independentemente de qual fase do lançamento esteja sendo executada.

---

## 7. PROFILE INJECTOR PIPELINE — Como Tudo Se Conecta

Quando qualquer agente da NexOS gera conteúdo, ele recebe 11 camadas de contexto, nesta ordem:

1. Contexto temporal (data atual, fase do lançamento)
2. PLF Supremacy (a fórmula de lançamento adaptada para o Brasil)
3. DOMINO CORE (filosofia central de persuasão)
4. Applied Frameworks (frameworks de copy e storytelling)
5. Cognitive Foundations (princípios de psicologia do consumidor)
6. Master Evolution (padrões de alta performance do mercado global)
7. Campaign Memory Layer (o que já foi gerado, aprovado, rejeitado)
8. **Perfil Psicológico** — os 6 mapas + Avatar Voice File + visão geral do arco emocional
9. **Estado Emocional da Fase** — beliefLevel, resistanceLevel, temperatura de compra, pergunta dominante, fragmento de voz para aquela fase específica
10. System Prompt do agente (as instruções específicas de cada especialista)
11. DOMINO Self-Critic (o agente questiona o próprio output antes de finalizar)

O resultado: cada agente não apenas sabe "o que gerar" — sabe "para quem", "em que estado emocional", "em que fase do arco", "usando qual linguagem", e "evitando quais erros do mercado". É a diferença entre contratar um copywriter e contratar um copywriter que passou 2 anos estudando cada detalhe daquele avatar específico.

---

## 8. EMOTIONAL COHERENCE CHECKER — O Auditor do Arco

Após gerar todas as peças, a NexOS executa automaticamente um Verificador de Coerência Emocional. Esse agente lê TODAS as peças geradas e verifica:

- O CPL3 realmente está entregando "visão de solução" ou está repetindo o CPL2?
- A live está presumindo o nível certo de crença (prova + tensão de decisão) ou ainda está amplificando dor?
- Os anúncios estão criando o estado emocional correto para entrada no funil?
- Alguma fase do arco está sem cobertura? (ex: campanha sem nenhuma peça na fase "alívio pós-compra")

O checker retorna um relatório com:
- **Score de coerência** (0–100)
- **Issues por peça** (crítico / aviso / informativo)
- **Coerência por fase** do arco
- **Fortalezas** da progressão emocional
- **Recomendações** para fechar lacunas

Na prática, isso elimina o problema mais comum dos lançamentos: peças de conteúdo que individualmente são boas mas juntas não constroem a progressão emocional necessária para levar o avatar da curiosidade à decisão de compra.

════════════════════════════════════════════════════════════════
FIM DO NEXOS COGNITIVE IDENTITY SYSTEM
════════════════════════════════════════════════════════════════

SUAS DIRETRIZES COMO PROFESSOR ALLAN:
1. Responda com base no conteúdo desta aula e nas aulas já estudadas. Você pode EXPANDIR com exemplos práticos, analogias e aplicações reais — mesmo que não estejam textualmente na aula. O objetivo é que o aluno ENTENDA e consiga APLICAR.
2. Quando o aluno perguntar sobre qualquer conceito do NEXOS COGNITIVE IDENTITY SYSTEM (Arco Emocional, Avatar Voice File, Profile Injector, Avatar State, Coerência Emocional, os 6 mapas, os 7 âncoras), explique com profundidade e conecte ao conteúdo da aula atual.
3. Quando o aluno pedir um exemplo prático (de um nicho, produto, mercado específico), DÊ o exemplo completo. Não peça para imaginar — mostre o raciocínio aplicado àquele contexto.
4. Conecte SEMPRE o conteúdo teórico à aplicação prática na NexOS AI: qual agente é ativado, em qual fase do lançamento, o que acontece na plataforma quando esse conceito é executado.
5. Se a pergunta envolver tópico futuro, mencione em qual aula será aprofundado mas responda o que for possível agora.
6. Não repita o conteúdo da aula textualmente — responda diretamente com suas próprias palavras, enriquecidas com exemplos.
7. Máximo 600 palavras por resposta padrão. Se o aluno pedir breakdown técnico detalhado, pode ir além.
8. Use português do Brasil, tom de mentor prático e entusiasmado — direto, sem enrolação.
9. Use **negrito** para termos-chave, listas numeradas para processos, bullets para exemplos.
10. Exemplos de negócios específicos (academia de BJJ, info-produto, e-commerce): use dados e números realistas do mercado brasileiro.`;

  const messages: Anthropic.MessageParam[] = [
    ...(parsed.history ?? []).map(h => ({
      role: h.role as "user" | "assistant",
      content: h.content,
    })),
    { role: "user", content: parsed.question },
  ];

  try {
    const { client, model } = getAnthropicForAcademy();
    const response = await client.messages.create({
      model,
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    });

    const answer = response.content[0]?.type === "text" ? response.content[0].text : "";
    logger.info({ lessonTitle: parsed.lessonTitle, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens }, "academy: tutor response");
    res.json({ answer });
  } catch (err) {
    logger.error({ err }, "academy: tutor error");
    res.status(502).json({ error: "Não foi possível consultar o professor agora. Tente novamente em instantes." });
  }
});

// POST /api/academy/simulate-confirm (dev/owner only — manually confirms a pending purchase)
router.post("/simulate-confirm", async (req, res): Promise<void> => {
  if (env.NODE_ENV === "production") {
    res.status(403).json({ error: "Not available in production." });
    return;
  }

  const { token } = req.body as { token?: string };
  if (!token) {
    res.status(400).json({ error: "token required" });
    return;
  }

  const [purchase] = await db
    .select()
    .from(academyPurchasesTable)
    .where(or(
      eq(academyPurchasesTable.accessToken, token.toUpperCase()),
      eq(academyPurchasesTable.id, token)
    ))
    .limit(1);

  if (!purchase) {
    res.status(404).json({ error: "Purchase not found" });
    return;
  }

  await db
    .update(academyPurchasesTable)
    .set({ status: "confirmed", confirmedAt: new Date() })
    .where(eq(academyPurchasesTable.id, purchase.id));

  res.json({ ok: true, token: purchase.accessToken, email: purchase.customerEmail });
});

// GET /api/academy/admin/purchases — owner dashboard (protected by ACADEMY_ADMIN_SECRET)
router.get("/admin/purchases", async (req, res): Promise<void> => {
  const secret = req.headers["x-admin-secret"] ?? req.query["secret"];
  const adminSecret = process.env["ACADEMY_ADMIN_SECRET"] ?? "nexos2025";
  if (secret !== adminSecret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const purchases = await db
      .select()
      .from(academyPurchasesTable)
      .orderBy(academyPurchasesTable.createdAt);

    const result = purchases.map(p => ({
      id: p.id,
      name: p.customerName,
      email: p.customerEmail,
      product: p.productId,
      status: p.status,
      token: p.accessToken,
      asaasPaymentId: p.asaasPaymentId,
      createdAt: p.createdAt,
      confirmedAt: p.confirmedAt,
    }));

    res.json({ purchases: result });
  } catch (err) {
    logger.error({ err }, "academy: admin purchases error");
    res.status(500).json({ error: "Internal error" });
  }
});

// POST /api/academy/admin/confirm — manually confirm a purchase and (re)send access email
router.post("/admin/confirm", async (req, res): Promise<void> => {
  const secret = req.headers["x-admin-secret"] ?? req.query["secret"];
  const adminSecret = process.env["ACADEMY_ADMIN_SECRET"] ?? "nexos2025";
  if (secret !== adminSecret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { purchaseId } = req.body as { purchaseId?: string };
  if (!purchaseId) { res.status(400).json({ error: "purchaseId required" }); return; }

  const [purchase] = await db
    .select()
    .from(academyPurchasesTable)
    .where(eq(academyPurchasesTable.id, purchaseId))
    .limit(1);

  if (!purchase) { res.status(404).json({ error: "Not found" }); return; }

  await db.update(academyPurchasesTable)
    .set({ status: "confirmed", confirmedAt: new Date() })
    .where(eq(academyPurchasesTable.id, purchaseId));

  // Fire access email (non-blocking)
  const productInfo = ACADEMY_PRODUCTS[purchase.productId as keyof typeof ACADEMY_PRODUCTS];
  setImmediate(() => {
    sendAccessEmail({
      email: purchase.customerEmail,
      name: purchase.customerName ?? "",
      token: purchase.accessToken,
      productName: productInfo?.name ?? purchase.productId,
      portalUrl: `${env.APP_URL}/nexos-academy/`,
    }).catch(err => logger.error({ err }, "academy: admin resend email error"));
  });

  res.json({ ok: true, token: purchase.accessToken, email: purchase.customerEmail });
});

// POST /api/academy/admin/gift-codes — generate N gift access codes (owner only)
router.post("/admin/gift-codes", async (req, res): Promise<void> => {
  const secret = req.headers["x-admin-secret"] ?? req.query["secret"];
  const adminSecret = process.env["ACADEMY_ADMIN_SECRET"] ?? "nexos2025";
  if (secret !== adminSecret) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { count = 5, productId = "complete-bundle" } = req.body as { count?: number; productId?: string };
  const product = ACADEMY_PRODUCTS[productId as keyof typeof ACADEMY_PRODUCTS];
  if (!product) { res.status(400).json({ error: "Produto inválido" }); return; }

  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  function makeToken() {
    let t = "";
    for (let i = 0; i < 12; i++) {
      if (i === 4 || i === 8) t += "-";
      t += chars[Math.floor(Math.random() * chars.length)];
    }
    return t;
  }

  const rows = Array.from({ length: Math.min(count, 50) }, () => ({
    accessToken: makeToken(),
    customerEmail: "brinde@nexos.ai",
    customerName: "Convidado",
    productId,
    status: "confirmed" as const,
    amountCents: 0,
    confirmedAt: new Date(),
  }));

  const inserted = await db
    .insert(academyPurchasesTable)
    .values(rows)
    .returning({ id: academyPurchasesTable.id, accessToken: academyPurchasesTable.accessToken });

  logger.info({ count: inserted.length, productId }, "academy: gift codes generated");
  res.status(201).json({ codes: inserted.map(r => r.accessToken), total: inserted.length });
});

// ── CRM endpoints ────────────────────────────────────────────────────────────

const CRM_SECRET = process.env["ACADEMY_ADMIN_SECRET"] ?? "nexos2025";
function checkCrm(req: import("express").Request, res: import("express").Response): boolean {
  const s = req.headers["x-admin-secret"] ?? req.query["secret"];
  if (s !== CRM_SECRET) { res.status(401).json({ error: "Unauthorized" }); return false; }
  return true;
}

// GET /api/academy/leads/:id — lead detail + funnel email history
router.get("/leads/:id", async (req, res): Promise<void> => {
  if (!checkCrm(req, res)) return;
  const { id } = req.params;
  const [lead] = await db.select().from(academyLeadsTable).where(eq(academyLeadsTable.id, id)).limit(1);
  if (!lead) { res.status(404).json({ error: "Lead not found" }); return; }

  const emails = await db
    .select()
    .from(academyFunnelEmailsTable)
    .where(eq(academyFunnelEmailsTable.leadId, id))
    .orderBy(academyFunnelEmailsTable.step);

  // Check if they purchased
  const purchases = await db
    .select({ id: academyPurchasesTable.id, productId: academyPurchasesTable.productId, status: academyPurchasesTable.status, confirmedAt: academyPurchasesTable.confirmedAt })
    .from(academyPurchasesTable)
    .where(eq(academyPurchasesTable.customerEmail, lead.email));

  res.json({ lead, funnelEmails: emails, purchases });
});

// PATCH /api/academy/leads/:id — update CRM status + notes
router.patch("/leads/:id", async (req, res): Promise<void> => {
  if (!checkCrm(req, res)) return;
  const { id } = req.params;
  const { crmStatus, crmNotes } = req.body as { crmStatus?: string; crmNotes?: string };
  const allowed = ["novo", "contatado", "qualificado", "convertido", "perdido"];
  if (crmStatus && !allowed.includes(crmStatus)) { res.status(400).json({ error: "Status inválido" }); return; }

  await db.update(academyLeadsTable)
    .set({
      ...(crmStatus ? { crmStatus, crmLastActionAt: new Date() } : {}),
      ...(crmNotes !== undefined ? { crmNotes } : {}),
    })
    .where(eq(academyLeadsTable.id, id));

  const [updated] = await db.select().from(academyLeadsTable).where(eq(academyLeadsTable.id, id)).limit(1);
  res.json({ lead: updated });
});

// POST /api/academy/leads/:id/enroll — manually enroll lead in funnel
router.post("/leads/:id/enroll", async (req, res): Promise<void> => {
  if (!checkCrm(req, res)) return;
  const { id } = req.params;
  const [lead] = await db.select().from(academyLeadsTable).where(eq(academyLeadsTable.id, id)).limit(1);
  if (!lead) { res.status(404).json({ error: "Lead not found" }); return; }
  await enrollLeadInFunnel(id);
  res.json({ ok: true });
});

// POST /api/academy/leads/:id/convert — manually mark lead as converted
router.post("/leads/:id/convert", async (req, res): Promise<void> => {
  if (!checkCrm(req, res)) return;
  const { id } = req.params;
  const [lead] = await db.select().from(academyLeadsTable).where(eq(academyLeadsTable.id, id)).limit(1);
  if (!lead) { res.status(404).json({ error: "Lead not found" }); return; }
  await markLeadConverted(lead.email);
  await db.update(academyLeadsTable)
    .set({ crmStatus: "convertido", crmLastActionAt: new Date() })
    .where(eq(academyLeadsTable.id, id));
  res.json({ ok: true });
});

// POST /api/academy/funnel-tick (owner only — force-runs the funnel scheduler tick)
router.post("/funnel-tick", async (req, res): Promise<void> => {
  try {
    await runFunnelSchedulerTick();
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "academy: funnel-tick error");
    res.status(500).json({ error: "tick failed" });
  }
});

export default router;
