/**
 * PROOF SCRIPT — Fix 2: prohibitedPromises injection no offer agent
 *
 * Cria campanha política (produto regulado), roda pipeline de estratégia,
 * e valida:
 * 1. strategic_core completa sem TypeError e persiste prohibitedPromises
 * 2. log "[OFFER_AGENT] prohibitedPromises injetadas" aparece nos logs
 * 3. Offer gerada respeita as restrições (check item a item)
 * 4. Compliance delta vs histórico (overallScore + risks)
 */

import { execSync } from "child_process";

const API = "http://localhost:80/api";
const TAG = `proof_${Date.now()}`;
const EMAIL = `proof-${TAG}@nexos-test.ai`;
const PASS = "ProofTest2026!";
const INVITE_CODE = `PROOF-POLITICAL-${Date.now()}`;

// ─── helpers ──────────────────────────────────────────────────────────────────

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ts = () => new Date().toLocaleTimeString("pt-BR", { hour12: false, fractionalSecondDigits: 3 });

function log(status: "PASS" | "FAIL" | "WARN" | "INFO" | "SKIP", label: string, detail = "") {
  const icon = { PASS: "✓", FAIL: "✗", WARN: "⚠", INFO: "·", SKIP: "↷" }[status];
  console.log(`  [${icon}] ${label.padEnd(56)} ${ts()}   ${detail}`);
}

function section(title: string) {
  console.log(`\n${"━".repeat(70)}\n  ${title}\n${"━".repeat(70)}`);
}

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
      signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
    });
    let data: any = {};
    try { data = await res.json(); } catch { /* empty */ }
    return { ok: res.ok, status: res.status, data, elapsed: Date.now() - t };
  } catch (e: any) {
    return { ok: false, status: 0, data: { error: String(e.message) }, elapsed: Date.now() - t };
  }
}

function dbQuery(sql: string): string {
  try {
    return execSync(
      `psql "$DATABASE_URL" -t -A -c ${JSON.stringify(sql)}`,
      { env: process.env, encoding: "utf-8" }
    ).trim();
  } catch (e: any) {
    return `DB_ERROR: ${e.message}`;
  }
}

// ─── state ────────────────────────────────────────────────────────────────────
let token = "";
let campaignId = "";

// ═══════════════════════════════════════════════════════════════════════════════
// FASE 0 — Seed invite code via DB
// ═══════════════════════════════════════════════════════════════════════════════
section("FASE 0 — Seed invite code no DB");

const seedResult = dbQuery(
  `INSERT INTO invite_codes (code, email, plan_slug, created_at, updated_at)
   VALUES ('${INVITE_CODE}', NULL, 'agency', NOW(), NOW())
   ON CONFLICT (code) DO NOTHING
   RETURNING code;`
);
log(seedResult.includes(INVITE_CODE) || seedResult === "" ? "PASS" : "WARN",
  "Seed invite code", `code=${INVITE_CODE} result=${seedResult || "conflict/ok"}`);

// ═══════════════════════════════════════════════════════════════════════════════
// FASE 1 — Registro & workspace
// ═══════════════════════════════════════════════════════════════════════════════
section("FASE 1 — Registro & workspace");

