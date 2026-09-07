import { Router } from "express";
import { z } from "zod/v4";
import { eq } from "drizzle-orm";
import { db, waitlistTable, workspaceIntegrationsTable } from "@workspace/db";
import { env } from "../../lib/env.js";
import Anthropic from "@anthropic-ai/sdk";
import { logger } from "../../lib/logger.js";
import {
  isLaunchSource,
  reserveLaunchSeat,
  type LaunchReservationResult,
} from "./launch-reservation.service.js";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

async function sendWaitlistConfirmationEmail(opts: {
  toEmail: string;
  name: string;
  launchReservation?: boolean;
}): Promise<void> {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) return;
  const from = `NexOS AI <${env.RESEND_FROM_EMAIL}>`;
  const firstName = escapeHtml(opts.name.split(" ")[0] ?? opts.name);
  const launchCopy = opts.launchReservation
    ? `<p style="font-size:14px;line-height:1.6;color:#94a3b8;margin:0 0 16px;">
       Você reservou uma das <strong style="color:#e2e8f0;">100 vagas iniciais de pré-lançamento</strong>.
     </p>
     <p style="font-size:14px;line-height:1.6;color:#94a3b8;margin:0 0 24px;">
       Sua reserva está confirmada para a abertura inicial. Os detalhes do lançamento e do contato chegarão por e-mail ou WhatsApp. Depois que as primeiras 100 vagas encerrarem, não há data prevista para reabertura e preço ou condições futuras podem ser diferentes.
     </p>`
    : `<p style="font-size:14px;line-height:1.6;color:#94a3b8;margin:0 0 24px;">
       Nossa equipe analisará seu perfil e, quando liberado, você receberá seu <strong style="color:#00f0ff;">código de acesso exclusivo</strong> pelo WhatsApp.
     </p>
     <div style="border:1px solid #00f0ff22;background:#00f0ff08;padding:16px;margin-bottom:24px;">
       <p style="font-size:13px;color:#94a3b8;margin:0;">⏳ Prazo de análise: até <strong style="color:#e2e8f0;">72 horas úteis</strong>. Aguarde nosso contato no WhatsApp informado.</p>
     </div>`;
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:monospace;color:#e2e8f0;">
<div style="max-width:560px;margin:0 auto;padding:32px 16px;">
  <div style="border:1px solid #00f0ff33;padding:32px;">
    <div style="border-bottom:1px solid #00f0ff33;padding-bottom:16px;margin-bottom:24px;">
      <span style="font-size:11px;letter-spacing:0.3em;color:#00f0ff;text-transform:uppercase;">NexOS AI — Solicitação Recebida</span>
    </div>
    <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">Olá, <strong>${firstName}</strong>!</p>
    <p style="font-size:14px;line-height:1.6;color:#94a3b8;margin:0 0 16px;">
      Sua solicitação de acesso à <strong style="color:#e2e8f0;">plataforma NexOS AI</strong> foi recebida com sucesso.
    </p>
    ${launchCopy}
    <div style="border-top:1px solid #ffffff0d;padding-top:16px;margin-top:8px;">
      <span style="font-size:11px;color:#475569;letter-spacing:0.1em;">lancamento@agencianexos.vip · agencianexos.vip</span>
    </div>
  </div>
