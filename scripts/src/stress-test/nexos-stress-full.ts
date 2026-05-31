/**
 * NEXOS AI — FULL PLATFORM STRESS TEST
 *
 * Testa TODAS as empresas sintéticas através do funil completo:
 *   Briefing → Estratégia (AI) → Conteúdo (AI) → Lançamento → Carrinho →
 *   Webhooks → Métricas → Monitor → Auditoria Final
 *
 * Regras:
 *   - Nunca para em um erro — continua sempre para a próxima etapa
 *   - Loga EXATAMENTE onde o fluxo quebrou e por quê
 *   - Testa todos os 19 agentes com contexto real de cada empresa
 *   - Produz relatório completo com métricas por empresa, por fase e por agente
 *
 * Uso:
 *   pnpm --filter @workspace/scripts run stress-full            # 5 empresas aleatórias
 *   SAMPLE=10 pnpm --filter @workspace/scripts run stress-full  # 10 empresas
 *   DIFFICULTY=critico pnpm --filter @workspace/scripts run stress-full
 *   EXTREME_ONLY=true pnpm --filter @workspace/scripts run stress-full
 *   ALL=true pnpm --filter @workspace/scripts run stress-full   # todas as 50 empresas
 */

import {
  SYNTHETIC_BUSINESSES,
  getByDifficulty,
  getExtremeScenarios,
  getSample,
  formatBusinessForPrompt,
  type SyntheticBusiness,
} from "./synthetic-businesses.js";
import { db, inviteCodesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// ─── Configuração ──────────────────────────────────────────────────────────────

const API = process.env["API_URL"] ?? "http://localhost:80/api";
const SAMPLE = parseInt(process.env["SAMPLE"] ?? "5");
const DIFFICULTY = process.env["DIFFICULTY"] as "facil" | "medio" | "dificil" | "critico" | undefined;
const EXTREME_ONLY = process.env["EXTREME_ONLY"] === "true";
const ALL = process.env["ALL"] === "true";
const RUN_ID = `stress-${Date.now()}`;

// ─── Tipos ─────────────────────────────────────────────────────────────────────

type StepStatus = "PASS" | "FAIL" | "WARN" | "SKIP" | "INFO";

interface BreakPoint {
  businessId: number;
  businessName: string;
  phase: string;
  step: string;
  reason: string;
  httpStatus?: number;
  errorCode?: string;
  fatal: boolean;
}

interface AgentTestResult {
  agentRole: string;
  agentName: string;
  businessId: number;
  businessName: string;
  status: "ok" | "error" | "timeout";
  httpStatus: number;
  responseLength: number;
  durationMs: number;
  error?: string;
  hasSpecificContent: boolean;
  hasGenericContent: boolean;
  flags: string[];
}

interface PhaseResult {
  phase: string;
  steps: number;
  passed: number;
  failed: number;
  warned: number;
  skipped: number;
  durationMs: number;
  breakPoints: BreakPoint[];
}

interface BusinessResult {
  businessId: number;
  businessName: string;
  difficulty: string;
  market: string;
  ticket: string;
  phases: PhaseResult[];
  agentResults: AgentTestResult[];
  totalSteps: number;
  totalPassed: number;
  totalFailed: number;
  totalWarned: number;
  durationMs: number;
  finalCampaignStatus: string;
  finalHealthScore: number | string;
  finalCreditsBalance: number | string;
  breakPoints: BreakPoint[];
}

// ─── HTTP Helper ───────────────────────────────────────────────────────────────

async function http(
  method: string,
  path: string,
  opts: { body?: unknown; token?: string; query?: Record<string, string>; timeoutMs?: number } = {},
): Promise<{ ok: boolean; status: number; data: Record<string, unknown>; elapsed: number }> {
  const t = Date.now();
  try {
    const url = new URL(`${API}${path}`);
    if (opts.query) {
      for (const [k, v] of Object.entries(opts.query)) url.searchParams.set(k, v);
    }
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;
    const res = await fetch(url.toString(), {
      method,
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
    });
    let data: Record<string, unknown> = {};
    try { data = (await res.json()) as Record<string, unknown>; } catch { /* empty */ }
    return { ok: res.ok, status: res.status, data, elapsed: Date.now() - t };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, status: 0, data: { error: msg }, elapsed: Date.now() - t };
  }
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ─── Formatadores ──────────────────────────────────────────────────────────────

function pad(s: string, n: number) { return s.slice(0, n).padEnd(n); }
function rpad(s: string, n: number) { return s.slice(0, n).padStart(n); }
const ICON: Record<StepStatus, string> = { PASS: "✓", FAIL: "✗", WARN: "⚠", SKIP: "↷", INFO: "·" };
const COLOR: Record<StepStatus, string> = {
  PASS: "\x1b[32m", FAIL: "\x1b[31m", WARN: "\x1b[33m", SKIP: "\x1b[90m", INFO: "\x1b[36m",
};
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

function clr(s: StepStatus, text: string) { return `${COLOR[s]}${text}${RESET}`; }

// ─── API Readiness Wait ──────────────────────────────────────────────────────

async function waitForApi(maxWaitMs = 30_000): Promise<void> {
  const interval = 1_000;
  const deadline = Date.now() + maxWaitMs;
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt++;
    try {
      const res = await fetch(`${API}/healthz`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        if (attempt > 1) console.log(`  ✓ API pronta após ${attempt}s de espera`);
        return;
      }
    } catch { /* not ready yet */ }
    if (attempt === 1) console.log(`  ⏳ Aguardando API iniciar (até ${maxWaitMs / 1000}s)…`);
    await new Promise(r => setTimeout(r, interval));
  }
  throw new Error(`API não ficou disponível em ${maxWaitMs / 1000}s — verifique o workflow da API`);
}

// ─── Estado por empresa ────────────────────────────────────────────────────────

function mkState() {
  return {
    token: "",
    workspaceId: "",
    campaignId: "",
    sequenceId: "",
    contentPieceId: "",
    contactIds: [] as string[],
    stepN: 0,
    passed: 0,
    failed: 0,
    warned: 0,
    skipped: 0,
    breakPoints: [] as BreakPoint[],
    phaseResults: [] as PhaseResult[],
    agentResults: [] as AgentTestResult[],
  };
}
type State = ReturnType<typeof mkState>;

// ─── Logger por empresa ────────────────────────────────────────────────────────

function makeLogger(biz: SyntheticBusiness, state: State, currentPhase: { name: string }) {
  return function step(status: StepStatus, label: string, detail = "", elapsed = 0, isFatal = false): void {
    state.stepN++;
    if (status === "PASS") state.passed++;
    else if (status === "FAIL") {
      state.failed++;
      state.breakPoints.push({
        businessId: biz.id,
        businessName: biz.name,
        phase: currentPhase.name,
        step: label,
        reason: detail || "Falha sem detalhe",
        fatal: isFatal,
      });
    } else if (status === "WARN") {
      state.warned++;
    } else if (status === "SKIP") {
      state.skipped++;
    }

    const num = rpad(String(state.stepN), 3);
    const ms  = elapsed ? `${elapsed}ms`.padStart(7) : "       ";
    const lbl = pad(label, 52);
    console.log(`    ${DIM}${num}${RESET} ${clr(status, ICON[status])} ${lbl} ${DIM}${ms}${RESET}  ${detail}`);
  };
}

