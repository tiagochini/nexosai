/**
 * PROOF SCRIPT — Fase 2: acknowledge compliance gate + aguardar strategic_core + offer
 * Continua de onde proof-prohibited-promises.ts parou.
 */

import { execSync } from "child_process";

const API = "http://localhost:80/api";
const CAMPAIGN_ID = "6d9c6315-ff75-406b-bc51-9bb2546a1c63";
const EMAIL = "proof-proof_1785844245085@nexos-test.ai";
const PASS = "ProofTest2026!";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ts = () => new Date().toLocaleTimeString("pt-BR", { hour12: false, fractionalSecondDigits: 3 });

function log(status: "PASS" | "FAIL" | "WARN" | "INFO" | "SKIP", label: string, detail = "") {
  const icon = { PASS: "✓", FAIL: "✗", WARN: "⚠", INFO: "·", SKIP: "↷" }[status];
  console.log(`  [${icon}] ${label.padEnd(60)} ${ts()}   ${detail}`);
}

function section(title: string) {
  console.log(`\n${"━".repeat(72)}\n  ${title}\n${"━".repeat(72)}`);
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

(async () => {
  // ───────────────────────────────────────────────────────────────────────────
  section("A — Reautenticar com user de teste");

  let r = await http("POST", "/auth/login", {
    body: { email: EMAIL, password: PASS },
  });
  const token = r.data?.accessToken ?? r.data?.token ?? "";
  log(token ? "PASS" : "FAIL", "Login", `token ${token ? "OK" : "FALHOU"} status=${r.status} err=${r.data?.error ?? "–"}`);
  if (!token) {
    // Tentar alternativa: verificar o endpoint de login
    console.log("  RESPOSTA COMPLETA:", JSON.stringify(r.data, null, 2));
    process.exit(1);
  }

  // Status atual
  r = await http("GET", `/campaigns/${CAMPAIGN_ID}`, { token });
  const currentStatus = r.data?.campaign?.status ?? r.data?.status ?? "–";
  log("INFO", "Status atual da campanha", currentStatus);

  // ───────────────────────────────────────────────────────────────────────────
  section("B — Acknowledge compliance gate (produto regulado)");

  r = await http("POST", `/campaigns/${CAMPAIGN_ID}/market-validation/acknowledge`, {
    token,
    body: {
      acknowledgment: "Confirmo que estou ciente das restrições legais da legislação eleitoral brasileira (Lei 9.504/97). A campanha respeitará todas as exigências legais.",
      founderStatement: "Declaro que a campanha eleitoral será conduzida dentro dos limites legais estabelecidos pelo TSE.",
    },
  });
  log(r.ok ? "PASS" : "WARN", "Acknowledge compliance gate", `HTTP ${r.status} data=${JSON.stringify(r.data).slice(0, 120)}`);

  // ───────────────────────────────────────────────────────────────────────────
  section("C — Re-disparar strategy pipeline");

  r = await http("POST", `/campaigns/${CAMPAIGN_ID}/execute/strategy`, { token, timeoutMs: 20_000 });
  log(r.ok ? "PASS" : "WARN", "execute/strategy re-disparado",
    `HTTP ${r.status} queued=${r.data?.queued ?? "–"}`);

  // Aguardar status sair de 'analyzing'
  let status = "analyzing";
  for (let i = 0; i < 6; i++) {
    await wait(3000);
    const c = await http("GET", `/campaigns/${CAMPAIGN_ID}`, { token });
    status = c.data?.campaign?.status ?? c.data?.status ?? "analyzing";
    if (status !== "analyzing") break;
  }
  log(status === "analyzing" ? "WARN" : "PASS",
    "Status pós re-trigger", `status=${status}`);

  // ───────────────────────────────────────────────────────────────────────────
  section("D — Aguardar pipeline completo (max 15 min)");
  console.log("  Polling a cada 30s...\n");

  const DEADLINE = Date.now() + 15 * 60 * 1000;
  let finalStatus = status;

  while (Date.now() < DEADLINE) {
    await wait(30_000);
    const c = await http("GET", `/campaigns/${CAMPAIGN_ID}`, { token });
    finalStatus = c.data?.campaign?.status ?? c.data?.status ?? finalStatus;
    console.log(`  [·] ${ts()}  status=${finalStatus}`);
    if (["strategy_ready", "failed", "cancelled"].includes(finalStatus)) break;
  }
  log(finalStatus === "strategy_ready" ? "PASS" : "FAIL",
    "Pipeline concluído", `status=${finalStatus}`);

  // ───────────────────────────────────────────────────────────────────────────
  section("E — EVIDÊNCIA 1: strategic_core sem TypeError + prohibitedPromises");

  const scRow = dbQuery(`
    SELECT
      agent_type,
      created_at::text,
      jsonb_array_length((output->>'content')::jsonb->'prohibitedPromises')   AS qty,
      (output->>'content')::jsonb->'prohibitedPromises'                        AS prohibited_promises
    FROM campaign_agents
    WHERE campaign_id = '${CAMPAIGN_ID}'
      AND agent_type = 'strategic_core'
    ORDER BY created_at DESC LIMIT 1;
  `);
  const scQty = parseInt(scRow.split("|")[2] ?? "0", 10);
  log(scQty > 0 ? "PASS" : "FAIL",
    `EVIDÊNCIA 1 — strategic_core ok, ${scQty} prohibitedPromises`, "");
  console.log("\n  RAW (strategic_core):");
  console.log("  " + scRow.split("\n").join("\n  "));

  // ───────────────────────────────────────────────────────────────────────────
  section("F — EVIDÊNCIA 2: offer gerado — mecanismo + score + readiness");

  const offerRow = dbQuery(`
    SELECT
      (output->>'content')::jsonb->'uniqueMechanism'->>'name'   AS mechanism_name,
      (output->>'content')::jsonb->>'offerName'                  AS offer_name,
      (output->>'content')::jsonb->>'overallScore'               AS score,
      (output->>'content')::jsonb->>'launchReadiness'            AS readiness,
      (output->>'content')::jsonb->>'verdict'                    AS verdict,
      created_at::text
    FROM campaign_agents
    WHERE campaign_id = '${CAMPAIGN_ID}'
      AND agent_type = 'offer'
    ORDER BY created_at DESC LIMIT 1;
  `);
  log(offerRow.includes("|") ? "PASS" : "FAIL", "EVIDÊNCIA 2 — offer gerado", "");
  console.log("\n  RAW (offer — mecanismo + score):");
  console.log("  " + offerRow.split("\n").join("\n  "));

  // ───────────────────────────────────────────────────────────────────────────
  section("G — EVIDÊNCIA 3: promises da oferta vs prohibitedPromises (check item a item)");

  const complianceCheck = dbQuery(`
    WITH offer AS (
      SELECT (output->>'content')::jsonb AS content
      FROM campaign_agents
      WHERE campaign_id = '${CAMPAIGN_ID}'
        AND agent_type = 'offer'
      ORDER BY created_at DESC LIMIT 1
    ),
    sc AS (
      SELECT (output->>'content')::jsonb AS content
      FROM campaign_agents
      WHERE campaign_id = '${CAMPAIGN_ID}'
        AND agent_type = 'strategic_core'
      ORDER BY created_at DESC LIMIT 1
    )
    SELECT
      offer.content->'promises'                      AS offer_promises,
      offer.content->'guarantees'                    AS offer_guarantees,
      offer.content->'autoAudit'                     AS auto_audit,
      sc.content->'prohibitedPromises'               AS prohibited_promises
    FROM offer, sc;
  `);
  console.log("\n  RAW (promises + autoAudit + prohibitedPromises):");
  console.log("  " + complianceCheck.split("\n").join("\n  "));

  // ───────────────────────────────────────────────────────────────────────────
  section("H — EVIDÊNCIA 4: compliance delta — self-critique risks vs score");

  const critiqueRow = dbQuery(`
    SELECT
      (output->>'content')::jsonb->>'risks'             AS risks,
      (output->>'content')::jsonb->>'critical'          AS critical,
      (output->>'content')::jsonb->>'overallConfidence' AS confidence
    FROM campaign_agents
    WHERE campaign_id = '${CAMPAIGN_ID}'
      AND agent_type = 'self_critique'
    ORDER BY created_at DESC LIMIT 1;
  `);
  console.log("\n  RAW (self_critique — risks/critical/confidence):");
  console.log("  " + critiqueRow.split("\n").join("\n  "));

  // Benchmark histórico (campanha financeira anterior — WITHOUT prohibitedPromises)
  const histBenchmark = dbQuery(`
    SELECT
      c.title,
      (sc.output->>'content')::jsonb->>'risks'             AS risks,
      (sc.output->>'content')::jsonb->>'critical'          AS critical,
      (sc.output->>'content')::jsonb->>'overallConfidence' AS confidence,
      (o.output->>'content')::jsonb->>'overallScore'       AS offer_score
    FROM campaign_agents sc
    JOIN campaign_agents o ON o.campaign_id = sc.campaign_id AND o.agent_type = 'offer'
    JOIN campaigns c ON c.id = sc.campaign_id
    WHERE sc.campaign_id = '5c82666d-a3d2-4f71-8259-5a34950dd5a7'
      AND sc.agent_type = 'self_critique'
    ORDER BY sc.created_at DESC LIMIT 1;
  `);
  console.log("\n  BENCHMARK HISTÓRICO (campanha financeira sem injeção):");
  console.log("  " + histBenchmark.split("\n").join("\n  "));

  // ───────────────────────────────────────────────────────────────────────────
  section("RESUMO FINAL");
  console.log(`  campaignId  : ${CAMPAIGN_ID}`);
  console.log(`  finalStatus : ${finalStatus}`);
  console.log(`  sc.qty      : ${scQty} prohibitedPromises`);
})().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