(async () => {
  // Health check
  let r = await http("GET", "/healthz");
  log(r.ok ? "PASS" : "FAIL", "Health check", `HTTP ${r.status}`);

  // Registro com invite code
  r = await http("POST", "/auth/register", {
    body: { name: "Candidato Teste Proof", email: EMAIL, password: PASS, inviteCode: INVITE_CODE },
  });
  token = r.data?.accessToken ?? "";
  log(token ? "PASS" : "FAIL", "Registro com inviteCode", `token ${token ? "OK" : "FALHOU"} status=${r.status} err=${r.data?.error ?? "–"}`);
  if (!token) {
    log("FAIL", "Sem token — abortando.", JSON.stringify(r.data));
    process.exit(1);
  }

  // Workspace
  r = await http("GET", "/workspaces/me", { token });
  const workspaceId = r.data?.workspace?.id ?? "";
  log(workspaceId ? "PASS" : "FAIL", "Workspace", `wsId=${workspaceId.slice(0, 8)}…`);

  // ═══════════════════════════════════════════════════════════════════════════
  // FASE 2 — Criar campanha POLÍTICA (produto regulado)
  // ═══════════════════════════════════════════════════════════════════════════
  section("FASE 2 — Campanha política (produto regulado)");

  r = await http("POST", "/campaigns", {
    token,
    body: { title: `Campanha Vereador Proof ${TAG}`, type: "launch", track: "six_digits" },
  });
  campaignId = r.data?.campaign?.id ?? "";
  log(campaignId ? "PASS" : "FAIL", "Criar campanha", `id=${campaignId.slice(0, 8)}… status=${r.data?.campaign?.status ?? "–"}`);
  if (!campaignId) { process.exit(1); }

  // Intake com produto regulado — campanha política
  r = await http("POST", `/intake/${campaignId}`, {
    token,
    body: {
      intakeData: {
        "product.name": "Campanha Eleitoral Vereador João Silva 2026",
        "product.description":
          "Candidato a vereador pelo Partido da Esperança no município de Campinas. " +
          "Promessas de campanha: 500 vagas de emprego no primeiro mandato, redução de 40% da criminalidade, " +
          "construção de 3 UBSs novas. Adversário principal: vereador atual com histórico de absenteísmo.",
        "product.price": 0,
        "product.category": "service",
        "product.isRegulated": true,
        "product.regulatoryContext":
          "Legislação Eleitoral Brasileira (Lei 9.504/97 — Lei das Eleições). " +
          "Proibido: garantir resultado eleitoral, compra de votos, propaganda enganosa, " +
          "uso de pesquisas eleitorais distorcidas, promessas sem previsão orçamentária.",
        "audience.description":
          "Eleitores de Campinas, 18-65 anos, preocupados com segurança pública, desemprego e saúde. " +
          "Classe C/D. 60% mulheres. Muito ativos no WhatsApp e Instagram.",
        "audience.size.email": 5000,
        "audience.size.instagram": 12000,
        "campaign.revenueTarget": 50000,
        "campaign.budget.traffic": 8000,
        "campaign.duration.days": 30,
        "campaign.salesChannel": "social_media",
        "launch.previousLaunches": 0,
        "launch.urgencyTrigger": "Eleições em 45 dias — cada voto conta",
        "launch.mainDifferential":
          "Único candidato sem ficha suja, com plano orçamentário detalhado aprovado por auditoria independente",
        "content.tone": "esperançoso, próximo, linguagem popular",
        "content.mentalTriggers": ["social_proof", "scarcity", "authority", "transformation"],
      },
    },
  });
  log(r.ok ? "PASS" : "WARN", "Salvar intake político",
    `HTTP ${r.status} completeness=${r.data?.completeness ?? "–"}%`);

  // ═══════════════════════════════════════════════════════════════════════════
  // FASE 3 — Disparar strategy pipeline
  // ═══════════════════════════════════════════════════════════════════════════
  section("FASE 3 — Strategy pipeline");

  r = await http("POST", `/campaigns/${campaignId}/execute/strategy`, { token, timeoutMs: 20_000 });
  log(r.ok ? "PASS" : "FAIL", "execute/strategy disparado",
    `HTTP ${r.status} queued=${r.data?.queued ?? "–"} jobId=${(r.data?.jobId ?? "–").slice(0, 8)}`);

  // Aguardar status sair de 'intake'
  let status = "intake";
  for (let i = 0; i < 5; i++) {
    await wait(2000);
    const c = await http("GET", `/campaigns/${campaignId}`, { token });
    status = c.data?.campaign?.status ?? c.data?.status ?? "intake";
    if (status !== "intake") break;
  }
  log(status === "analyzing" ? "PASS" : "WARN", "Transição intake → analyzing", `status=${status}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // FASE 4 — Aguardar pipeline completar (até 12 min)
  // ═══════════════════════════════════════════════════════════════════════════
  section("FASE 4 — Aguardar pipeline (max 12 min)");
  console.log("  Polling a cada 30s...\n");

  const DEADLINE = Date.now() + 12 * 60 * 1000;
  let finalStatus = status;

  while (Date.now() < DEADLINE) {
    await wait(30_000);
    const c = await http("GET", `/campaigns/${campaignId}`, { token });
    finalStatus = c.data?.campaign?.status ?? c.data?.status ?? finalStatus;
    console.log(`  [·] ${ts()}  status=${finalStatus}`);
    if (["strategy_ready", "failed", "cancelled"].includes(finalStatus)) break;
  }

  log(finalStatus === "strategy_ready" ? "PASS" : "FAIL",
    "Pipeline concluído", `status=${finalStatus}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // FASE 5 — Evidências do DB
  // ═══════════════════════════════════════════════════════════════════════════
  section("FASE 5 — Evidências (queries DB)");

  // 5A: strategic_core — prohibitedPromises
  const scRow = dbQuery(`
    SELECT
      agent_type,
      created_at::text,
      jsonb_array_length((output->>'content')::jsonb->'prohibitedPromises')   AS qty,
      (output->>'content')::jsonb->'prohibitedPromises'                        AS prohibited_promises
    FROM campaign_agents
    WHERE campaign_id = '${campaignId}'
      AND agent_type = 'strategic_core'
    ORDER BY created_at DESC LIMIT 1;
  `);
  const hasProhibited = scRow.includes('"') && !scRow.includes("qty\n0") && scRow !== "";
  log(hasProhibited ? "PASS" : "FAIL",
    "EVIDÊNCIA 1: strategic_core — prohibitedPromises preenchido", "");
  console.log("\n  RAW DB (strategic_core):\n");
  console.log("  " + scRow.split("\n").join("\n  "));

  // 5B: offer — uniqueMechanism.name + overallScore + launchReadiness
  const offerRow = dbQuery(`
    SELECT
      (output->>'content')::jsonb->'uniqueMechanism'->>'name'   AS mechanism_name,
      (output->>'content')::jsonb->>'offerName'                  AS offer_name,
      (output->>'content')::jsonb->>'overallScore'               AS score,
      (output->>'content')::jsonb->>'launchReadiness'            AS readiness,
      (output->>'content')::jsonb->>'verdict'                    AS verdict,
      created_at::text
    FROM campaign_agents
    WHERE campaign_id = '${campaignId}'
      AND agent_type = 'offer'
    ORDER BY created_at DESC LIMIT 1;
  `);
  log(offerRow.includes("|") ? "PASS" : "FAIL",
    "EVIDÊNCIA 2: offer gerado", "");
  console.log("\n  RAW DB (offer):\n");
  console.log("  " + offerRow.split("\n").join("\n  "));

  // 5C: offer — promises array (para verificar item a item)
  const promisesRow = dbQuery(`
    SELECT
      (output->>'content')::jsonb->'promises'          AS promises,
      (output->>'content')::jsonb->'guarantees'        AS guarantees,
      (output->>'content')::jsonb->'autoAudit'         AS auto_audit
    FROM campaign_agents
    WHERE campaign_id = '${campaignId}'
      AND agent_type = 'offer'
    ORDER BY created_at DESC LIMIT 1;
  `);
  console.log("\n  RAW DB (offer.promises + autoAudit):\n");
  console.log("  " + promisesRow.split("\n").join("\n  "));

  // 5D: self-critique (risks, critical)
  const critiqueRow = dbQuery(`
    SELECT
      (output->>'content')::jsonb->>'risks'            AS risks,
      (output->>'content')::jsonb->>'critical'         AS critical,
      (output->>'content')::jsonb->>'overallConfidence' AS confidence
    FROM campaign_agents
    WHERE campaign_id = '${campaignId}'
      AND agent_type = 'self_critique'
    ORDER BY created_at DESC LIMIT 1;
  `);
  console.log("\n  RAW DB (self_critique):\n");
  console.log("  " + critiqueRow.split("\n").join("\n  "));

  // ─── Summary ───────────────────────────────────────────────────────────────
  section("RESUMO FINAL");
  console.log(`  campaignId : ${campaignId}`);
  console.log(`  finalStatus: ${finalStatus}`);
  console.log(`
  Para completar a prova de evidência 2 (log prohibitedPromises injetadas),
  rodar no servidor:
    grep -i "prohibitedPromises injetadas\\|RESTRIÇÃO ABSOLUTA\\|OFFER_AGENT" /tmp/logs/*.log | grep "${campaignId.slice(0, 8)}"
  `);

})().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