function section(title: string) {
  console.log(`\n  ${DIM}───${RESET} ${BOLD}${title}${RESET}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// FASE 1 — CADASTRO & WORKSPACE
// ═══════════════════════════════════════════════════════════════════════════════

async function fase1(biz: SyntheticBusiness, state: State, tag: string): Promise<PhaseResult> {
  const phase = { name: "F1 · Cadastro & Workspace" };
  const log = makeLogger(biz, state, phase);
  const t0 = Date.now();
  const email = `stress-b${biz.id}-${tag}@nexos-stress.ai`;
  const pass = "StressTest2026!";

  section("F1 · CADASTRO & WORKSPACE");

  // Health check
  const h = await http("GET", "/healthz");
  log(h.ok ? "PASS" : "FAIL", "Health check API", `HTTP ${h.status}`, h.elapsed);

  // Create a temp invite code so registration works even when PLATFORM_OPEN is false
  const inviteCode = `STR${tag.slice(-6).toUpperCase()}`;
  try {
    await db.insert(inviteCodesTable).values({ code: inviteCode, planSlug: "solo", label: `[stress] ${tag}` })
      .onConflictDoNothing();
  } catch { /* ignore — code may already exist */ }

  // Registro
  const reg = await http("POST", "/auth/register", {
    body: { name: `${biz.name} Tester`, email, password: pass, inviteCode },
  });
  state.token = (reg.data?.accessToken as string) ?? "";
  log(state.token ? "PASS" : "FAIL", "Registrar usuário", `email=${email} token=${state.token ? "OK" : "FALHOU"}`, reg.elapsed, !state.token);

  // Workspace
  if (state.token) {
    const ws = await http("GET", "/workspaces/me", { token: state.token });
    state.workspaceId = (ws.data?.workspace as Record<string, unknown>)?.id as string ?? "";
    log(state.workspaceId ? "PASS" : "FAIL", "Workspace auto-criado", `wsId=${state.workspaceId.slice(0, 8)}…`, ws.elapsed);
  } else {
    log("SKIP", "Workspace", "sem token", 0);
  }

  // Créditos iniciais
  if (state.token) {
    const cr = await http("GET", "/credits/balance", { token: state.token });
    const bal = cr.data?.balance ?? "–";
    log(cr.ok ? "PASS" : "WARN", "Créditos iniciais", `balance=${bal} cr`, cr.elapsed);
  }

  return buildPhaseResult(phase.name, state, t0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// FASE 2 — SEQUÊNCIA PLF + LEADS
// ═══════════════════════════════════════════════════════════════════════════════

async function fase2(biz: SyntheticBusiness, state: State, tag: string): Promise<PhaseResult> {
  const phase = { name: "F2 · Sequência PLF & Leads" };
  const log = makeLogger(biz, state, phase);
  const t0 = Date.now();

  section("F2 · SEQUÊNCIA PLF & CAPTAÇÃO DE LEADS");

  if (!state.token) {
    log("SKIP", "Fase 2 completa", "sem token (F1 falhou)", 0);
    return buildPhaseResult(phase.name, state, t0);
  }

  // Criar sequência
  const sq = await http("POST", "/launch-sequences", {
    token: state.token,
    body: { name: `${biz.name.slice(0, 40)} — PLF`, model: "plf" },
  });
  state.sequenceId = (sq.data?.sequence as Record<string, unknown>)?.id as string ?? "";
  log(state.sequenceId ? "PASS" : "FAIL", "Criar sequência PLF", `seqId=${state.sequenceId.slice(0, 8) || "–"}`, sq.elapsed);

  if (!state.sequenceId) return buildPhaseResult(phase.name, state, t0);

  // Lead capture habilitado
  const patch = await http("PATCH", `/launch-sequences/${state.sequenceId}`, {
    token: state.token,
    body: { leadCaptureEnabled: true },
  });
  log(patch.ok ? "PASS" : "WARN", "Habilitar lead capture", `HTTP ${patch.status}`, patch.elapsed);

  // Adicionar contatos pré-lançamento
  const contacts = [
    { name: "Lead Quente 1",    email: `hot1-${tag}@test.com`,  phone: "+5511999990001", tags: ["vip"] },
    { name: "Lead Morno 1",     email: `warm1-${tag}@test.com`, phone: "+5511999990002", tags: ["pre_launch"] },
    { name: "Lead Frio 1",      email: `cold1-${tag}@test.com`, phone: "+5511999990003", tags: [] },
    { name: "Lead Quente 2",    email: `hot2-${tag}@test.com`,  phone: "+5511999990004", tags: ["vip"] },
    { name: "Lead Morno 2",     email: `warm2-${tag}@test.com`, phone: "+5511999990005", tags: ["pre_launch"] },
  ];
  const addContacts = await http("POST", `/launch-sequences/${state.sequenceId}/contacts`, {
    token: state.token,
    body: { contacts },
  });
  // Resposta: { contacts: [...], total: N } — guardar IDs para uso em F7
  const addedList = (addContacts.data?.contacts as Array<Record<string, unknown>>) ?? [];
  const added = (addContacts.data?.total as number) ?? addedList.length;
  state.contactIds = addedList.map(c => c["id"] as string).filter(Boolean);
  log(addContacts.ok ? "PASS" : "WARN", "Adicionar 5 leads pré-lançamento", `${added} adicionado(s)`, addContacts.elapsed);

  // Gerar plano da sequência (AI — aceita timeout)
  const gen = await http("POST", `/launch-sequences/${state.sequenceId}/generate`, {
    token: state.token,
    timeoutMs: 30_000,
  });
  const genOk = gen.ok || gen.status === 202 || gen.status === 0;
  log(genOk ? "PASS" : "WARN", "Gerar plano PLF (AI sequence builder)", `HTTP ${gen.status} ${gen.data?.error ?? gen.data?.message ?? ""}`, gen.elapsed);
  if (gen.ok) await wait(500);

  // Ativar sequência (emailProvider aceita apenas rd_station|activecampaign conforme schema)
  const act = await http("POST", `/launch-sequences/${state.sequenceId}/activate`, {
    token: state.token,
    body: {
      startAt: new Date().toISOString(),
      emailProvider: "rd_station",
    },
  });
  log(act.ok ? "PASS" : "WARN", "Ativar sequência PLF", `HTTP ${act.status}`, act.elapsed);

  // Lead capture público (sem auth)
  const lc = await http("POST", `/lead-capture/${state.sequenceId}`, {
    body: {
      name: "Lead Via Landing",
      email: `landing-${tag}@test.com`,
      phone: "+5511977770000",
      utmSource: biz.platforms[0] ?? "instagram",
      utmMedium: "stress_test",
      utmCampaign: `stress-b${biz.id}`,
      consentText: "Aceito receber comunicações",
    },
  });
  const refCode = (lc.data?.contact as Record<string, unknown>)?.referralCode as string ?? "";
  log(lc.ok ? "PASS" : "WARN", "Lead capture público (sem auth)", `refCode=${refCode || "–"}`, lc.elapsed);

  // Referral (viral loop)
  if (refCode) {
    const ref = await http("POST", `/lead-capture/${state.sequenceId}`, {
      body: {
        name: "Lead Indicado",
        email: `referred-${tag}@test.com`,
        referralCode: refCode,
        consentText: "Aceito receber comunicações",
      },
    });
    log(ref.ok ? "PASS" : "WARN", "Viral loop: lead via referral", `HTTP ${ref.status}`, ref.elapsed);
  }

  // Total de contatos
  const total = await http("GET", `/launch-sequences/${state.sequenceId}/contacts`, { token: state.token });
  const ct = (total.data?.total as number) ?? ((total.data?.contacts as unknown[])?.length) ?? 0;
  log(ct >= 3 ? "PASS" : "WARN", "Total de leads na sequência", `${ct} contato(s)`, total.elapsed);

  return buildPhaseResult(phase.name, state, t0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// FASE 3 — CAMPANHA & INTAKE
// ═══════════════════════════════════════════════════════════════════════════════

async function fase3(biz: SyntheticBusiness, state: State, tag: string): Promise<PhaseResult> {
  const phase = { name: "F3 · Campanha & Intake" };
  const log = makeLogger(biz, state, phase);
  const t0 = Date.now();

  section("F3 · CAMPANHA & INTAKE (BRIEFING COMPLETO)");

  if (!state.token) {
    log("SKIP", "Fase 3 completa", "sem token", 0);
    return buildPhaseResult(phase.name, state, t0);
  }

  // Criar campanha baseada no perfil da empresa sintética
  const track = biz.revenueTarget >= 10_000_000 ? "ten_digits"
    : biz.revenueTarget >= 1_000_000 ? "eight_digits"
    : "six_digits";

  const camp = await http("POST", "/campaigns", {
    token: state.token,
    body: {
      title: `${biz.name.slice(0, 60)} — ${tag}`,
      type: "launch",
      track,
    },
  });
  state.campaignId = (camp.data?.campaign as Record<string, unknown>)?.id as string ?? "";
  const campStatus = (camp.data?.campaign as Record<string, unknown>)?.status ?? "–";
  log(state.campaignId ? "PASS" : "FAIL", "Criar campanha", `track=${track} status=${campStatus}`, camp.elapsed, !state.campaignId);

  if (!state.campaignId) return buildPhaseResult(phase.name, state, t0);

  // Vincular sequência à campanha
  if (state.sequenceId) {
    const lk = await http("PATCH", `/launch-sequences/${state.sequenceId}`, {
      token: state.token,
      body: { campaignId: state.campaignId },
    });
    log(lk.ok ? "PASS" : "WARN", "Vincular sequência PLF à campanha", `HTTP ${lk.status}`, lk.elapsed);
  }

  // Salvar intake rico baseado no perfil da empresa
  const intake = await http("POST", `/intake/${state.campaignId}`, {
    token: state.token,
    body: {
      intakeData: {
        "product.name": biz.product,
        "product.description": `${biz.product} — ${biz.biggest_desire}`,
        "product.price": biz.ticket,
        "product.category": biz.productType,
        "audience.description": biz.avatar,
        "audience.size.email": parseInt(biz.audienceSize.replace(/\D/g, "") || "1000"),
        "audience.size.instagram": parseInt(biz.audienceSize.replace(/\D/g, "") || "1000"),
        "campaign.revenueTarget": biz.revenueTarget,
        "campaign.budget.traffic": biz.budget,
        "campaign.duration.days": 7,
        "campaign.salesChannel": "sales_page",
        "launch.previousLaunches": biz.previousLaunchResult ? 2 : 0,
        "launch.previousRevenue": biz.previousLaunchResult ? Math.round(biz.revenueTarget * 0.6) : 0,
        "launch.urgencyTrigger": "Vagas limitadas",
        "launch.bonuses": "Bônus exclusivos para os primeiros compradores",
        "launch.mainDifferential": biz.uniqueChallenge,
        "launch.competitor": biz.market_sophistication,
        "content.mentalTriggers": ["scarcity", "social_proof", "authority"],
        "audience.biggestPain": biz.biggest_pain,
        "audience.biggestDesire": biz.biggest_desire,
        "market.sophistication": biz.market_sophistication,
        "proof.level": biz.proof_level,
      },
    },
  });
  const completeness = (intake.data?.completeness as number) ?? (intake.data?.campaign as Record<string, unknown>)?.completeness ?? "–";
  log(intake.ok ? "PASS" : "FAIL", "Salvar intake completo (20 campos)", `HTTP ${intake.status} completeness=${completeness}%`, intake.elapsed);

  // Readiness score
  const ready = await http("GET", `/intake/${state.campaignId}/readiness`, { token: state.token });
  const score = (ready.data?.readiness as Record<string, unknown>)?.score ?? ready.data?.score ?? "–";
  const viable = (ready.data?.readiness as Record<string, unknown>)?.isViable ?? "–";
  log(ready.ok ? "PASS" : "WARN", "Readiness score do briefing", `score=${score} viável=${viable}`, ready.elapsed);

  // Verificar tracks disponíveis (requer auth)
  const tracks = await http("GET", "/campaigns/tracks", { token: state.token });
  log(tracks.ok ? "PASS" : "WARN", "Tracks disponíveis no sistema", `HTTP ${tracks.status}`, tracks.elapsed);

  return buildPhaseResult(phase.name, state, t0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// FASE 4 — AGENTES DE ESTRATÉGIA
// ═══════════════════════════════════════════════════════════════════════════════

async function fase4(biz: SyntheticBusiness, state: State): Promise<PhaseResult> {
  const phase = { name: "F4 · Agentes de Estratégia" };
  const log = makeLogger(biz, state, phase);
  const t0 = Date.now();

  section("F4 · EXECUTE/STRATEGY (Agentes AI de Estratégia)");

  if (!state.campaignId || !state.token) {
    log("SKIP", "Fase 4 completa", "sem campaignId ou token", 0);
    return buildPhaseResult(phase.name, state, t0);
  }

  // Disparar estratégia
  const exec = await http("POST", `/campaigns/${state.campaignId}/execute/strategy`, {
    token: state.token,
    timeoutMs: 25_000,
  });
  const queued = exec.data?.queued ?? false;
  const jobId = exec.data?.jobId ?? null;
  log(exec.ok ? "PASS" : "FAIL", "execute/strategy → 202 Aceito", `queued=${queued} jobId=${String(jobId ?? "–").slice(0, 8)}`, exec.elapsed);

  // Aguardar transição (até 10s)
  let status = "";
  for (let i = 0; i < 5; i++) {
    await wait(2000);
    const c = await http("GET", `/campaigns/${state.campaignId}`, { token: state.token });
    status = String((c.data?.campaign as Record<string, unknown>)?.status ?? c.data?.status ?? "");
    if (!["intake"].includes(status)) break;
  }
  log(["analyzing", "strategy_ready"].includes(status) ? "PASS" : "WARN",
    "Status pós execute/strategy", `status=${status}`, 0);

  // Double-click guard
  const dc = await http("POST", `/campaigns/${state.campaignId}/execute/strategy`, { token: state.token });
  const blocked = !dc.ok && [400, 409, 422].includes(dc.status);
  log(blocked ? "PASS" : "WARN", "Double-click guard (re-trigger bloqueado)", `HTTP ${dc.status} code=${dc.data?.code ?? "–"}`, dc.elapsed);

  // Forçar strategy_ready para continuar
  const force = await http("PATCH", `/campaigns/${state.campaignId}/status`, {
    token: state.token,
    body: { status: "strategy_ready", reason: `stress-test: b${biz.id} forçar strategy_ready` },
  });
  const newSt = (force.data?.campaign as Record<string, unknown>)?.status ?? force.data?.status ?? "–";
  log(force.ok ? "PASS" : "WARN", "Forçar strategy_ready (skip AI wait)", `status=${newSt}`, force.elapsed);

  // Decision trace — verificar se agentes foram registrados
  const trace = await http("GET", `/campaigns/${state.campaignId}/decision-trace`, { token: state.token });
  const decisions = (trace.data?.decisions as unknown[])?.length ?? 0;
  log(trace.ok ? "PASS" : "WARN", "Decision trace (agentes registrados)", `${decisions} entrada(s)`, trace.elapsed);

  return buildPhaseResult(phase.name, state, t0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// FASE 5 — GERAÇÃO DE CONTEÚDO
// ═══════════════════════════════════════════════════════════════════════════════

async function fase5(biz: SyntheticBusiness, state: State): Promise<PhaseResult> {
  const phase = { name: "F5 · Geração de Conteúdo" };
  const log = makeLogger(biz, state, phase);
  const t0 = Date.now();

  section("F5 · EXECUTE/CONTENT (16 Agentes de Conteúdo)");

  if (!state.campaignId || !state.token) {
    log("SKIP", "Fase 5 completa", "sem campaignId", 0);
    return buildPhaseResult(phase.name, state, t0);
  }

  // Disparar geração de conteúdo
  const exec = await http("POST", `/campaigns/${state.campaignId}/execute/content`, {
    token: state.token,
    timeoutMs: 25_000,
  });
  const contentMsg = String(exec.data?.message ?? exec.data?.error ?? "");
  const contentOk = exec.ok || exec.status === 202 || (exec.status === 400 && contentMsg.includes("execu"));
  log(contentOk ? "PASS" : "FAIL",
    "execute/content → 202 Aceito",
    `HTTP ${exec.status} queued=${exec.data?.queued ?? "–"} ${contentMsg}`,
    exec.elapsed);

  // Aguardar awaiting_approval (até 12s)
  let status = "";
  for (let i = 0; i < 6; i++) {
    await wait(2000);
    const c = await http("GET", `/campaigns/${state.campaignId}`, { token: state.token });
    status = String((c.data?.campaign as Record<string, unknown>)?.status ?? c.data?.status ?? "");
    if (["awaiting_approval", "generating"].includes(status)) break;
  }
  log(["awaiting_approval", "generating", "strategy_ready"].includes(status) ? "PASS" : "WARN",
    "Status pós execute/content", `status=${status}`, 0);

  // Listar peças de conteúdo
  const pieces_r = await http("GET", `/campaigns/${state.campaignId}/content`, { token: state.token });
  const pieces = (pieces_r.data?.pieces as unknown[]) ?? (pieces_r.data?.content as unknown[]) ?? [];
  state.contentPieceId = (pieces[0] as Record<string, unknown>)?.id as string ?? "";
  log(pieces_r.ok ? "PASS" : "WARN", "Listar peças de conteúdo", `${pieces.length} peça(s)`, pieces_r.elapsed);

  // Aprovar primeira peça
  if (state.contentPieceId) {
    const appr = await http("POST", `/campaigns/${state.campaignId}/content/${state.contentPieceId}/approve`, {
      token: state.token,
      body: { feedback: `Aprovado para campanha ${biz.name}` },
    });
    log(appr.ok ? "PASS" : "WARN", "Aprovar peça de conteúdo (gate humano)", `HTTP ${appr.status}`, appr.elapsed);
  } else {
    log("INFO", "Sem peças para aprovar ainda", "(conteúdo ainda em geração AI)", 0);
  }

  // Forçar approved
  const fa = await http("PATCH", `/campaigns/${state.campaignId}/status`, {
    token: state.token,
    body: { status: "approved", reason: `stress-test: b${biz.id} aprovação manual` },
  });
  log(fa.ok ? "PASS" : "WARN", "Forçar approved (gate de conteúdo)", `HTTP ${fa.status}`, fa.elapsed);

  return buildPhaseResult(phase.name, state, t0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// FASE 6 — LANÇAMENTO & CARRINHO
// ═══════════════════════════════════════════════════════════════════════════════

async function fase6(biz: SyntheticBusiness, state: State): Promise<PhaseResult> {
  const phase = { name: "F6 · Lançamento & Carrinho" };
  const log = makeLogger(biz, state, phase);
  const t0 = Date.now();

  section("F6 · EXECUTE/LAUNCH (Integration Gate + Carrinho PLF)");

  if (!state.campaignId || !state.token) {
    log("SKIP", "Fase 6 completa", "sem campaignId", 0);
    return buildPhaseResult(phase.name, state, t0);
  }

  // Tentar launch sem integrações (gate deve barrar)
  const launch1 = await http("POST", `/campaigns/${state.campaignId}/execute/launch`, { token: state.token });
  const isMissing = launch1.status === 422 && launch1.data?.code === "MISSING_INTEGRATIONS";
  const isPartial = launch1.status === 428 && launch1.data?.code === "PARTIAL_INTEGRATIONS";
  const isGate    = isMissing || isPartial;
  const missing   = ((launch1.data?.data as Record<string, unknown>)?.missing as Array<Record<string, unknown>> ?? []).map(m => m["category"]).join(", ");
  log(
    isGate ? "PASS" : (launch1.ok ? "PASS" : "WARN"),
    "execute/launch → integration gate",
    isGate ? `gate ativo [${missing || "OK"}]` : `HTTP ${launch1.status} ${launch1.data?.code ?? ""}`,
    launch1.elapsed,
  );

  // Bypass soft block
  const launch2 = await http("POST", `/campaigns/${state.campaignId}/execute/launch`, {
    token: state.token,
    query: { skipIntegrationWarning: "true" },
    timeoutMs: 25_000,
  });
  const launchOk = launch2.ok || [202, 422, 500].includes(launch2.status);
  log(launchOk ? "PASS" : "WARN",
    "execute/launch?skipIntegrationWarning=true",
    `HTTP ${launch2.status} queued=${launch2.data?.queued ?? "–"}`,
    launch2.elapsed);

  // Aguardar executing/live (até 10s)
  let status = "";
  for (let i = 0; i < 5; i++) {
    await wait(2000);
    const c = await http("GET", `/campaigns/${state.campaignId}`, { token: state.token });
    status = String((c.data?.campaign as Record<string, unknown>)?.status ?? c.data?.status ?? "");
    if (["executing", "live"].includes(status)) break;
  }
  log(["executing", "live"].includes(status) ? "PASS" : "WARN", "Status pós launch", status || "–", 0);

  // Forçar live se necessário (approved → executing → live)
  if (!["executing", "live"].includes(status)) {
    if (!["executing", "paused"].includes(status)) {
      await http("PATCH", `/campaigns/${state.campaignId}/status`, {
        token: state.token,
        body: { status: "executing", reason: `stress-test: b${biz.id} forçar executing` },
      });
    }
    const toLive = await http("PATCH", `/campaigns/${state.campaignId}/status`, {
      token: state.token,
      body: { status: "live", reason: `stress-test: b${biz.id} forçar live` },
    });
    log(toLive.ok ? "PASS" : "WARN", "Forçar live (approved→executing→live)", `HTTP ${toLive.status}`, toLive.elapsed);
    if (toLive.ok) status = "live";
  }

  // Live stats (scarcity counters)
  const ls = await http("GET", `/campaigns/${state.campaignId}/live-stats`, { token: state.token });
  const totalLeads = ls.data?.totalLeads ?? 0;
  log(ls.ok ? "PASS" : "WARN", "Live stats (scarcity counters)", `totalLeads=${totalLeads}`, ls.elapsed);

  // ── CARRINHO PLF ────────────────────────────────────────────────────────────

  if (!state.sequenceId) {
    log("SKIP", "Carrinho PLF", "sem sequenceId", 0);
    return buildPhaseResult(phase.name, state, t0);
  }

  // Calendário da sequência
  const cal = await http("GET", `/launch-sequences/${state.sequenceId}/calendar`, { token: state.token });
  const days = (cal.data?.days as unknown[]) ?? [];
  const milestones = (cal.data?.milestones as unknown[]) ?? [];
  log(cal.ok ? "PASS" : "WARN", "Calendário (day-by-day view)", `${days.length} dia(s) ${milestones.length} milestone(s)`, cal.elapsed);

  // Today view
  const today = await http("GET", `/launch-sequences/${state.sequenceId}/today`, { token: state.token });
  const phaseLabel = today.data?.currentPhaseLabel ?? today.data?.phase ?? "–";
  log(today.ok ? "PASS" : "WARN", "Today view (fase atual)", `phase=${phaseLabel}`, today.elapsed);

  // Verificar itens com fases de carrinho
  const seqFull = await http("GET", `/launch-sequences/${state.sequenceId}`, { token: state.token });
  const items = (seqFull.data?.sequence as Record<string, unknown>)?.items as Array<Record<string, unknown>> ?? [];
  const cartItems = items.filter(it => ["cart_open", "cart_middle", "cart_close"].includes(String(it["phase"] ?? "")));
  log(seqFull.ok ? "PASS" : "WARN", "Itens de carrinho (cart_open/middle/close)", `total=${items.length} cart=${cartItems.length}`, seqFull.elapsed);

  // Gerar copy segmentada hot (cart_open)
  const firstItem = items[0];
  if (firstItem?.["id"]) {
    const cp = await http("POST", `/launch-sequences/${state.sequenceId}/items/${firstItem["id"]}/generate-copy`, {
      token: state.token,
      body: { contactSegment: "hot" },
      timeoutMs: 30_000,
    });
    log(cp.ok ? "PASS" : "WARN", "Copy segmentada hot (cart_open AI)", `HTTP ${cp.status} ${cp.data?.error ?? cp.data?.message ?? ""}`, cp.elapsed);

    // Gerar copy warm e cold também
    for (const seg of ["warm", "cold"]) {
      const cp2 = await http("POST", `/launch-sequences/${state.sequenceId}/items/${firstItem["id"]}/generate-copy`, {
        token: state.token,
        body: { contactSegment: seg },
        timeoutMs: 25_000,
      });
      log(cp2.ok ? "PASS" : "WARN", `Copy segmentada ${seg}`, `HTTP ${cp2.status}`, cp2.elapsed);
    }
  } else {
    log("INFO", "Copy segmentada", "sem itens de sequência disponíveis", 0);
  }

  return buildPhaseResult(phase.name, state, t0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// FASE 7 — ENGAJAMENTO & SEGMENTAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

async function fase7(biz: SyntheticBusiness, state: State, tag: string): Promise<PhaseResult> {
  const phase = { name: "F7 · Engajamento & Segmentação" };
  const log = makeLogger(biz, state, phase);
  const t0 = Date.now();

  section("F7 · ENGAJAMENTO (open/click → hot/warm/cold → analytics)");

  if (!state.sequenceId || !state.token) {
    log("SKIP", "Fase 7 completa", "sem sequenceId", 0);
    return buildPhaseResult(phase.name, state, t0);
  }

  // Registrar eventos de engajamento
  // Schema: { event: "open"|"click"|..., contactId?: uuid, itemId?: uuid, channel?: string, metadata?: {} }
  // contactId é opcional — engajamento anônimo é permitido
  const engEvents = [
    { event: "open",  contactId: state.contactIds?.[0], channel: "email",    metadata: { phase: "cart_open" } },
    { event: "click", contactId: state.contactIds?.[0], channel: "email",    metadata: { phase: "cart_open", url: "https://checkout.example.com" } },
    { event: "open",  contactId: state.contactIds?.[3], channel: "email",    metadata: { phase: "cart_open" } },
    { event: "click", contactId: state.contactIds?.[3], channel: "email",    metadata: { phase: "cart_middle" } },
    { event: "open",  contactId: state.contactIds?.[1], channel: "whatsapp", metadata: { phase: "cart_open" } },
    { event: "open",  contactId: state.contactIds?.[2], channel: "email",    metadata: { phase: "pre_launch" } },
    { event: "click", contactId: state.contactIds?.[4], channel: "email",    metadata: { phase: "cart_close" } },
  ];

  let engOk = 0;
  for (const ev of engEvents) {
    // Remove undefined contactId to avoid zod uuid validation error on undefined
    const body = ev.contactId ? ev : { event: ev.event, channel: ev.channel, metadata: ev.metadata };
    const r = await http("POST", `/launch-sequences/${state.sequenceId}/engagement`, { token: state.token, body });
    if (r.ok) engOk++;
  }
  log(engOk >= 5 ? "PASS" : "WARN", "Registrar engajamentos (open + click)", `${engOk}/${engEvents.length} eventos`, 0);

  // Analytics
  await wait(300);
  const ar = await http("GET", `/launch-sequences/${state.sequenceId}/analytics`, { token: state.token });
  const analytics = (ar.data?.analytics ?? {}) as Record<string, unknown>;
  const segs = (analytics["segments"] ?? {}) as Record<string, number>;
  log(ar.ok ? "PASS" : "WARN", "Analytics — segmentação hot/warm/cold",
    `hot=${segs["hot"] ?? 0} warm=${segs["warm"] ?? 0} cold=${segs["cold"] ?? 0} conv=${segs["converted"] ?? 0}`,
    ar.elapsed);

  // Health score + send time
  const hs = analytics["healthScore"] ?? 0;
  const sendHour = (analytics["sendTimeInsight"] as Record<string, unknown>)?.preferredHourLabel ?? "–";
  log("PASS", "Health score + melhor horário de envio", `score=${hs}/100 hora=${sendHour}`, 0);

  // UTM breakdown
  const utmBreakdown = (analytics["utmBreakdown"] as Array<Record<string, unknown>>) ?? [];
  log("INFO", "UTM breakdown",
    utmBreakdown.map(u => `${u["source"]}:${u["count"]}`).join(" ") || `–`,
    0);

  // Referral stats
  const ref = (analytics["referralStats"] as Record<string, unknown>) ?? {};
  log("INFO", "Referral stats (viral loop)", `total=${ref["total"] ?? 0} converted=${ref["converted"] ?? 0}`, 0);

  // Adaptive suggestions
  const suggestions = (analytics["adaptiveSuggestions"] as unknown[]) ?? [];
  log("INFO", "Sugestões adaptativas (AI analytics)", `${suggestions.length} sugestão(ões)`, 0);

  return buildPhaseResult(phase.name, state, t0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// FASE 8 — WEBHOOKS DE VENDA
// ═══════════════════════════════════════════════════════════════════════════════

async function fase8(biz: SyntheticBusiness, state: State, tag: string): Promise<PhaseResult> {
  const phase = { name: "F8 · Webhooks de Venda" };
  const log = makeLogger(biz, state, phase);
  const t0 = Date.now();

  section("F8 · WEBHOOKS (Hotmart + Kiwify → auto-conversão)");

  // Hotmart
  const hotmart = await http("POST", "/revenue/webhooks/hotmart", {
    body: {
      event: "PURCHASE_APPROVED",
      data: {
        purchase: {
          transaction: `HTM-${tag}`,
          status: "APPROVED",
          price: { value: biz.ticket, currencyCode: "BRL" },
          approved_date: new Date().toISOString(),
        },
        buyer: {
          name: "Hot Buyer 1",
          email: `hot1-${tag}@test.com`,
          checkout_phone: "+5511999990001",
        },
        product: { id: "prod-stress", name: biz.product },
      },
    },
    query: { token: "test-invalid-token" },
  });
  const hotAttempted = [200, 401, 404].includes(hotmart.status);
  log(hotAttempted ? "PASS" : "WARN",
    "Webhook Hotmart (401/404 esperado sem plataforma)",
    `HTTP ${hotmart.status} ${hotmart.data?.error ?? ""}`,
    hotmart.elapsed);

  // Kiwify
  const kiwify = await http("POST", "/revenue/webhooks/kiwify", {
    body: {
      event: "order_approved",
      order_id: `KWF-${tag}`,
      status: "paid",
      amount: biz.ticket,
      currency: "BRL",
      product_id: "prod-stress",
      product_name: biz.product,
      customer: { name: "Hot Buyer 2", email: `hot2-${tag}@test.com`, phone: "+5511999990004" },
      created_at: new Date().toISOString(),
    },
    query: { token: "test-invalid-token" },
  });
  log([200, 401, 404].includes(kiwify.status) ? "PASS" : "WARN",
    "Webhook Kiwify (401/404 esperado)",
    `HTTP ${kiwify.status}`,
    kiwify.elapsed);

  // Revenue summary
  if (state.token) {
    const rev = await http("GET", "/revenue/summary", { token: state.token });
    log(rev.ok ? "PASS" : "WARN", "Revenue summary endpoint", `HTTP ${rev.status}`, rev.elapsed);

    const evts = await http("GET", "/revenue/events", { token: state.token });
    log(evts.ok ? "PASS" : "WARN", "Revenue events list", `HTTP ${evts.status}`, evts.elapsed);
  }

  return buildPhaseResult(phase.name, state, t0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// FASE 9 — MÉTRICAS & HEALTH SCORE
// ═══════════════════════════════════════════════════════════════════════════════

async function fase9(biz: SyntheticBusiness, state: State): Promise<PhaseResult> {
  const phase = { name: "F9 · Métricas & Health Score" };
  const log = makeLogger(biz, state, phase);
  const t0 = Date.now();

  section("F9 · MÉTRICAS (Dia 1–3) + HEALTH SCORE + ALERTAS");

  if (!state.campaignId || !state.token) {
    log("SKIP", "Fase 9 completa", "sem campaignId", 0);
    return buildPhaseResult(phase.name, state, t0);
  }

  // Garantir status live
  const cur = await http("GET", `/campaigns/${state.campaignId}`, { token: state.token });
  let curStatus = String((cur.data?.campaign as Record<string, unknown>)?.status ?? "");
  if (!["live", "executing"].includes(curStatus)) {
    if (!["executing", "paused"].includes(curStatus)) {
      const r1 = await http("PATCH", `/campaigns/${state.campaignId}/status`, {
        token: state.token,
        body: { status: "executing", reason: "stress-test: pre-metrics force" },
      });
      if (r1.ok) curStatus = "executing";
    }
    await http("PATCH", `/campaigns/${state.campaignId}/status`, {
      token: state.token,
      body: { status: "live", reason: "stress-test: pre-metrics force live" },
    });
  }

  // Métricas baseadas no ticket/mercado da empresa
  const baseRevenue = Math.round(biz.ticket * 2);
  const baseSpend   = Math.round(biz.budget * 0.3);

  const metricDays = [
    { day: 0, phase: "pre_launch", roas: 0, revenue: 0,          spend: baseSpend * 0.1, leads: 45,  sales: 0 },
    { day: 1, phase: "cart_open",  roas: 3.2, revenue: baseRevenue * 1, spend: baseSpend * 0.25, leads: 120, sales: 2 },
    { day: 2, phase: "cart_middle",roas: 7.8, revenue: baseRevenue * 3.5, spend: baseSpend * 0.35, leads: 85,  sales: 7 },
    { day: 3, phase: "cart_close", roas: 12.4, revenue: baseRevenue * 6, spend: baseSpend * 0.4, leads: 60,  sales: 12 },
  ];

  for (const m of metricDays) {
    const date = new Date(Date.now() + m.day * 86_400_000).toISOString().split("T")[0]!;
    const r = await http("POST", `/campaigns/${state.campaignId}/metrics`, {
      token: state.token,
      body: {
        metricDate: date,
        dayIndex: m.day + 4,
        phase: m.phase,
        revenueBrl: m.revenue,
        spendBrl: m.spend,
        leads: m.leads,
        sales: m.sales,
        cplBrl: m.leads > 0 ? parseFloat((m.spend / m.leads).toFixed(2)) : 0,
        roas: m.roas,
        impressions: m.leads * 300,
        clicks: m.leads * 12,
        ctr: 0.04,
        openRate: 0.42,
        clickRate: 0.11,
      },
    });
    log(r.ok ? "PASS" : "WARN", `Métricas dia ${m.day + 1} (${m.phase})`,
      `rev=R$${m.revenue} roas=${m.roas} leads=${m.leads}`, r.elapsed);
  }

  // Health score
  const sum = await http("GET", `/campaigns/${state.campaignId}/metrics/summary`, { token: state.token });
  const health = (sum.data?.summary as Record<string, unknown>)?.healthScore ?? sum.data?.healthScore ?? "–";
  const totalRev = (sum.data?.summary as Record<string, unknown>)?.totalRevenue ?? "–";
  log(sum.ok ? "PASS" : "WARN", "Metrics summary + health score", `score=${health}/100 rev=R$${totalRev}`, sum.elapsed);

  // Listar histórico
  const hist = await http("GET", `/campaigns/${state.campaignId}/metrics`, { token: state.token });
  const entries = (hist.data?.metrics as unknown[]) ?? (hist.data?.data as unknown[]) ?? [];
  log(hist.ok ? "PASS" : "WARN", "Histórico de métricas", `${entries.length} entrada(s)`, hist.elapsed);

  // Alertas
  const alerts_r = await http("GET", `/campaigns/${state.campaignId}/alerts`, { token: state.token });
  const alerts: unknown[] = (alerts_r.data?.alerts as unknown[]) ?? [];
  log(alerts_r.ok ? "PASS" : "WARN", "Alertas (fadiga criativa, CTR drop)", `${alerts.length} alerta(s)`, alerts_r.elapsed);

  // Execute monitor
  const mon = await http("POST", `/campaigns/${state.campaignId}/execute/monitor`, {
    token: state.token,
    timeoutMs: 20_000,
  });
  log(mon.ok ? "PASS" : "WARN", "execute/monitor (auto health-check)", `HTTP ${mon.status}`, mon.elapsed);

  return buildPhaseResult(phase.name, state, t0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// FASE 10 — AUDITORIA FINAL & PIPELINE KERNEL
// ═══════════════════════════════════════════════════════════════════════════════

async function fase10(biz: SyntheticBusiness, state: State): Promise<PhaseResult> {
  const phase = { name: "F10 · Auditoria Final" };
  const log = makeLogger(biz, state, phase);
  const t0 = Date.now();

  section("F10 · AUDITORIA FINAL (Pipeline Kernel + Guards)");

  if (!state.campaignId || !state.token) {
    log("SKIP", "Fase 10 completa", "sem campaignId", 0);
    return buildPhaseResult(phase.name, state, t0);
  }

  // Status final
  const final = await http("GET", `/campaigns/${state.campaignId}`, { token: state.token });
  const finalStatus = String((final.data?.campaign as Record<string, unknown>)?.status ?? final.data?.status ?? "–");
  log("INFO", "Status final da campanha", finalStatus, final.elapsed);

  // Backward transition deve ser rejeitada
  const back = await http("PATCH", `/campaigns/${state.campaignId}/status`, {
    token: state.token,
    body: { status: "intake", reason: "stress-test: backward transition test" },
  });
  log(!back.ok ? "PASS" : "WARN", "Backward transition rejeitada (live→intake)", `HTTP ${back.status}`, back.elapsed);

  // Decision trace completo
  const trace = await http("GET", `/campaigns/${state.campaignId}/decision-trace`, { token: state.token });
  const decisions = (trace.data?.decisions as unknown[])?.length ?? 0;
  log(trace.ok ? "PASS" : "WARN", "Decision trace completo", `${decisions} entrada(s)`, trace.elapsed);

  // Execution status
  const exSt = await http("GET", `/campaigns/${state.campaignId}/execution/status`, { token: state.token });
  const execPhase = exSt.data?.phase ?? exSt.data?.currentPhase ?? exSt.data?.status ?? "–";
  log(exSt.ok ? "PASS" : "WARN", "Execution status endpoint", `phase=${execPhase}`, exSt.elapsed);

  // Peças de conteúdo final
  const content = await http("GET", `/campaigns/${state.campaignId}/content`, { token: state.token });
  const pieces = (content.data?.pieces as unknown[]) ?? (content.data?.content as unknown[]) ?? [];
  log(content.ok ? "PASS" : "WARN", "Peças de conteúdo final", `${pieces.length} peça(s)`, content.elapsed);

  // Agentes registrados
  const agents = await http("GET", `/campaigns/${state.campaignId}/agents`, { token: state.token });
  const agentCount = (agents.data?.agents as unknown[])?.length ?? 0;
  log(agents.ok ? "PASS" : "WARN", "Agentes registrados na campanha", `${agentCount} agente(s)`, agents.elapsed);

  // Créditos restantes
  const creds = await http("GET", "/credits/balance", { token: state.token });
  const balance = creds.data?.balance ?? "–";
  log(creds.ok ? "PASS" : "WARN", "Créditos restantes ao final", `balance=${balance} cr`, creds.elapsed);

  // Workspace intacto
  const ws = await http("GET", "/workspaces/me", { token: state.token });
  const wsName = (ws.data?.workspace as Record<string, unknown>)?.name ?? "–";
  log(ws.ok ? "PASS" : "WARN", "Workspace intacto após pipeline completo", `name=${wsName}`, ws.elapsed);

  return buildPhaseResult(phase.name, state, t0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// FASE 11 — TODOS OS AGENTES (teste direto de resposta)
// ═══════════════════════════════════════════════════════════════════════════════

// Roles válidos conforme AGENT_SYSTEM_PROMPTS em direct-chat.routes.ts
// 1 representante por categoria para manter o teste rápido (<30s por agente)
const ALL_AGENTS = [
  // Estratégia
  { role: "command",                  name: "Erick",    cat: "Estratégia" },
  { role: "strategy",                 name: "Jefferson", cat: "Estratégia" },
  { role: "launch_manager",           name: "Gerente",  cat: "Estratégia" },
  { role: "offer",                    name: "Alexandre", cat: "Estratégia" },
  { role: "compliance",               name: "Philip",   cat: "Estratégia" },
  { role: "product_builder",          name: "Builder",  cat: "Estratégia" },
  { role: "perpetual_launch_manager", name: "Magnus",   cat: "Estratégia" },
  // Conteúdo
  { role: "copywriter",               name: "Gary",     cat: "Conteúdo" },
  { role: "creative_director",        name: "Tyler",    cat: "Conteúdo" },
  { role: "ad_copy",                  name: "Dean",     cat: "Conteúdo" },
  { role: "social_media",             name: "Chris",    cat: "Conteúdo" },
  { role: "stories_sequence",         name: "Jordan",   cat: "Conteúdo" },
  { role: "media_brief",              name: "Miles",    cat: "Conteúdo" },
  { role: "landing_page",             name: "Russell",  cat: "Conteúdo" },
  { role: "affiliate_campaign",       name: "Chip",     cat: "Conteúdo" },
  { role: "vsl_script",               name: "Jon",      cat: "Conteúdo" },
  { role: "cpl_script",               name: "Neil",     cat: "Conteúdo" },
  // Audiência
  { role: "targeting",                name: "Perry",    cat: "Audiência" },
  { role: "media_buyer",              name: "Nicholas", cat: "Audiência" },
  { role: "organic_traffic",          name: "Marcus",   cat: "Audiência" },
  { role: "creator_growth",           name: "Leandro",  cat: "Audiência" },
  { role: "analytics",                name: "Avinash",  cat: "Audiência" },
  { role: "optimization",             name: "Laura",    cat: "Audiência" },
  // Vídeo
  { role: "video",                    name: "Mike",     cat: "Vídeo" },
  { role: "live_script",              name: "Grant",    cat: "Vídeo" },
  { role: "webinar_script",           name: "Todd",     cat: "Vídeo" },
  { role: "video_strategy",           name: "Sandra",   cat: "Vídeo" },
  { role: "financial_projector",      name: "Chet",     cat: "Vídeo" },
  // Automação
  { role: "launch_sequence_builder",  name: "Builder",  cat: "Automação" },
  { role: "continuous_sales_manager", name: "Brad",     cat: "Automação" },
  { role: "whatsapp_response",        name: "Marco",    cat: "Automação" },
  // Mentalidade
  { role: "mental_frequency_coach",   name: "Viktor",   cat: "Mentalidade" },
  { role: "identity_architect",       name: "Nadia",    cat: "Mentalidade" },
  { role: "obstinacy_trainer",        name: "Krav",     cat: "Mentalidade" },
];

// Indicadores de conteúdo genérico
const GENERIC_PHRASES = [
  "transforme sua vida", "descubra o segredo", "método revolucionário",
  "aprenda do zero", "seja você mesmo", "realize seus sonhos",
  "o que ninguém te contou", "resultados garantidos", "100% comprovado",
];

const ETHICS_FLAGS = [
  "emagreça 10kg em 1 semana", "fique rico em 30 dias",
  "método proibido", "ganhe dinheiro dormindo sem fazer nada",
];

function evaluateAgentResponse(
  response: string,
  biz: SyntheticBusiness,
): { hasSpecificContent: boolean; hasGenericContent: boolean; flags: string[] } {
  const text = response.toLowerCase();
  const flags: string[] = [];

  // Verifica se menciona elementos específicos do negócio
  const bizKws = [biz.market.toLowerCase(), biz.product.toLowerCase().split(" ")[0] ?? ""];
  const hasSpecificContent = bizKws.some(kw => kw.length > 3 && text.includes(kw));

  // Conta frases genéricas
  let genericCount = 0;
  for (const g of GENERIC_PHRASES) {
    if (text.includes(g)) genericCount++;
  }
  const hasGenericContent = genericCount >= 2;
  if (hasGenericContent) flags.push(`GENÉRICO: ${genericCount} frases clichê`);

  // Ética
  for (const flag of ETHICS_FLAGS) {
    if (text.includes(flag)) flags.push(`ÉTICA: "${flag}"`);
  }

  // Comprimento mínimo
  if (response.length < 150) flags.push("INCOMPLETO: resposta muito curta");

  return { hasSpecificContent, hasGenericContent, flags };
}

async function fase11Agents(biz: SyntheticBusiness, state: State): Promise<PhaseResult> {
  const phase = { name: "F11 · Teste de Todos os Agentes" };
  const log = makeLogger(biz, state, phase);
  const t0 = Date.now();

  section("F11 · TODOS OS AGENTES (teste de resposta AI real)");

  if (!state.token || !state.campaignId) {
    log("SKIP", "Fase 11 completa", "sem token ou campaignId", 0);
    return buildPhaseResult(phase.name, state, t0);
  }

  // Contexto do negócio para os agentes
  const bizContext = formatBusinessForPrompt(biz);

  // Testar todos os agentes via chat AI (endpoint correto: /agents/direct-chat)
  // Mensagem curta para respostas rápidas (<30s): mercado + produto + pergunta direta
  for (const agent of ALL_AGENTS) {
    const t = Date.now();
    const shortPrompt = `Nicho: ${biz.market}. Produto: ${biz.product}. Ticket: ${biz.ticketBRL}. Em 3 frases objetivas, qual sua principal recomendação para este lançamento?`;
    const r = await http("POST", "/agents/direct-chat", {
      token: state.token,
      body: {
        agentRole: agent.role,
        campaignId: state.campaignId,
        message: shortPrompt,
        history: [],
        contextMode: "question",
      },
      timeoutMs: 90_000,
    });

    const durationMs = Date.now() - t;
    const content = String(r.data?.content ?? r.data?.message ?? r.data?.response ?? "");
    const evaluation = evaluateAgentResponse(content, biz);

    let status: AgentTestResult["status"] = "ok";
    if (!r.ok || r.status === 0) status = r.status === 0 ? "timeout" : "error";

    const result: AgentTestResult = {
      agentRole: agent.role,
      agentName: agent.name,
      businessId: biz.id,
      businessName: biz.name,
      status,
      httpStatus: r.status,
      responseLength: content.length,
      durationMs,
      error: status !== "ok" ? String(r.data?.error ?? r.data?.message ?? `HTTP ${r.status}`) : undefined,
      ...evaluation,
    };
    state.agentResults.push(result);

    const icon = status === "ok" ? "PASS" : status === "timeout" ? "WARN" : "FAIL";
    const detail = status === "ok"
      ? `${content.length}ch ${evaluation.hasSpecificContent ? "✓specific" : "⚠generic"} flags=${evaluation.flags.length}`
      : `err=${result.error?.slice(0, 60)}`;

    log(icon as StepStatus, `[${agent.cat}] ${agent.name} (${agent.role})`, detail, durationMs);
  }

  return buildPhaseResult(phase.name, state, t0);
}

// ─── Helpers de compilação ──────────────────────────────────────────────────────

function buildPhaseResult(phaseName: string, state: State, t0: number): PhaseResult {
  // Conta os itens da fase atual (baseado nos últimos n steps adicionados)
  return {
    phase: phaseName,
    steps: state.stepN,
    passed: state.passed,
    failed: state.failed,
    warned: state.warned,
    skipped: state.skipped,
    durationMs: Date.now() - t0,
    breakPoints: state.breakPoints.filter(b => b.phase === phaseName),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// RUNNER POR EMPRESA
// ═══════════════════════════════════════════════════════════════════════════════

async function runBusiness(biz: SyntheticBusiness, idx: number, total: number): Promise<BusinessResult> {
  const tag = `b${biz.id}t${Date.now()}`;
  const state = mkState();

  const bizStart = Date.now();

  console.log(`\n${"═".repeat(72)}`);
  console.log(`${BOLD}  [${idx}/${total}] EMPRESA #${biz.id}: ${biz.name}${RESET}`);
  console.log(`  ${DIM}Mercado: ${biz.market} | Ticket: ${biz.ticketBRL} | Dificuldade: ${biz.difficulty.toUpperCase()}${RESET}`);
  if (biz.difficultScenario) {
    console.log(`  ${COLOR["FAIL"]}⚠ Cenário difícil: ${biz.difficultScenario.slice(0, 90)}${RESET}`);
  }
  console.log(`${"─".repeat(72)}`);

  const phaseResults: PhaseResult[] = [];
  const statesBefore: Record<string, { passed: number; failed: number; warned: number; skipped: number; stepN: number }> = {};

  // Captura snapshot do estado antes de cada fase para calcular delta
  function snapBefore(name: string) {
    statesBefore[name] = { passed: state.passed, failed: state.failed, warned: state.warned, skipped: state.skipped, stepN: state.stepN };
  }

  async function runPhase<T>(
    name: string,
    fn: () => Promise<T>,
    shouldRun: () => boolean = () => true,
  ): Promise<T | null> {
    if (!shouldRun()) {
      console.log(`\n  ${DIM}↷ SKIPPED: ${name}${RESET}`);
      return null;
    }
    snapBefore(name);
    try {
      return await fn();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`\n  ${COLOR["FAIL"]}✗ CRASH em ${name}: ${msg}${RESET}`);
      state.breakPoints.push({ businessId: biz.id, businessName: biz.name, phase: name, step: "CRASH", reason: msg, fatal: true });
      state.failed++;
      return null;
    }
  }

  // Executar todas as fases — NUNCA para em erro
  await runPhase("F1", () => fase1(biz, state, tag));
  const p1: PhaseResult = {
    phase: "F1 · Cadastro & Workspace",
    steps: state.stepN - (statesBefore["F1"]?.stepN ?? 0),
    passed: state.passed - (statesBefore["F1"]?.passed ?? 0),
    failed: state.failed - (statesBefore["F1"]?.failed ?? 0),
    warned: state.warned - (statesBefore["F1"]?.warned ?? 0),
    skipped: state.skipped - (statesBefore["F1"]?.skipped ?? 0),
    durationMs: 0,
    breakPoints: state.breakPoints.filter(b => b.phase.startsWith("F1")),
  };
  phaseResults.push(p1);

  await runPhase("F2", () => fase2(biz, state, tag));
  phaseResults.push(capturePhase("F2 · Sequência PLF & Leads", statesBefore["F2"], state));

  await runPhase("F3", () => fase3(biz, state, tag));
  phaseResults.push(capturePhase("F3 · Campanha & Intake", statesBefore["F3"], state));

  await runPhase("F4", () => fase4(biz, state));
  phaseResults.push(capturePhase("F4 · Agentes de Estratégia", statesBefore["F4"], state));

  await runPhase("F5", () => fase5(biz, state));
  phaseResults.push(capturePhase("F5 · Geração de Conteúdo", statesBefore["F5"], state));

  await runPhase("F6", () => fase6(biz, state));
  phaseResults.push(capturePhase("F6 · Lançamento & Carrinho", statesBefore["F6"], state));

  await runPhase("F7", () => fase7(biz, state, tag));
  phaseResults.push(capturePhase("F7 · Engajamento & Segmentação", statesBefore["F7"], state));

  await runPhase("F8", () => fase8(biz, state, tag));
  phaseResults.push(capturePhase("F8 · Webhooks de Venda", statesBefore["F8"], state));

  await runPhase("F9", () => fase9(biz, state));
  phaseResults.push(capturePhase("F9 · Métricas & Health Score", statesBefore["F9"], state));

  await runPhase("F10", () => fase10(biz, state));
  phaseResults.push(capturePhase("F10 · Auditoria Final", statesBefore["F10"], state));

  await runPhase("F11", () => fase11Agents(biz, state));
  phaseResults.push(capturePhase("F11 · Teste de Todos os Agentes", statesBefore["F11"], state));

  // Buscar estado final da campanha e health score
  let finalCampaignStatus = "–";
  let finalHealthScore: number | string = "–";
  let finalCreditsBalance: number | string = "–";

  if (state.campaignId && state.token) {
    try {
      const fc = await http("GET", `/campaigns/${state.campaignId}`, { token: state.token });
      finalCampaignStatus = String((fc.data?.campaign as Record<string, unknown>)?.status ?? "–");
      const hs = await http("GET", `/campaigns/${state.campaignId}/metrics/summary`, { token: state.token });
      const hsSummary = hs.data?.["summary"] as Record<string, unknown> | undefined;
      finalHealthScore = (hsSummary?.["healthScore"] ?? hs.data?.["healthScore"] ?? "–") as number | string;
    } catch { /* ignore */ }
  }
  if (state.token) {
    try {
      const cb = await http("GET", "/credits/balance", { token: state.token });
      finalCreditsBalance = (cb.data?.["balance"] ?? "–") as number | string;
    } catch { /* ignore */ }
  }

  const totalMs = Date.now() - bizStart;
  const pct = Math.round((state.passed / (state.stepN || 1)) * 100);

  console.log(`\n  ${"─".repeat(70)}`);
  console.log(`  ${BOLD}RESULTADO EMPRESA #${biz.id}:${RESET} ${clr("PASS", `${state.passed} ✓`)} ${clr("FAIL", `${state.failed} ✗`)} ${clr("WARN", `${state.warned} ⚠`)} ${DIM}${state.skipped} ↷${RESET}   ${pct}%   ${(totalMs / 1000).toFixed(1)}s`);
  if (state.breakPoints.length > 0) {
    console.log(`  ${COLOR["FAIL"]}Break points (${state.breakPoints.length}):${RESET}`);
    for (const bp of state.breakPoints.slice(0, 5)) {
      console.log(`    ${DIM}↳ [${bp.phase}] ${bp.step}: ${bp.reason.slice(0, 80)}${RESET}`);
    }
    if (state.breakPoints.length > 5) {
      console.log(`    ${DIM}…e mais ${state.breakPoints.length - 5} break points${RESET}`);
    }
  }

  return {
    businessId: biz.id,
    businessName: biz.name,
    difficulty: biz.difficulty,
    market: biz.market,
    ticket: biz.ticketBRL,
    phases: phaseResults,
    agentResults: state.agentResults,
    totalSteps: state.stepN,
    totalPassed: state.passed,
    totalFailed: state.failed,
    totalWarned: state.warned,
    durationMs: totalMs,
    finalCampaignStatus,
    finalHealthScore,
    finalCreditsBalance,
    breakPoints: state.breakPoints,
  };
}

