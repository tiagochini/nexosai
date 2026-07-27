/**
 * JORNADA LIMPA #2 — End-to-End Clean Pipeline Run
 *
 * Product: Mentoria Copywriting PLF para Infoprodutores
 * Budget: R$ 7.000 (triggers targeting + media_buyer)
 * Goal: full pipeline Strategy + Content, zero duplicates, 100% idempotency_key
 */

import { db } from "@workspace/db";
import {
  usersTable,
  workspacesTable,
  campaignsTable,
  contentPiecesTable,
  creditTransactionsTable,
  agentExecutionLogsTable,
} from "@workspace/db";
import { eq, and, count, sql } from "drizzle-orm";

const API = "http://localhost:80/api";

// ─── timing ──────────────────────────────────────────────────────────────────
const START_TS = Date.now();
const elapsed = () => `${Math.floor((Date.now() - START_TS) / 1000)}s`;

// ─── logging ─────────────────────────────────────────────────────────────────
let step = 0;
let passes = 0, fails = 0, warns = 0;
const icon: Record<string, string> = { PASS:"✓", FAIL:"✗", WARN:"⚠", INFO:"·", SKIP:"↷" };

function log(status: "PASS"|"FAIL"|"WARN"|"INFO"|"SKIP", label: string, detail = "") {
  step++;
  if (status === "PASS") passes++;
  else if (status === "FAIL") fails++;
  else if (status === "WARN") warns++;
  const num = String(step).padStart(2, "0");
  console.log(`  ${num} [${icon[status]}] ${label.padEnd(52)} ${detail}`);
}

function section(title: string) {
  const bar = "━".repeat(Math.max(2, 64 - title.length));
  console.log(`\n━━━ ${title} ${bar}`);
}

// ─── http helper ─────────────────────────────────────────────────────────────
async function http(
  method: string,
  path: string,
  opts: { body?: unknown; token?: string; timeoutMs?: number } = {},
): Promise<{ ok: boolean; status: number; data: any; elapsed: number }> {
  const t = Date.now();
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;
    const res = await fetch(`${API}${path}`, {
      method,
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
    });
    let data: any = {};
    try { data = await res.json(); } catch { /**/ }
    return { ok: res.ok, status: res.status, data, elapsed: Date.now() - t };
  } catch (e: any) {
    return { ok: false, status: 0, data: { error: String(e.message) }, elapsed: Date.now() - t };
  }
}

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─── state ───────────────────────────────────────────────────────────────────
let token = "";
let workspaceId = "";
let campaignId = "";
const EMAIL = "jornada2@nexos-test.ai";
const PASS  = "Jornada2Limpa2026!";
const INVITE = "JL2-72980";

