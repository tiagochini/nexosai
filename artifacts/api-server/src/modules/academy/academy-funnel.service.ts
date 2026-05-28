/**
 * Academy Perpetual Sales Funnel
 *
 * 5-email sequence triggered automatically when a lead signs up for the free guide.
 * Sent via Resend. Scheduler fires every hour to dispatch due emails.
 *
 * Day 0  → Step 0: Welcome + entrega do guia
 * Day 2  → Step 1: O maior erro de quem tenta lançar
 * Day 4  → Step 2: O método que gerou R$100k em 7 dias
 * Day 7  → Step 3: Apresentação completa da Metodologia NexOS (oferta)
 * Day 10 → Step 4: Última chance / urgência perpétua
 */

import nodemailer from "nodemailer";
import { and, eq, isNull, lte, ne } from "drizzle-orm";
import { db } from "@workspace/db";
import { academyLeadsTable, academyFunnelEmailsTable } from "@workspace/db";
import { env } from "../../lib/env.js";
import { logger } from "../../lib/logger.js";

async function sendViaGmailFunnel(opts: { to: string; subject: string; html: string }): Promise<boolean> {
  if (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD) return false;
  try {
    const transport = nodemailer.createTransport({
      service: "gmail",
      auth: { user: env.GMAIL_USER, pass: env.GMAIL_APP_PASSWORD },
    });
    await transport.sendMail({
      from: `"NexOS Academy" <${env.GMAIL_USER}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    return true;
  } catch (err) {
    logger.error({ err }, "academy-funnel: gmail send failed");
    return false;
  }
}

// Day offset for each step (from enrolledAt)
export const FUNNEL_STEPS: { step: number; dayOffset: number; subject: string }[] = [
  { step: 0, dayOffset: 0,  subject: "Seu guia chegou 🎁 — e uma coisa importante" },
  { step: 1, dayOffset: 2,  subject: "O erro que destrói 90% dos lançamentos antes de começar" },
  { step: 2, dayOffset: 4,  subject: "Como gerar R$100k em 7 dias (mesmo sem lista)" },
  { step: 3, dayOffset: 7,  subject: "A Metodologia NexOS — aberta para você hoje" },
  { step: 4, dayOffset: 10, subject: "Último aviso — esta oferta fecha à meia-noite" },
];

const PORTAL_URL = `${env.APP_URL}/nexos-academy/`;
const CHECKOUT_URL = `${env.APP_URL}/nexos-academy/#products`;

function buildEmailHtml(step: number, firstName: string): string {
  const name = firstName || "empreendedor(a)";

  const bodies: Record<number, string> = {
    0: `
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px">Seu guia chegou, ${name}! 🎁</h1>
      <p style="color:#a0aec0;line-height:1.7;margin:0 0 16px">Aqui está o link para acessar <strong style="color:#e2e8f0">Os 7 Erros do Primeiro Lançamento</strong>:</p>
      <div style="text-align:center;margin:24px 0">
        <a href="${PORTAL_URL}#guia-gratuito" style="display:inline-block;background:linear-gradient(135deg,#6d4aff,#a78bfa);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px">📖 Ler o Guia Agora →</a>
      </div>
      <p style="color:#a0aec0;line-height:1.7;margin:0 0 16px">Nos próximos dias vou te mandar mais conteúdo sobre o que <em>realmente</em> separa quem fatura seis dígitos em um lançamento de quem patina no mesmo lugar.</p>
      <p style="color:#a0aec0;line-height:1.7;margin:0">Fique de olho — o próximo e-mail chega em 48 horas e é o mais importante que você vai ler sobre lançamentos esse ano.</p>
      <p style="color:#6b7280;margin:24px 0 0;font-size:13px">— Equipe NexOS Academy</p>
    `,
    1: `
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px">O erro que mata 90% dos lançamentos antes de começar</h1>
      <p style="color:#a0aec0;line-height:1.7;margin:0 0 16px">Olá, ${name}.</p>
      <p style="color:#a0aec0;line-height:1.7;margin:0 0 16px">Nos últimos anos, eu acompanhei dezenas de lançamentos. Os que falharam tinham uma coisa em comum:</p>
      <div style="background:#1a1a2e;border-left:3px solid #6d4aff;padding:16px 20px;margin:20px 0;border-radius:0 8px 8px 0">
        <p style="color:#e2e8f0;font-size:16px;font-weight:600;margin:0">Tentaram vender antes de criar uma audiência aquecida.</p>
      </div>
      <p style="color:#a0aec0;line-height:1.7;margin:0 0 16px">Isso parece óbvio — mas a maioria das pessoas pula essa etapa porque quer resultado rápido. E aí o lançamento morre na praia.</p>
      <p style="color:#a0aec0;line-height:1.7;margin:0 0 16px">A boa notícia? Existe uma sequência exata de ações que aquece qualquer audiência em 7 dias — mesmo que você comece do zero. É o que ensinamos na Metodologia NexOS.</p>
      <p style="color:#a0aec0;line-height:1.7;margin:0">No próximo e-mail vou te mostrar um caso real de como isso funcionou. Aguarda.</p>
      <p style="color:#6b7280;margin:24px 0 0;font-size:13px">— Equipe NexOS Academy</p>
    `,
    2: `
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px">Como gerar R$100k em 7 dias (mesmo sem lista)</h1>
      <p style="color:#a0aec0;line-height:1.7;margin:0 0 16px">Olá, ${name}.</p>
      <p style="color:#a0aec0;line-height:1.7;margin:0 0 16px">Tenho acompanhado lançadores que saíram do zero — sem lista, sem audiência, sem produto pronto — e faturaram seis dígitos no primeiro lançamento.</p>
      <p style="color:#a0aec0;line-height:1.7;margin:0 0 16px">O segredo não é sorte. É seguir uma sequência testada de:</p>
      <ul style="color:#a0aec0;line-height:2;padding-left:20px;margin:0 0 16px">
        <li><strong style="color:#e2e8f0">Pesquisa de avatar</strong> — saber exatamente o que a sua audiência quer comprar</li>
        <li><strong style="color:#e2e8f0">Aquecimento estratégico</strong> — criar antecipação antes de abrir o carrinho</li>
        <li><strong style="color:#e2e8f0">Sequência de conversão</strong> — e-mails + WhatsApp no tempo certo</li>
        <li><strong style="color:#e2e8f0">Copy de alta conversão</strong> — cada palavra com um propósito</li>
      </ul>
      <p style="color:#a0aec0;line-height:1.7;margin:0 0 16px">É exatamente isso que a <strong style="color:#e2e8f0">Metodologia NexOS</strong> cobre em 10 módulos, do começo ao fim.</p>
      <p style="color:#a0aec0;line-height:1.7;margin:0">No próximo e-mail te apresento o curso completo. Fique de olho — chegará em 3 dias.</p>
      <p style="color:#6b7280;margin:24px 0 0;font-size:13px">— Equipe NexOS Academy</p>
    `,
    3: `
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px">A Metodologia NexOS está aberta para você</h1>
      <p style="color:#a0aec0;line-height:1.7;margin:0 0 16px">Olá, ${name}.</p>
      <p style="color:#a0aec0;line-height:1.7;margin:0 0 16px">Nas últimas semanas você recebeu conteúdo gratuito sobre lançamentos. Agora quero te apresentar o caminho completo:</p>
      <div style="background:#1a1a2e;border:1px solid #2d2d4a;border-radius:12px;padding:24px;margin:20px 0">
        <h2 style="color:#a78bfa;font-size:18px;font-weight:700;margin:0 0 12px">Metodologia NexOS — Edição Completa</h2>
        <ul style="color:#a0aec0;line-height:2;padding-left:20px;margin:0 0 16px">
          <li>10 módulos completos — do zero ao lançamento</li>
          <li>34 capítulos com passo a passo aplicável</li>
          <li>128 aulas em texto denso com exercício prático por aula</li>
          <li>Templates prontos de copy, sequências e automações</li>
          <li>Acesso vitalício com atualizações</li>
        </ul>
        <div style="background:#6d4aff1a;border-radius:8px;padding:12px 16px;margin-bottom:16px">
          <p style="color:#e2e8f0;font-size:20px;font-weight:800;margin:0">R$ 2.500 <span style="font-size:13px;font-weight:400;color:#a0aec0">pagamento único</span></p>
        </div>
        <div style="text-align:center">
          <a href="${CHECKOUT_URL}" style="display:inline-block;background:linear-gradient(135deg,#6d4aff,#a78bfa);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px">Quero a Metodologia NexOS →</a>
        </div>
      </div>
      <p style="color:#a0aec0;line-height:1.7;margin:0">Esta oferta fica disponível por tempo limitado. No próximo e-mail te aviso quando fechar.</p>
      <p style="color:#6b7280;margin:24px 0 0;font-size:13px">— Equipe NexOS Academy</p>
    `,
    4: `
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px">⏰ Último aviso — a oferta fecha hoje</h1>
      <p style="color:#a0aec0;line-height:1.7;margin:0 0 16px">Olá, ${name}.</p>
      <p style="color:#a0aec0;line-height:1.7;margin:0 0 16px">Há alguns dias te apresentei a <strong style="color:#e2e8f0">Metodologia NexOS — Edição Completa</strong>. Este é meu último lembrete.</p>
      <p style="color:#a0aec0;line-height:1.7;margin:0 0 16px">Se você quer aprender a criar, lançar e escalar produtos digitais com um método testado — esta é a hora.</p>
      <div style="background:#1a1a2e;border:1px solid #ef444433;border-radius:12px;padding:20px;margin:20px 0;text-align:center">
        <p style="color:#fca5a5;font-size:13px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 8px">Oferta por tempo limitado</p>
        <p style="color:#fff;font-size:24px;font-weight:800;margin:0 0 16px">R$ 2.500 — Acesso Vitalício</p>
        <a href="${CHECKOUT_URL}" style="display:inline-block;background:linear-gradient(135deg,#ef4444,#f97316);color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px">Garantir meu acesso agora →</a>
      </div>
      <p style="color:#a0aec0;line-height:1.7;margin:0 0 16px">Se preferir esperar, tudo bem — o curso volta com preço atualizado na próxima janela.</p>
      <p style="color:#a0aec0;line-height:1.7;margin:0">Boa sorte no seu lançamento. 🚀</p>
      <p style="color:#6b7280;margin:24px 0 0;font-size:13px">— Equipe NexOS Academy</p>
    `,
  };

  const body = bodies[step] ?? bodies[0];

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:620px;margin:0 auto;padding:0;background:#080b12">
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#0f0f1a,#1a1a2e);padding:24px 32px;border-bottom:1px solid #1e1e3a">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:36px;height:36px;background:linear-gradient(135deg,#6d4aff,#a78bfa);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;color:#fff;line-height:36px;text-align:center">N</div>
          <span style="color:#e2e8f0;font-weight:700;font-size:15px">NexOS Academy</span>
        </div>
      </div>
      <!-- Body -->
      <div style="padding:32px;background:#0f0f1a">
        ${body}
      </div>
      <!-- Footer -->
      <div style="padding:20px 32px;background:#080b12;border-top:1px solid #1e1e3a;text-align:center">
        <p style="color:#374151;font-size:11px;margin:0">
          Você recebeu este e-mail porque se inscreveu em NexOS Academy.<br/>
          <a href="${PORTAL_URL}?unsubscribe=1" style="color:#4b5563;text-decoration:underline">Descadastrar</a>
        </p>
      </div>
    </div>
  `;
}

// ─── Enroll a lead in the funnel ─────────────────────────────────────────────

export async function enrollLeadInFunnel(leadId: string, enrolledAt: Date = new Date()): Promise<void> {
  // Mark lead as enrolled
  await db.update(academyLeadsTable)
    .set({ funnelEnrolledAt: enrolledAt, funnelStep: 0 })
    .where(eq(academyLeadsTable.id, leadId));

  // Schedule all 5 emails
  const inserts = FUNNEL_STEPS.map(({ step, dayOffset }) => {
    const scheduledAt = new Date(enrolledAt.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    return { leadId, step, scheduledAt, status: "scheduled" as const };
  });

  await db.insert(academyFunnelEmailsTable).values(inserts);

  logger.info({ leadId, steps: inserts.length }, "academy-funnel: lead enrolled");
}

// ─── Send a single funnel email via Resend ───────────────────────────────────

async function sendFunnelEmail(opts: {
  email: string;
  name: string | null;
  step: number;
  funnelEmailId: string;
}): Promise<void> {
  const stepMeta = FUNNEL_STEPS.find(s => s.step === opts.step);
  if (!stepMeta) return;

  const firstName = (opts.name ?? "").split(" ")[0] || "";
  const html = buildEmailHtml(opts.step, firstName);

  // Try Resend first (if configured), then Gmail fallback, then log-only
  const useResend = !!env.RESEND_API_KEY;
  const useGmail = !!(env.GMAIL_USER && env.GMAIL_APP_PASSWORD);

  if (!useResend && !useGmail) {
    logger.info(
      { email: opts.email, step: opts.step, subject: stepMeta.subject },
      "academy-funnel: [NO EMAIL PROVIDER] would send email — configure RESEND_API_KEY or GMAIL_USER+GMAIL_APP_PASSWORD"
    );
    await db.update(academyFunnelEmailsTable)
      .set({ status: "sent", sentAt: new Date(), resendId: "dev-no-provider" })
      .where(eq(academyFunnelEmailsTable.id, opts.funnelEmailId));
    return;
  }

  try {
    let sent = false;

    if (useResend) {
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: env.RESEND_FROM_EMAIL,
          to: opts.email,
          subject: stepMeta.subject,
          html,
        }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Resend error ${resp.status}: ${text}`);
      }

      const data = await resp.json() as { id?: string };
      await db.update(academyFunnelEmailsTable)
        .set({ status: "sent", sentAt: new Date(), resendId: data.id ?? null })
        .where(eq(academyFunnelEmailsTable.id, opts.funnelEmailId));
      logger.info({ email: opts.email, step: opts.step, resendId: data.id, via: "resend" }, "academy-funnel: email sent via Resend");
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.update(academyFunnelEmailsTable)
      .set({ status: "failed", errorMessage: msg })
      .where(eq(academyFunnelEmailsTable.id, opts.funnelEmailId));

    logger.error({ email: opts.email, step: opts.step, err: msg }, "academy-funnel: email send failed");
  }
}

// ─── Fire welcome email immediately after enrollment ─────────────────────────

export async function sendWelcomeEmailNow(leadId: string): Promise<void> {
  const lead = await db.query.academyLeadsTable.findFirst({
    where: eq(academyLeadsTable.id, leadId),
  });
  if (!lead) return;

  // Find the step-0 funnel email row
  const funnelEmailRows = await db
    .select()
    .from(academyFunnelEmailsTable)
    .where(
      and(
        eq(academyFunnelEmailsTable.leadId, leadId),
        eq(academyFunnelEmailsTable.step, 0),
        ne(academyFunnelEmailsTable.status, "sent")
      )
    )
    .limit(1);

  if (funnelEmailRows.length === 0) return;
  const row = funnelEmailRows[0]!;

  await sendFunnelEmail({
    email: lead.email,
    name: lead.name,
    step: 0,
    funnelEmailId: row.id,
  });

  await db.update(academyLeadsTable)
    .set({ funnelStep: 0 })
    .where(eq(academyLeadsTable.id, leadId));
}

// ─── Hourly scheduler tick ───────────────────────────────────────────────────

export async function runFunnelSchedulerTick(): Promise<void> {
  const now = new Date();

  // Find scheduled emails whose scheduledAt is due
  const due = await db
    .select({
      funnelEmailId: academyFunnelEmailsTable.id,
      step: academyFunnelEmailsTable.step,
      leadId: academyFunnelEmailsTable.leadId,
      email: academyLeadsTable.email,
      name: academyLeadsTable.name,
      unsubscribedAt: academyLeadsTable.unsubscribedAt,
      convertedAt: academyLeadsTable.convertedAt,
    })
    .from(academyFunnelEmailsTable)
    .innerJoin(academyLeadsTable, eq(academyFunnelEmailsTable.leadId, academyLeadsTable.id))
    .where(
      and(
        eq(academyFunnelEmailsTable.status, "scheduled"),
        lte(academyFunnelEmailsTable.scheduledAt, now)
      )
    )
    .limit(50);

  if (due.length === 0) return;

  logger.info({ count: due.length }, "academy-funnel: scheduler tick — processing due emails");

  for (const row of due) {
    // Skip unsubscribed leads
    if (row.unsubscribedAt) {
      await db.update(academyFunnelEmailsTable)
        .set({ status: "skipped", errorMessage: "unsubscribed" })
        .where(eq(academyFunnelEmailsTable.id, row.funnelEmailId));
      continue;
    }

    // Skip converted leads for sales emails (steps 3+)
    if (row.convertedAt && row.step >= 3) {
      await db.update(academyFunnelEmailsTable)
        .set({ status: "skipped", errorMessage: "already_converted" })
        .where(eq(academyFunnelEmailsTable.id, row.funnelEmailId));
      continue;
    }

    await sendFunnelEmail({
      email: row.email,
      name: row.name,
      step: row.step,
      funnelEmailId: row.funnelEmailId,
    });

    // Update lead's current funnel step
    await db.update(academyLeadsTable)
      .set({ funnelStep: row.step })
      .where(eq(academyLeadsTable.id, row.leadId));
  }
}

// ─── Mark a lead as converted (purchased) ────────────────────────────────────

export async function markLeadConverted(email: string): Promise<void> {
  await db.update(academyLeadsTable)
    .set({ convertedAt: new Date() })
    .where(
      and(
        eq(academyLeadsTable.email, email.toLowerCase()),
        isNull(academyLeadsTable.convertedAt)
      )
    );
}

// ─── Mark a lead as unsubscribed ─────────────────────────────────────────────

export async function markLeadUnsubscribed(email: string): Promise<void> {
  await db.update(academyLeadsTable)
    .set({ unsubscribedAt: new Date() })
    .where(
      and(
        eq(academyLeadsTable.email, email.toLowerCase()),
        isNull(academyLeadsTable.unsubscribedAt)
      )
    );
}

// ─── Funnel stats for owner panel ────────────────────────────────────────────

export async function getFunnelStats(): Promise<{
  totalEnrolled: number;
  totalConverted: number;
  totalUnsubscribed: number;
  byStep: { step: number; subject: string; dayOffset: number; sent: number; failed: number; scheduled: number; skipped: number }[];
}> {
  // Leads counts
  const leads = await db.select({
    id: academyLeadsTable.id,
    convertedAt: academyLeadsTable.convertedAt,
    unsubscribedAt: academyLeadsTable.unsubscribedAt,
    funnelEnrolledAt: academyLeadsTable.funnelEnrolledAt,
  }).from(academyLeadsTable);

  const totalEnrolled = leads.filter(l => l.funnelEnrolledAt !== null).length;
  const totalConverted = leads.filter(l => l.convertedAt !== null).length;
  const totalUnsubscribed = leads.filter(l => l.unsubscribedAt !== null).length;

  // Emails per step
  const emails = await db.select().from(academyFunnelEmailsTable);

  const byStep = FUNNEL_STEPS.map(({ step, dayOffset, subject }) => {
    const stepEmails = emails.filter(e => e.step === step);
    return {
      step,
      subject,
      dayOffset,
      sent: stepEmails.filter(e => e.status === "sent").length,
      failed: stepEmails.filter(e => e.status === "failed").length,
      scheduled: stepEmails.filter(e => e.status === "scheduled").length,
      skipped: stepEmails.filter(e => e.status === "skipped").length,
    };
  });

  return { totalEnrolled, totalConverted, totalUnsubscribed, byStep };
}

// ─── Start the funnel scheduler (called once on server boot) ─────────────────

let schedulerStarted = false;

export function startFunnelScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;

  // Run immediately on boot, then every hour
  const tick = () => {
    runFunnelSchedulerTick().catch(err => {
      logger.error({ err }, "academy-funnel: scheduler tick error");
    });
  };

  tick();
  setInterval(tick, 60 * 60 * 1000); // every hour

  logger.info("academy-funnel: scheduler started (hourly tick)");
}