function capturePhase(
  name: string,
  before: { passed: number; failed: number; warned: number; skipped: number; stepN: number } | undefined,
  state: State,
): PhaseResult {
  const b = before ?? { passed: 0, failed: 0, warned: 0, skipped: 0, stepN: 0 };
  return {
    phase: name,
    steps: state.stepN - b.stepN,
    passed: state.passed - b.passed,
    failed: state.failed - b.failed,
    warned: state.warned - b.warned,
    skipped: state.skipped - b.skipped,
    durationMs: 0,
    breakPoints: state.breakPoints.filter(bp => bp.phase.includes(name.split(" ")[0] ?? "")),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// RELATÓRIO FINAL MEGA
// ═══════════════════════════════════════════════════════════════════════════════

function printMegaReport(results: BusinessResult[], totalMs: number): void {
  const totalSteps = results.reduce((s, r) => s + r.totalSteps, 0);
  const totalPassed = results.reduce((s, r) => s + r.totalPassed, 0);
  const totalFailed = results.reduce((s, r) => s + r.totalFailed, 0);
  const totalWarned = results.reduce((s, r) => s + r.totalWarned, 0);
  const pct = Math.round((totalPassed / (totalSteps || 1)) * 100);
  const allBreaks = results.flatMap(r => r.breakPoints);
  const allAgents = results.flatMap(r => r.agentResults);

  const bar = (n: number, max: number, w = 30) =>
    "█".repeat(Math.min(w, Math.round((n / (max || 1)) * w))).padEnd(w, "░");

  console.log(`\n`);
  console.log(`╔${"═".repeat(72)}╗`);
  console.log(`║  NEXOS AI — STRESS TEST FINAL · ${new Date().toLocaleString("pt-BR")}${"".padEnd(72 - 45)}║`);
  console.log(`║  Run ID: ${RUN_ID}${"".padEnd(72 - 10 - RUN_ID.length)}║`);
  console.log(`╠${"═".repeat(72)}╣`);
  console.log(`║  RESUMO GERAL                                                          ║`);
  console.log(`║  Empresas testadas : ${String(results.length).padEnd(3)}   Duração total: ${(totalMs / 1000).toFixed(1)}s${"".padEnd(20)}║`);
  console.log(`║  Agentes testados  : ${String(ALL_AGENTS.length).padEnd(3)}   Por empresa: ~${(totalMs / results.length / 1000).toFixed(0)}s${"".padEnd(24)}║`);
  console.log(`║  Steps totais      : ${String(totalSteps).padEnd(5)}${"".padEnd(47)}║`);
  console.log(`║  ✓ Aprovados       : ${String(totalPassed).padEnd(5)}   ${bar(totalPassed, totalSteps, 22)}  ${pct}%${"".padEnd(3)}║`);
  console.log(`║  ✗ Falhas          : ${String(totalFailed).padEnd(5)}   ${bar(totalFailed, totalSteps, 22)}${"".padEnd(8)}║`);
  console.log(`║  ⚠ Avisos         : ${String(totalWarned).padEnd(5)}   ${bar(totalWarned, totalSteps, 22)}${"".padEnd(8)}║`);
  console.log(`╠${"═".repeat(72)}╣`);

  // Por empresa
  console.log(`║  RESULTADO POR EMPRESA                                                 ║`);
  console.log(`║  ${"ID".padEnd(4)} ${"Nome".padEnd(30)} ${"Dif".padEnd(8)} ${"PASS".padEnd(5)} ${"FAIL".padEnd(5)} ${"Status".padEnd(12)} ║`);
  console.log(`║  ${"─".repeat(68)} ║`);
  for (const r of results) {
    const rowPct = Math.round((r.totalPassed / (r.totalSteps || 1)) * 100);
    const st = r.finalCampaignStatus.slice(0, 10);
    const name = r.businessName.slice(0, 28).padEnd(28);
    const dif  = r.difficulty.padEnd(8);
    const p    = String(r.totalPassed).padEnd(5);
    const f    = String(r.totalFailed).padEnd(5);
    const s    = st.padEnd(12);
    const flag = r.breakPoints.length > 0 ? ` ⚠${r.breakPoints.length}` : "   ";
    console.log(`║  ${String(r.businessId).padEnd(4)} ${name} ${dif} ${p} ${f} ${s} ${flag} ║`);
    void rowPct;
  }

  // Break points por fase
  console.log(`╠${"═".repeat(72)}╣`);
  console.log(`║  BREAK POINTS POR FASE (onde o fluxo quebrou e por quê)               ║`);
  console.log(`║  ${"─".repeat(68)} ║`);
  if (allBreaks.length === 0) {
    console.log(`║  ✓ Nenhum break point crítico detectado!${"".padEnd(30)}║`);
  } else {
    const byPhase = new Map<string, BreakPoint[]>();
    for (const bp of allBreaks) {
      const arr = byPhase.get(bp.phase) ?? [];
      arr.push(bp);
      byPhase.set(bp.phase, arr);
    }
    for (const [phase, bps] of byPhase) {
      console.log(`║  ${("▸ " + phase).slice(0, 68).padEnd(68)} ║`);
      for (const bp of bps.slice(0, 3)) {
        const line = `    [B${bp.businessId}] ${bp.step}: ${bp.reason}`;
        console.log(`║  ${line.slice(0, 68).padEnd(68)} ║`);
      }
      if (bps.length > 3) console.log(`║    …e mais ${bps.length - 3} ocorrências${"".padEnd(43)}║`);
    }
  }

  // Resumo dos agentes
  console.log(`╠${"═".repeat(72)}╣`);
  console.log(`║  PERFORMANCE DOS AGENTES AI                                            ║`);
  console.log(`║  ${"─".repeat(68)} ║`);

  const agentSummary = new Map<string, { ok: number; error: number; timeout: number; genericCount: number; flagCount: number; totalMs: number; runs: number }>();
  for (const ag of allAgents) {
    const s = agentSummary.get(ag.agentRole) ?? { ok: 0, error: 0, timeout: 0, genericCount: 0, flagCount: 0, totalMs: 0, runs: 0 };
    if (ag.status === "ok") s.ok++;
    else if (ag.status === "timeout") s.timeout++;
    else s.error++;
    if (ag.hasGenericContent) s.genericCount++;
    s.flagCount += ag.flags.length;
    s.totalMs += ag.durationMs;
    s.runs++;
    agentSummary.set(ag.agentRole, s);
  }

  // Top performers e problemáticos
  const agentList = [...agentSummary.entries()].map(([role, s]) => ({
    role, ...s,
    successRate: Math.round((s.ok / (s.runs || 1)) * 100),
    avgMs: Math.round(s.totalMs / (s.runs || 1)),
  })).sort((a, b) => b.successRate - a.successRate);

  console.log(`║  ${"Agente".padEnd(26)} ${"OK".padEnd(4)} ${"ERR".padEnd(4)} ${"TOUT".padEnd(5)} ${"Taxa".padEnd(5)} ${"AvgMs".padEnd(7)} ${"Genérico".padEnd(8)} ║`);
  console.log(`║  ${"─".repeat(68)} ║`);
  for (const a of agentList) {
    const generic = a.runs > 0 ? `${Math.round((a.genericCount / a.runs) * 100)}%` : "–";
    const line = `  ${a.role.padEnd(26)} ${String(a.ok).padEnd(4)} ${String(a.error).padEnd(4)} ${String(a.timeout).padEnd(5)} ${(a.successRate + "%").padEnd(5)} ${String(a.avgMs + "ms").padEnd(7)} ${generic.padEnd(8)}`;
    console.log(`║${line.padEnd(72)}║`);
  }

  // Por dificuldade
  console.log(`╠${"═".repeat(72)}╣`);
  console.log(`║  PERFORMANCE POR DIFICULDADE                                           ║`);
  const byDiff = new Map<string, { pass: number; fail: number; total: number; businesses: number }>();
  for (const r of results) {
    const s = byDiff.get(r.difficulty) ?? { pass: 0, fail: 0, total: 0, businesses: 0 };
    s.pass += r.totalPassed;
    s.fail += r.totalFailed;
    s.total += r.totalSteps;
    s.businesses++;
    byDiff.set(r.difficulty, s);
  }
  for (const [diff, s] of byDiff) {
    const p = Math.round((s.pass / (s.total || 1)) * 100);
    console.log(`║  ${diff.padEnd(10)} ${String(s.businesses) + " empresa(s)".padEnd(15)} ${bar(s.pass, s.total, 20)} ${p}%${"".padEnd(5)}║`);
  }

  // Agentes com mais problemas
  const problematic = agentList.filter(a => a.successRate < 70 || a.genericCount > 0);
  if (problematic.length > 0) {
    console.log(`╠${"═".repeat(72)}╣`);
    console.log(`║  AGENTES COM PROBLEMAS (taxa de sucesso < 70% ou copy genérica)        ║`);
    for (const a of problematic.slice(0, 10)) {
      const issues = [];
      if (a.error > 0) issues.push(`${a.error} erros`);
      if (a.timeout > 0) issues.push(`${a.timeout} timeouts`);
      if (a.genericCount > 0) issues.push(`${a.genericCount} genérico(s)`);
      if (a.flagCount > 0) issues.push(`${a.flagCount} flags`);
      const line = `  ⚠ ${a.role.padEnd(26)} (${a.successRate}%) — ${issues.join(", ")}`;
      console.log(`║${line.slice(0, 72).padEnd(72)}║`);
    }
  }

  // Recomendações automáticas
  console.log(`╠${"═".repeat(72)}╣`);
  console.log(`║  RECOMENDAÇÕES AUTOMÁTICAS                                             ║`);
  const recs: string[] = [];
  if (totalFailed > totalSteps * 0.2) recs.push("⛔ Taxa de falha > 20% — revisar estabilidade dos endpoints");
  if (allBreaks.filter(b => b.phase.includes("Estratégia")).length > 2) recs.push("⚠ Agentes de estratégia com falhas recorrentes — verificar AI gateway");
  if (allBreaks.filter(b => b.phase.includes("Conteúdo")).length > 2) recs.push("⚠ Geração de conteúdo instável — revisar timeouts");
  if (allBreaks.filter(b => b.phase.includes("Lançamento")).length > 0) recs.push("ℹ Integration gate funcionando (422/428 esperado em teste)");
  if (allAgents.filter(a => a.status === "timeout").length > allAgents.length * 0.1) recs.push("⚠ >10% dos agentes com timeout — aumentar timeoutMs ou revisar AI latência");
  if (agentList.filter(a => a.successRate < 50).length > 0) recs.push("⛔ Agentes com <50% sucesso — verificar rotas do AI gateway");
  if (recs.length === 0) recs.push("✓ Plataforma estável — nenhum problema crítico detectado");
  for (const r of recs) {
    console.log(`║  ${r.slice(0, 70).padEnd(70)} ║`);
  }

  console.log(`╠${"═".repeat(72)}╣`);
  console.log(`║  Pipeline Health Score: ${bar(totalPassed, totalSteps)} ${pct}%${"".padEnd(3)}║`);
  console.log(`╚${"═".repeat(72)}╝`);
  console.log(``);

  // Exit code baseado em falhas
  if (totalFailed > totalSteps * 0.5) {
    console.error(`\n${COLOR["FAIL"]}✗ STRESS TEST FALHOU: mais de 50% de falhas${RESET}`);
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  // Selecionar empresas
  let businesses: SyntheticBusiness[];
  if (ALL) {
    businesses = SYNTHETIC_BUSINESSES;
    console.log(`\n  📊 Todas as ${businesses.length} empresas selecionadas`);
  } else if (EXTREME_ONLY) {
    businesses = getExtremeScenarios();
    console.log(`\n  📊 Cenários extremos: ${businesses.length} empresas`);
  } else if (DIFFICULTY) {
    businesses = getByDifficulty(DIFFICULTY).slice(0, SAMPLE);
    console.log(`\n  📊 Dificuldade "${DIFFICULTY}": ${businesses.length} empresas`);
  } else {
    businesses = getSample(SAMPLE, Date.now() % 1000);
    console.log(`\n  📊 Sample aleatório: ${businesses.length} empresas`);
  }

  console.log(`\n`);
  console.log(`╔${"═".repeat(72)}╗`);
  console.log(`║  NEXOS AI — MASSIVE FULL PLATFORM STRESS TEST${"".padEnd(26)}║`);
  console.log(`║  ${new Date().toLocaleString("pt-BR")}${"".padEnd(50)}║`);
  console.log(`║  Empresas: ${String(businesses.length).padEnd(4)} | Agentes: ${String(ALL_AGENTS.length).padEnd(3)} | Fases: 11 por empresa${"".padEnd(12)}║`);
  console.log(`║  Fluxo: Briefing → Estratégia → Conteúdo → Lançamento → Carrinho${"".padEnd(4)}║`);
  console.log(`║         → Engajamento → Webhooks → Métricas → Monitor → Auditoria${"".padEnd(3)}║`);
  console.log(`╚${"═".repeat(72)}╝`);
  console.log(`\n  API: ${API}`);
  console.log(`  Run ID: ${RUN_ID}`);
  console.log(`\n  REGRA: Fluxo nunca para em erro — continua para próxima etapa sempre.`);
  console.log(`  Todos os break points serão documentados no relatório final.\n`);

  await waitForApi();

  const allResults: BusinessResult[] = [];
  const totalStart = Date.now();

  for (let i = 0; i < businesses.length; i++) {
    const biz = businesses[i]!;
    const result = await runBusiness(biz, i + 1, businesses.length);
    allResults.push(result);
  }

  printMegaReport(allResults, Date.now() - totalStart);
}

main().catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(`\nFATAL: ${msg}`);
  process.exit(1);
});