// ─────────────────────────────────────────────────────────────────────────────
// FASE 0 — REGISTRO & WORKSPACE
// ─────────────────────────────────────────────────────────────────────────────
async function fase0() {
  section("FASE 0 — REGISTRO & WORKSPACE");

  let r = await http("GET", "/healthz");
  log(r.ok ? "PASS" : "FAIL", "Health check", `HTTP ${r.status}`);

  // Register
  r = await http("POST", "/auth/register", {
    body: { name: "Jornada Limpa 2", email: EMAIL, password: PASS, inviteCode: INVITE },
  });
  token = r.data?.accessToken ?? "";
  log(token ? "PASS" : "FAIL", "Registrar usuário JL2", `status=${r.status} ${r.data?.error ?? ""}`);
  if (!token) {
    // Try login (user may already exist from a previous partial run)
    r = await http("POST", "/auth/login", { body: { email: EMAIL, password: PASS } });
    token = r.data?.accessToken ?? "";
    log(token ? "WARN" : "FAIL", "Login fallback (user já existe)", `status=${r.status}`);
  }
  if (!token) { log("FAIL", "Sem token — abortando Fase 0", ""); return false; }

  // Workspace
  r = await http("GET", "/workspaces/me", { token });
  workspaceId = r.data?.workspace?.id ?? "";
  log(workspaceId ? "PASS" : "FAIL", "Workspace", `wsId=${workspaceId.slice(0,8)}…`);
  if (!workspaceId) return false;

  // Top-up credits (direct DB — avoid credit gate during long pipeline)
  await db.update(workspacesTable)
    .set({ creditsBalance: 3000 })
    .where(eq(workspacesTable.id, workspaceId));
  log("PASS", "Créditos carregados", "balance=3000");

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// FASE 1 — CRIAR CAMPANHA + INTAKE COMPLETO COM BUDGET
// ─────────────────────────────────────────────────────────────────────────────
async function fase1() {
  section("FASE 1 — CRIAR CAMPANHA + INTAKE");

  // Create campaign
  let r = await http("POST", "/campaigns", {
    token,
    body: { title: "Mentoria Copy PLF — Jornada 2", type: "launch", track: "six_digits" },
  });
  campaignId = r.data?.campaign?.id ?? r.data?.id ?? "";
  log(campaignId ? "PASS" : "FAIL", "Criar campanha", `id=${campaignId.slice(0,8)}… status=${r.status}`);
  if (!campaignId) return false;

  // Set complete intake data with budget
  const intakeData: Record<string, unknown> = {
    // Product
    "product.name":        "Método Copy Dominante — Mentoria de Copywriting PLF",
    "product.category":    "Educação / Infoproduto",
    "product.type":        "mentoria_em_grupo",
    "product.price":       1997,
    "product.format":      "Mentoria em grupo ao vivo — 8 semanas, 2 encontros/semana + comunidade privada no Circle",
    "product.delivery":    "Zoom + Circle + materiais gravados no Hotmart",
    "product.bigPromise":  "Escrever copy que vende sem parecer que está vendendo, em 60 dias ou devolvo o dinheiro",
    "product.painPrimary": "Infoprodutores que escrevem horas de conteúdo, mas na hora de fazer copy para vender travam ou soam forçados",
    "product.unique":      "Única mentoria que ensina copy via desconstrução ao vivo de grandes lançamentos brasileiros reais, com análise linha a linha",

    // Avatar
    "avatar.description":    "Infoprodutor entre 28-45 anos, já tem produto validado (R$30k-R$100k/mês), sente que seu copy é o gargalo para chegar no próximo nível",
    "avatar.painPrimary":    "Copia fórmulas de copy americanas que soam artificiais para o mercado brasileiro e não convertem",
    "avatar.desiredOutcome": "Copy autêntico que converte 20%+ nas VSLs e e-mails de PLF sem parecer script genérico de guru",
    "avatar.sophistication": "Nível 3 — já tentou copywriting antes, já comprou cursos, ainda não teve resultado consistente",
    "avatar.awarenessLevel": "problem_aware",
    "avatar.age":            "30-42",
    "avatar.income":         "R$ 15.000 a R$ 50.000/mês",

    // Market
    "market.niche":          "marketing digital / infoprodutos",
    "market.competition":    "Copy Completo (Pedro Sobral), Fórmula do Lançamento, cursos de copywriting americanos traduzidos",
    "market.differentiator": "Foco 100% em copy para PLF brasileiro, desconstrução de lançamentos reais ao vivo, sem fórmulas genéricas",
    "market.positioning":    "Para infoprodutores que querem copy que parece conversa, não anúncio",

    // Launch
    "launch.date":       "2026-09-15",
    "launch.duration":   7,
    "launch.model":      "plf_classico",
    "launch.platform":   "kiwify",
    "launch.revenueTarget": 200000,

    // Budget (REQUIRED for targeting + media_buyer agents)
    "campaign.budget.total":    7000,
    "campaign.budget.traffic":  5500,
    "campaign.budget.creative": 1500,

    // Proof & Social
    "proof.level":           "2.800+ alunos de copywriting, R$12M+ em lançamentos acompanhados, 47 depoimentos em vídeo",
    "proof.testimonials":    47,
    "proof.revenue":         "R$ 12.000.000+",

    // Content
    "content.tone":          "direto, sem jargão, professoral mas informal — como um amigo copywriter explicando",
    "content.cta":           "Garantir vaga na próxima turma",
    "content.platforms":     ["instagram", "email", "youtube"],

    // Objections
    "objections.price":      "R$1.997 é caro para uma mentoria de copy",
    "objections.time":       "Não tenho tempo para mais um curso — já estou sobrecarregado",
    "objections.skepticism": "Já comprei outros cursos de copy e não aprendi nada que realmente funcionasse",

    // Founder
    "founder.name":    "Rafael Mendes",
    "founder.story":   "Ex-redator de agência que migrou para infoprodutos em 2019. Primeiro lançamento: R$320k em 7 dias com copy que escreveu sozinho. Fundou o Método Copy Dominante após frustração com os cursos americanos que não se traduziam para o contexto brasileiro.",
    "founder.credibility": "Responsável pelo copy de 23 lançamentos de 7 dígitos, mentor de 2.800+ infoprodutores",
  };

  r = await http("POST", `/intake/${campaignId}`, {
    token,
    body: { intakeData },
    timeoutMs: 15_000,
  });
  const pct = r.data?.completeness?.percentage ?? "?";
  log(r.ok ? "PASS" : "FAIL", "Salvar intake completo", `completeness=${pct}% status=${r.status}`);

  // Finalize intake
  r = await http("POST", `/intake/${campaignId}/finalize`, { token, timeoutMs: 10_000 });
  const status = r.data?.campaign?.status ?? r.data?.status ?? "?";
  log(r.ok ? "PASS" : "FAIL", "Finalizar intake", `campaign.status=${status} HTTP=${r.status}`);

  return r.ok;
}

// ─────────────────────────────────────────────────────────────────────────────
// FASE 2 — ESTRATÉGIA
// ─────────────────────────────────────────────────────────────────────────────
async function fase2() {
  section("FASE 2 — ESTRATÉGIA");

  let r = await http("POST", `/campaigns/${campaignId}/execute/strategy`, {
    token,
    timeoutMs: 15_000,
  });
  log(r.ok ? "PASS" : "FAIL", "Disparar fase Strategy", `queued=${r.data?.queued} HTTP=${r.status} ${r.data?.error ?? ""}`);
  if (!r.ok) return false;

  // Poll until strategy_ready / awaiting_approval / error
  const STRATEGY_PHASES = new Set([
    "strategy_ready", "awaiting_approval", "generating", "compliance_review",
  ]);
  const FINAL_STRATEGY = new Set(["strategy_ready", "awaiting_approval"]);
  const ERROR_PHASES = new Set(["failed", "cancelled"]);

  let campaignStatus = "analyzing";
  let dots = 0;
  const pollStart = Date.now();
  const STRATEGY_TIMEOUT_MS = 20 * 60 * 1000; // 20 min

  process.stdout.write(`  -- [·] Aguardando Strategy `);

  while (true) {
    await wait(15_000);
    dots++;
    process.stdout.write(".");

    r = await http("GET", `/campaigns/${campaignId}`, { token, timeoutMs: 10_000 });
    campaignStatus = r.data?.campaign?.status ?? "unknown";

    if (FINAL_STRATEGY.has(campaignStatus)) break;
    if (ERROR_PHASES.has(campaignStatus)) break;
    if (Date.now() - pollStart > STRATEGY_TIMEOUT_MS) {
      campaignStatus = "timeout";
      break;
    }
  }

  console.log(` → ${campaignStatus}`);
  const strategyOk = FINAL_STRATEGY.has(campaignStatus);
  log(
    strategyOk ? "PASS" : "FAIL",
    `Strategy fase completa em ${Math.floor((Date.now()-pollStart)/1000)}s`,
    `status=${campaignStatus}`,
  );

  return strategyOk;
}

// ─────────────────────────────────────────────────────────────────────────────
// FASE 3 — CONTEÚDO
// ─────────────────────────────────────────────────────────────────────────────
async function fase3() {
  section("FASE 3 — CONTEÚDO");

  // Top up credits before content (agents are expensive)
  await db.update(workspacesTable)
    .set({ creditsBalance: 5000 })
    .where(eq(workspacesTable.id, workspaceId));
  log("INFO", "Créditos recarregados para fase de conteúdo", "balance=5000");

  // Content may be blocked by SERVER_CONTENT_GRACE_MS — retry up to 5x with 15s gap
  let r: { ok: boolean; status: number; data: any; elapsed: number } = {
    ok: false, status: 0, data: {}, elapsed: 0,
  };
  for (let attempt = 1; attempt <= 5; attempt++) {
    r = await http("POST", `/campaigns/${campaignId}/execute/content`, {
      token, timeoutMs: 15_000,
    });
    if (r.ok) break;
    if (r.status === 503 && r.data?.code === "SERVER_STARTING") {
      const retryMs = (r.data?.retryAfterMs as number | undefined) ?? 15_000;
      log("WARN", `Content 503 SERVER_STARTING (tentativa ${attempt}/5)`, `retryAfter=${retryMs}ms`);
      await wait(retryMs + 2_000);
      continue;
    }
    // Transition guard: if already generating, that's ok
    if (r.data?.code === "INVALID_TRANSITION" && r.data?.data?.current === "generating") {
      log("INFO", "Campanha já em generating — OK", "");
      r.ok = true;
      break;
    }
    break;
  }
  log(r.ok ? "PASS" : "FAIL", "Disparar fase Content", `HTTP=${r.status} ${r.data?.error ?? ""}`);
  if (!r.ok) return false;

  // Poll until awaiting_approval / compliance_review / failed / timeout
  const CONTENT_FINAL = new Set(["awaiting_approval", "compliance_review", "failed", "cancelled"]);
  let campaignStatus = "generating";
  const pollStart = Date.now();
  const CONTENT_TIMEOUT_MS = 35 * 60 * 1000; // 35 min

  process.stdout.write(`  -- [·] Aguardando Content `);

  while (true) {
    await wait(20_000);
    process.stdout.write(".");

    // Reload credits halfway through if low
    if (Date.now() - pollStart > 15 * 60 * 1000) {
      await db.update(workspacesTable)
        .set({ creditsBalance: 8000 })
        .where(eq(workspacesTable.id, workspaceId));
    }

    r = await http("GET", `/campaigns/${campaignId}`, { token, timeoutMs: 10_000 });
    campaignStatus = r.data?.campaign?.status ?? "unknown";

    if (CONTENT_FINAL.has(campaignStatus)) break;
    if (Date.now() - pollStart > CONTENT_TIMEOUT_MS) { campaignStatus = "timeout"; break; }
  }

  console.log(` → ${campaignStatus}`);

  // ── Handle compliance_review (auto-resolution loop) ───────────────────────
  if (campaignStatus === "compliance_review") {
    log("WARN", "Compliance Gate disparado — aguardando auto-resolução", "");
    const complianceStart = Date.now();
    const COMPLIANCE_TIMEOUT_MS = 10 * 60 * 1000;

    process.stdout.write(`  -- [·] Compliance loop `);
    while (true) {
      await wait(15_000);
      process.stdout.write(".");
      r = await http("GET", `/campaigns/${campaignId}`, { token, timeoutMs: 10_000 });
      campaignStatus = r.data?.campaign?.status ?? "unknown";
      if (campaignStatus === "awaiting_approval") break;
      if (campaignStatus === "failed" || campaignStatus === "cancelled") break;
      if (Date.now() - complianceStart > COMPLIANCE_TIMEOUT_MS) {
        campaignStatus = "compliance_timeout";
        break;
      }
    }
    console.log(` → ${campaignStatus}`);
    log(
      campaignStatus === "awaiting_approval" ? "PASS" : "WARN",
      `Compliance loop resultado`,
      `status=${campaignStatus}`,
    );
  }

  const contentOk = campaignStatus === "awaiting_approval";
  log(
    contentOk ? "PASS" : "FAIL",
    `Content fase completa em ${Math.floor((Date.now()-pollStart)/1000)}s`,
    `status=${campaignStatus}`,
  );

  return contentOk;
}

// ─────────────────────────────────────────────────────────────────────────────
// FASE 4 — PROVAS DB (SELECT reais)
// ─────────────────────────────────────────────────────────────────────────────
async function fase4() {
  section("FASE 4 — PROVAS DB");

  // ── A. Contagem de agentes executados vs completados ─────────────────────
  const agentCounts = await db
    .select({
      status: agentExecutionLogsTable.executionStatus,
      n: count(),
    })
    .from(agentExecutionLogsTable)
    .where(eq(agentExecutionLogsTable.campaignId, campaignId))
    .groupBy(agentExecutionLogsTable.executionStatus);

  const byStatus: Record<string, number> = {};
  for (const row of agentCounts) byStatus[row.status ?? "null"] = Number(row.n);
  const totalAgents = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const completedAgents = byStatus["completed"] ?? 0;
  const failedAgents = byStatus["failed"] ?? 0;
  const startedAgents = byStatus["started"] ?? 0;

  log(
    failedAgents === 0 ? "PASS" : "FAIL",
    `Agentes: total=${totalAgents} completed=${completedAgents} failed=${failedAgents} started=${startedAgents}`,
    failedAgents > 0 ? "⚠ há agentes failed" : "",
  );

  if (startedAgents > 0) {
    log("WARN", `${startedAgents} agentes ainda em 'started' (possível snapshot mid-flight)`, "");
  }

  // ── B. Zero peças duplicadas ─────────────────────────────────────────────
  const dupes = await db.execute(sql`
    SELECT type, COUNT(*) n
    FROM content_pieces
    WHERE campaign_id = ${campaignId}
    GROUP BY type HAVING COUNT(*) > 1
  `);
  const dupeRows = (dupes as any).rows ?? [];
  log(
    dupeRows.length === 0 ? "PASS" : "FAIL",
    `Peças duplicadas (HAVING COUNT > 1)`,
    dupeRows.length === 0 ? "ZERO ✓" : JSON.stringify(dupeRows),
  );

  // ── C. Todas as peças geradas ────────────────────────────────────────────
  const pieces = await db.execute(sql`
    SELECT type, status, created_at
    FROM content_pieces
    WHERE campaign_id = ${campaignId}
    ORDER BY type
  `);
  const pieceRows = (pieces as any).rows ?? [];
  log(
    pieceRows.length > 0 ? "PASS" : "FAIL",
    `Content pieces geradas: ${pieceRows.length}`,
    pieceRows.map((p: any) => p.type).join(", "),
  );

  // ── D. 100% das transações de crédito com idempotency_key ────────────────
  const txAudit = await db.execute(sql`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN idempotency_key IS NOT NULL AND idempotency_key != '' THEN 1 ELSE 0 END) AS with_key,
      SUM(CASE WHEN idempotency_key IS NULL OR idempotency_key = '' THEN 1 ELSE 0 END) AS without_key
    FROM credit_transactions
    WHERE workspace_id = ${workspaceId}
  `);
  const tx = ((txAudit as any).rows ?? [])[0] ?? {};
  const txTotal = Number(tx.total ?? 0);
  const txWithKey = Number(tx.with_key ?? 0);
  const txWithout = Number(tx.without_key ?? 0);
  log(
    txWithout === 0 ? "PASS" : "FAIL",
    `Transações crédito: total=${txTotal} com_key=${txWithKey} sem_key=${txWithout}`,
    txWithout === 0 ? "100% idempotentes ✓" : `⚠ ${txWithout} sem key`,
  );

  // ── E. Zero idempotency_key duplicados ────────────────────────────────────
  const dupeTx = await db.execute(sql`
    SELECT idempotency_key, COUNT(*) n
    FROM credit_transactions
    WHERE workspace_id = ${workspaceId}
      AND idempotency_key IS NOT NULL AND idempotency_key != ''
    GROUP BY idempotency_key HAVING COUNT(*) > 1
  `);
  const dupeTxRows = (dupeTx as any).rows ?? [];
  log(
    dupeTxRows.length === 0 ? "PASS" : "FAIL",
    `Transações duplicadas com mesma key (HAVING COUNT > 1)`,
    dupeTxRows.length === 0 ? "ZERO ✓" : JSON.stringify(dupeTxRows),
  );

  // ── F. Créditos totais consumidos ─────────────────────────────────────────
  const totalCredits = await db.execute(sql`
    SELECT SUM(amount) AS total FROM credit_transactions WHERE workspace_id = ${workspaceId}
  `);
  const creditsUsed = Number(((totalCredits as any).rows ?? [])[0]?.total ?? 0);
  log("INFO", `Créditos totais consumidos: ${creditsUsed}`, "");

  // ── G. Transações sem key — detalhamento ─────────────────────────────────
  if (txWithout > 0) {
    const residual = await db.execute(sql`
      SELECT idempotency_key, amount, action, ai_provider, created_at
      FROM credit_transactions
      WHERE workspace_id = ${workspaceId}
        AND (idempotency_key IS NULL OR idempotency_key = '')
      ORDER BY created_at
    `);
    console.log("\n  [DETAIL] Transações sem key:");
    for (const row of (residual as any).rows ?? []) {
      console.log(`    action=${row.action} amount=${row.amount} provider=${row.ai_provider} ts=${String(row.created_at).slice(11,19)}`);
    }
  }

  return { passes, fails, warns, totalAgents, completedAgents, failedAgents, pieceCount: pieceRows.length, creditsUsed, txTotal, txWithout };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n" + "═".repeat(70));
  console.log(" JORNADA LIMPA #2 — NexOS AI Pipeline E2E");
  console.log(" Produto: Método Copy Dominante (Mentoria Copy PLF)");
  console.log(" Budget: R$ 7.000 (triggers targeting + media_buyer)");
  console.log(" Fix: #55 (critique idempotency) + #56 (advisory lock) + sweep null fix");
  console.log("═".repeat(70));

  let ok = await fase0();
  if (!ok) { console.log("\n[ABORTADO] Fase 0 falhou."); process.exit(1); }

  ok = await fase1();
  if (!ok) { console.log("\n[ABORTADO] Fase 1 falhou."); process.exit(1); }

  ok = await fase2();
  if (!ok) { console.log("\n[CONTINUANDO] Strategy falhou mas tentando Content de qualquer forma."); }

  // Even if strategy had issues, try content
  await fase3();

  const results = await fase4();

  section("RESUMO FINAL");
  console.log(`\n  Tempo total: ${elapsed()}`);
  console.log(`  Passos: ${results.passes} pass / ${results.fails} fail / ${results.warns} warn`);
  console.log(`  Agentes: ${results.totalAgents} total, ${results.completedAgents} completed, ${results.failedAgents} failed`);
  console.log(`  Peças geradas: ${results.pieceCount}`);
  console.log(`  Créditos consumidos: ${results.creditsUsed}`);
  console.log(`  Transações sem key: ${results.txWithout}`);
  console.log(`  CampaignId: ${campaignId}`);
  console.log(`  WorkspaceId: ${workspaceId}`);
  console.log("\n" + "═".repeat(70));

  process.exit(results.fails > 0 ? 1 : 0);
}

main().catch(err => {
  console.error("\n[FATAL]", err);
  process.exit(1);
});