</div>
</body></html>`;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [opts.toEmail], subject: "✅ Solicitação de acesso NexOS AI recebida", html }),
    });
  } catch (err) {
    logger.warn({ err }, "Waitlist confirmation email failed — non-blocking");
  }
}

// ── Notificação para o ADMIN quando novo lead entra na lista ─────────────────

async function notifyAdminNewLead(opts: {
  name: string;
  whatsapp: string;
  email?: string;
  segment: string;
}): Promise<void> {
  const adminEmail = env.ADMIN_NOTIFY_EMAIL;
  const adminPhone = env.ADMIN_NOTIFY_PHONE;
  const log = logger.child({ component: "waitlist-admin-notify" });

  const segmentLabel = opts.segment === "agency" ? "🏢 Agência/Gestor" : "🚀 Lançador Solo";
  const emailInfo = opts.email ? `\nEmail: ${opts.email}` : "";

  // ── Email para o admin ──────────────────────────────────────────────────────
  if (adminEmail && env.RESEND_API_KEY) {
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:monospace;color:#e2e8f0;">
<div style="max-width:560px;margin:0 auto;padding:32px 16px;">
  <div style="border:1px solid #f59e0b44;padding:32px;">
    <div style="border-bottom:1px solid #f59e0b33;padding-bottom:16px;margin-bottom:24px;">
      <span style="font-size:11px;letter-spacing:0.3em;color:#f59e0b;text-transform:uppercase;">🔔 Novo Lead — NexOS AI</span>
    </div>
    <p style="font-size:16px;font-weight:700;margin:0 0 20px;color:#fff;">Novo solicitante de acesso!</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <tr><td style="padding:8px 0;color:#94a3b8;width:110px;">Nome</td><td style="padding:8px 0;color:#fff;font-weight:700;">${escapeHtml(opts.name)}</td></tr>
      <tr><td style="padding:8px 0;color:#94a3b8;">WhatsApp</td><td style="padding:8px 0;color:#00f0ff;">${escapeHtml(opts.whatsapp)}</td></tr>
      ${opts.email ? `<tr><td style="padding:8px 0;color:#94a3b8;">Email</td><td style="padding:8px 0;color:#e2e8f0;">${escapeHtml(opts.email)}</td></tr>` : ""}
      <tr><td style="padding:8px 0;color:#94a3b8;">Segmento</td><td style="padding:8px 0;color:#e2e8f0;">${segmentLabel}</td></tr>
      <tr><td style="padding:8px 0;color:#94a3b8;">Horário</td><td style="padding:8px 0;color:#e2e8f0;">${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</td></tr>
    </table>
    <div style="margin-top:24px;padding:12px;background:#f59e0b11;border:1px solid #f59e0b33;">
      <p style="font-size:12px;color:#94a3b8;margin:0;">Acesse o painel admin para liberar o código de acesso e entrar em contato via WhatsApp.</p>
    </div>
    <div style="border-top:1px solid #ffffff0d;padding-top:16px;margin-top:24px;">
      <span style="font-size:11px;color:#475569;">lancamento@agencianexos.vip · agencianexos.vip</span>
    </div>
  </div>
</div>
</body></html>`;
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `NexOS AI Alertas <${env.RESEND_FROM_EMAIL}>`,
          to: [adminEmail],
          subject: `🔔 Novo lead: ${opts.name} (${opts.segment}) — NexOS AI`,
          html,
        }),
      });
      log.info({ adminEmail, leadName: opts.name }, "Admin alert email sent");
    } catch (err) {
      log.warn({ err }, "Admin alert email failed — non-blocking");
    }
  }

  // ── WhatsApp para o admin (via workspace do founder com WA conectado) ───────
  if (adminPhone) {
    try {
      // Busca workspace do founder que tenha WhatsApp Business conectado
      const [waIntegration] = await db
        .select({
          workspaceId: workspaceIntegrationsTable.workspaceId,
          accessToken: workspaceIntegrationsTable.accessToken,
          accountId: workspaceIntegrationsTable.accountId,
        })
        .from(workspaceIntegrationsTable)
        .where(
          eq(workspaceIntegrationsTable.provider, "whatsapp_business"),
        )
        .limit(1);

      if (waIntegration?.accessToken && waIntegration.accountId) {
        const waMessage =
          `🔔 *Novo lead NexOS AI*\n\n` +
          `*Nome:* ${opts.name}\n` +
          `*WhatsApp:* ${opts.whatsapp}\n` +
          `${opts.email ? `*Email:* ${opts.email}\n` : ""}` +
          `*Segmento:* ${segmentLabel}\n` +
          `*Horário:* ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`;

        await fetch(
          `https://graph.facebook.com/v20.0/${waIntegration.accountId}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${waIntegration.accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: adminPhone,
              type: "text",
              text: { body: waMessage },
            }),
          },
        );
        log.info({ adminPhone: adminPhone.slice(0, 5) + "***" }, "Admin WhatsApp alert sent");
      } else {
        log.info("Admin WhatsApp alert skipped — no WhatsApp Business integration connected");
      }
    } catch (err) {
      log.warn({ err }, "Admin WhatsApp alert failed — non-blocking");
    }
  }
}

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

  const requestedLaunchSeat = isLaunchSource(source);
  let result: LaunchReservationResult;

  if (requestedLaunchSeat) {
    const reservation = await reserveLaunchSeat({ name, whatsapp, email, segment, source });
    if (!reservation) {
      res.status(409).json({ error: "As vagas iniciais foram encerradas.", code: "LAUNCH_CAPACITY_REACHED" });
      return;
    }
    result = reservation;
  } else {
    const [existing] = await db
      .select({ id: waitlistTable.id, segment: waitlistTable.segment, source: waitlistTable.source })
      .from(waitlistTable)
      .where(eq(waitlistTable.whatsapp, whatsapp))
      .limit(1);
    if (existing) {
      res.json({
        joined: true,
        duplicate: true,
        segment: existing.segment,
        launchReserved: isLaunchSource(existing.source),
        message: "Você já está na lista. Aguarde nosso contato no WhatsApp.",
      });
      return;
    }
    await db.insert(waitlistTable).values({ name, whatsapp, email: email ?? null, segment, source: source ?? null });
    result = { duplicate: false, segment, launchReserved: false };
  }

  // Fire-and-forget: confirmação para o lead + alerta para o admin (paralelo, não-bloqueante)
  if (!result.duplicate) setImmediate(() => {
    const tasks: Promise<void>[] = [];

    if (email) {
      tasks.push(
        sendWaitlistConfirmationEmail({ toEmail: email, name, launchReservation: requestedLaunchSeat }).catch((err) =>
          logger.warn({ err }, "Waitlist confirmation email error"),
        ),
      );
    }

    tasks.push(
      notifyAdminNewLead({ name, whatsapp, email, segment }).catch((err) =>
        logger.warn({ err }, "Admin waitlist notification error"),
      ),
    );

    Promise.all(tasks).catch(() => {});
  });

  res.status(result.duplicate ? 200 : 201).json({
    joined: true,
    duplicate: result.duplicate,
    segment: result.segment,
    launchReserved: result.launchReserved,
    message: result.duplicate ? "Você já tem uma vaga inicial reservada." : "Você entrou na lista de espera!",
  });
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
  // Prefer direct key; fall back to Replit AI integration proxy
  const apiKey = env.ANTHROPIC_API_KEY || env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
  const baseURL = env.ANTHROPIC_API_KEY ? undefined : (env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL || undefined);

  if (!apiKey) {
    res.json({
      reply: "Oi, aqui é o Jeff! Estou com uma instabilidade técnica agora. Me manda mensagem no WhatsApp do grupo — eu respondo lá!",
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
    const clientOpts: ConstructorParameters<typeof Anthropic>[0] = { apiKey };
    if (baseURL) clientOpts.baseURL = baseURL;
    const client = new Anthropic(clientOpts);

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
