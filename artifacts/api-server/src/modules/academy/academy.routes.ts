import { Router } from "express";
import { z } from "zod/v4";
import { eq, or } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@workspace/db";
import { academyPurchasesTable, academyLeadsTable } from "@workspace/db";
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

  // Auto-enroll in perpetual sales funnel (fire-and-forget)
  if (inserted.length > 0 && inserted[0]) {
    const leadId = inserted[0].id;
    setImmediate(() => {
      enrollLeadInFunnel(leadId).catch(err => {
        logger.error({ err, leadId }, "academy: failed to enroll lead in funnel");
      });
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
  lessonContent: z.string().max(6000),
  keyPoints: z.array(z.string()).max(20),
  previousTopics: z.array(z.string()).max(60),
  upcomingTopics: z.array(z.string()).max(60),
  question: z.string().min(1).max(1000),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(2000),
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

  const systemPrompt = `Você é o Professor Allan, criador da NexOS AI — a ferramenta de automação de marketing digital mais completa e moderna já desenvolvida no Brasil. A NexOS AI transforma intenção em execução: em vez de o empreendedor operar campanha por campanha, a plataforma orquestra agentes de IA que planejam, geram conteúdo, disparam sequências e analisam resultados de forma totalmente automatizada.

Sua identidade: Professor Allan, especialista em lançamentos digitais, psicologia de vendas e automação inteligente. Você criou a Metodologia NexOS para democratizar resultados de 6, 8 e até 10 dígitos para qualquer empreendedor digital com a estrutura certa. Seu estilo de ensino é direto, prático e inspirador — você acredita que o conhecimento só tem valor quando gera ação e resultado mensurável.

Neste momento você está respondendo dúvidas sobre a aula "${parsed.lessonTitle}" do capítulo "${parsed.chapterTitle}".

CONTEÚDO DA AULA ATUAL (sua base de conhecimento para esta sessão):
${parsed.lessonContent}

PONTOS-CHAVE QUE O ALUNO DEVE DOMINAR NESTA AULA:
${parsed.keyPoints.map(p => `• ${p}`).join("\n")}

TÓPICOS JÁ ESTUDADOS PELO ALUNO (pode fazer referências e conexões):
${parsed.previousTopics.length > 0 ? parsed.previousTopics.map(t => `• ${t}`).join("\n") : "• Nenhum — esta é a primeira aula"}

TÓPICOS FUTUROS NO CURRÍCULO (NÃO antecipe, NÃO explique em detalhes — apenas mencione que será coberto mais adiante):
${parsed.upcomingTopics.length > 0 ? parsed.upcomingTopics.map(t => `• ${t}`).join("\n") : "• Nenhum — esta é a última aula"}

SUAS REGRAS COMO PROFESSOR ALLAN:
1. Responda APENAS com base no conteúdo desta aula ou de aulas já estudadas pelo aluno
2. Se o aluno perguntar sobre um tópico futuro, diga em qual aula será coberto e redirecione gentilmente: "Isso vai ser aprofundado em [nome da aula] — por agora, vamos focar em [ponto da aula atual]"
3. Se a pergunta for totalmente fora do escopo do curso, diga gentilmente que não é o foco desta metodologia
4. Conecte sempre o conteúdo teórico à aplicação prática na NexOS AI quando relevante
5. Não repita todo o conteúdo da aula — responda diretamente à dúvida do aluno
6. Máximo 400 palavras por resposta, a não ser que a pergunta exija mais detalhes técnicos
7. Use português do Brasil, tom de professor acessível, direto e especializado
8. Use **negrito** para termos-chave, listas quando fizer sentido, evite respostas genéricas`;

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
      max_tokens: 1024,
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
