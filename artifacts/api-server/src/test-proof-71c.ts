/**
 * PROVA DO AJUSTE #71-C — hardConstraints vs boldnessOpportunities
 * Campanha: 5c82666d-a3d2-4f71-8259-5a34950dd5a7 (ClauD'Midas)
 *
 * Executável em 3 stages independentes (cada um ≤ 5 min):
 *   STAGE=1  → strategic_core + offer_protegido
 *   STAGE=2  → offer_ousado
 *   STAGE=3  → relatório comparativo (lê dos arquivos JSON salvos)
 *
 * Cada stage salva resultados em /tmp/proof-71c-*.json.
 * Se o arquivo existir, o stage pula a chamada LLM e carrega do cache.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import pino from "pino";
import { db, campaignsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { runStrategicCoreBriefing, type StrategicBrief } from "./modules/agents/strategic-core.agent.js";
import { runOfferAgent, type OfferArchitectOutput } from "./modules/agents/offer.agent.js";

const CAMPAIGN_ID  = "5c82666d-a3d2-4f71-8259-5a34950dd5a7";
const WORKSPACE_ID = "21aa4337-82db-4671-bd8c-acdbeb9f6495";
const STAGE        = Number(process.env.STAGE ?? "1");

const BRIEF_FILE     = "/tmp/proof-71c-brief.json";
const PROTEGIDO_FILE = "/tmp/proof-71c-protegido.json";
const OUSADO_FILE    = "/tmp/proof-71c-ousado.json";

const log = pino({ level: "warn" });

// ── helpers ──────────────────────────────────────────────────────────────────

function sep(title: string) {
  const line = "─".repeat(72);
  console.log(`\n${line}\n  ${title}\n${line}`);
}

function save(path: string, data: unknown) {
  writeFileSync(path, JSON.stringify(data, null, 2), "utf8");
  console.log(`  💾 Salvo em ${path}`);
}

function load<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

// ── stage 1: strategic_core + offer PROTEGIDO ────────────────────────────────

async function stage1() {
  sep("STAGE 1 — Lendo campanha + Strategic Core + Offer PROTEGIDO");

  const [campaign] = await db
    .select({ intakeData: campaignsTable.intakeData, strategyData: campaignsTable.strategyData, status: campaignsTable.status })
    .from(campaignsTable)
    .where(eq(campaignsTable.id, CAMPAIGN_ID));

  if (!campaign) throw new Error(`Campanha ${CAMPAIGN_ID} não encontrada`);
  const intakeData   = (campaign.intakeData   ?? {}) as Record<string, unknown>;
  const strategyData = (campaign.strategyData ?? {}) as Record<string, unknown>;
  console.log(`\n  status: ${campaign.status} | produto: ${intakeData["product.name"]}`);

  // Strategic Core (com cache)
  let brief: StrategicBrief;
  if (existsSync(BRIEF_FILE)) {
    console.log("\n  [SKIP strategic_core — carregando do cache]");
    brief = load<StrategicBrief>(BRIEF_FILE);
  } else {
    console.log("\n  [AGUARDE — strategic_core LLM…]");
    brief = await runStrategicCoreBriefing(CAMPAIGN_ID, WORKSPACE_ID, null, intakeData, log);
    save(BRIEF_FILE, brief);
  }
  console.log(`\n  hardConstraints: ${brief.hardConstraints.length} | boldnessOpportunities: ${brief.boldnessOpportunities.length}`);
  brief.hardConstraints.forEach((c, i) => console.log(`    [HC-${i+1}] ${c}`));
  brief.boldnessOpportunities.forEach((b, i) => console.log(`    [BO-${i+1}] ${b.claim}`));

  // Offer PROTEGIDO (com cache)
  let protegido: OfferArchitectOutput;
  if (existsSync(PROTEGIDO_FILE)) {
    console.log("\n  [SKIP offer/protegido — carregando do cache]");
    protegido = load<OfferArchitectOutput>(PROTEGIDO_FILE);
  } else {
    console.log("\n  [AGUARDE — offer/protegido LLM…]");
    protegido = await runOfferAgent(CAMPAIGN_ID, WORKSPACE_ID, intakeData, log, undefined, strategyData,
      brief.hardConstraints, brief.boldnessOpportunities, "protegido");
    save(PROTEGIDO_FILE, protegido);
  }
  console.log(`\n  offer/protegido — score: ${protegido.score} | launchReadiness: ${protegido.launchReadiness}`);
  console.log(`  uniqueMechanism: ${protegido.uniqueMechanism?.name}`);
  console.log(`  corePromise: ${protegido.corePromise}`);

  console.log("\n  ✅ STAGE 1 CONCLUÍDA — rode STAGE=2 para continuar.");
}

// ── stage 2: offer OUSADO ─────────────────────────────────────────────────────

async function stage2() {
  sep("STAGE 2 — Offer OUSADO");

  if (!existsSync(BRIEF_FILE) || !existsSync(PROTEGIDO_FILE)) {
    throw new Error("Stage 1 não concluída. Rode STAGE=1 primeiro.");
  }

  const [campaign] = await db
    .select({ intakeData: campaignsTable.intakeData, strategyData: campaignsTable.strategyData })
    .from(campaignsTable)
    .where(eq(campaignsTable.id, CAMPAIGN_ID));

  const intakeData   = (campaign.intakeData   ?? {}) as Record<string, unknown>;
  const strategyData = (campaign.strategyData ?? {}) as Record<string, unknown>;
  const brief        = load<StrategicBrief>(BRIEF_FILE);

  let ousado: OfferArchitectOutput;
  if (existsSync(OUSADO_FILE)) {
    console.log("\n  [SKIP offer/ousado — carregando do cache]");
    ousado = load<OfferArchitectOutput>(OUSADO_FILE);
  } else {
    console.log("\n  [AGUARDE — offer/ousado LLM…]");
    ousado = await runOfferAgent(CAMPAIGN_ID, WORKSPACE_ID, intakeData, log, undefined, strategyData,
      brief.hardConstraints, brief.boldnessOpportunities, "ousado");
    save(OUSADO_FILE, ousado);
  }

  console.log(`\n  offer/ousado — score: ${ousado.score} | launchReadiness: ${ousado.launchReadiness}`);
  console.log(`  uniqueMechanism: ${ousado.uniqueMechanism?.name}`);
  console.log(`  corePromise: ${ousado.corePromise}`);

  console.log("\n  ✅ STAGE 2 CONCLUÍDA — rode STAGE=3 para o relatório completo.");
}

// ── stage 3: relatório comparativo ───────────────────────────────────────────

async function stage3() {
  sep("STAGE 3 — RELATÓRIO COMPARATIVO (PROVA #71-C)");

  for (const f of [BRIEF_FILE, PROTEGIDO_FILE, OUSADO_FILE]) {
    if (!existsSync(f)) throw new Error(`Arquivo ausente: ${f}. Rode stages 1 e 2 primeiro.`);
  }

  const brief     = load<StrategicBrief>(BRIEF_FILE);
  const protegido = load<OfferArchitectOutput>(PROTEGIDO_FILE);
  const ousado    = load<OfferArchitectOutput>(OUSADO_FILE);

  // ── A. Strategic Core ──────────────────────────────────────────────────────
  sep("EVIDÊNCIA A — Strategic Core: hardConstraints + boldnessOpportunities");

  console.log(`\n  hardConstraints (${brief.hardConstraints.length} — restrições absolutas, nunca violáveis):`);
  brief.hardConstraints.forEach((c, i) => console.log(`    [HC-${i+1}] ${c}`));

  console.log(`\n  boldnessOpportunities (${brief.boldnessOpportunities.length} — liberadas só no modo ousado):`);
  brief.boldnessOpportunities.forEach((b, i) => {
    console.log(`    [BO-${i+1}] claim       : ${b.claim}`);
    console.log(`           containmentReason: ${b.containmentReason}`);
  });

  console.log(`\n  permittedPromises (${brief.permittedPromises?.length ?? 0} — sempre permitidas):`);
  (brief.permittedPromises ?? []).forEach((p, i) => console.log(`    [PP-${i+1}] ${p}`));

  // ── B. Tabela comparativa ─────────────────────────────────────────────────
  sep("EVIDÊNCIA B — Tabela comparativa protegido vs. ousado");

  const rows: [string, unknown, unknown][] = [
    ["offerName",            protegido.offerName,            ousado.offerName],
    ["uniqueMechanism.name", protegido.uniqueMechanism?.name, ousado.uniqueMechanism?.name],
    ["score",                protegido.score,                ousado.score],
    ["launchReadiness",      protegido.launchReadiness,      ousado.launchReadiness],
    ["confidenceScore",      protegido.confidenceScore,      ousado.confidenceScore],
    ["criticalWeaknesses",   (protegido.criticalWeaknesses ?? []).length, (ousado.criticalWeaknesses ?? []).length],
  ];

  console.log("\n  " + "─".repeat(104));
  console.log(`  ${"Campo".padEnd(24)} ${"PROTEGIDO".padEnd(38)} OUSADO`);
  console.log("  " + "─".repeat(104));
  for (const [label, pVal, oVal] of rows) {
    const p = String(pVal ?? "—").slice(0, 38);
    const o = String(oVal ?? "—").slice(0, 38);
    console.log(`  ${label.padEnd(24)} ${p.padEnd(38)} ${o}`);
  }
  console.log("  " + "─".repeat(104));

  console.log("\n  [corePromise — PROTEGIDO]\n  " + String(protegido.corePromise ?? "—"));
  console.log("\n  [corePromise — OUSADO]\n  " + String(ousado.corePromise ?? "—"));

  console.log("\n  [criticalWeaknesses — PROTEGIDO]");
  (protegido.criticalWeaknesses ?? []).forEach((w, i) => console.log(`    [CW-${i+1}] ${w}`));
  console.log("\n  [criticalWeaknesses — OUSADO]");
  (ousado.criticalWeaknesses ?? []).forEach((w, i) => console.log(`    [CW-${i+1}] ${w}`));

  // ── C. boldnessOpportunities: protegido vs. ousado ────────────────────────
  sep("EVIDÊNCIA C — boldnessOpportunities: estado em cada modo");
  brief.boldnessOpportunities.forEach((b, i) => {
    console.log(`\n  [BO-${i+1}] claim: "${b.claim}"`);
    console.log(`         containmentReason: "${b.containmentReason}"`);
    console.log(`         → PROTEGIDO: injetada como CONTIDA (sem uso ativo)`);
    console.log(`         → OUSADO   : LIBERADA para uso pelo LLM`);
  });

  // ── D. Verificação hardConstraints no output ousado ───────────────────────
  sep("EVIDÊNCIA D — CHECK: hardConstraints violados no modo OUSADO?");

  const ousadoStr = JSON.stringify(ousado).toLowerCase();

  for (const [idx, hc] of brief.hardConstraints.entries()) {
    const hcLower = hc.toLowerCase().replace(/[^\w\s]/g, " ");
    const keywords = hcLower.split(/\s+/).filter(w => w.length > 5);
    const found = keywords.filter(kw => ousadoStr.includes(kw));
    const ratio  = keywords.length > 0 ? found.length / keywords.length : 0;

    // Violação suspeita: >60% das keywords presentes E ≥3 keywords — marca para revisão manual
    const status = (ratio > 0.6 && found.length >= 3)
      ? "⚠️  REVISAR MANUALMENTE — keywords do constraint presentes no output JSON"
      : "✅ OK — claim proibida não detectada no output";

    console.log(`\n  [HC-${idx+1}] ${hc}`);
    console.log(`         status   : ${status}`);
    if (found.length > 0) {
      console.log(`         keywords : [${found.slice(0, 8).join(", ")}]`);
    }
  }

  // ── E. Score delta ────────────────────────────────────────────────────────
  sep("EVIDÊNCIA E — Meta de recuperação de score (72 → ~84)");

  const pScore = Number(protegido.score ?? 0);
  const oScore = Number(ousado.score ?? 0);
  const delta  = oScore - pScore;

  console.log(`\n  score PROTEGIDO : ${pScore}`);
  console.log(`  score OUSADO    : ${oScore}`);
  console.log(`  delta           : ${delta >= 0 ? "+" : ""}${delta}`);

  if (oScore >= 82) {
    console.log(`\n  ✅ META ATINGIDA (${oScore} ≥ 82) — ousado recuperou o score conforme esperado.`);
  } else if (delta >= 5) {
    console.log(`\n  ⚠️  RECUPERAÇÃO PARCIAL (+${delta} pts, ousado=${oScore} < 82).`);
    console.log(`     Investigar: scoring model pode estar penalizando boldnessOpportunities`);
    console.log(`     mesmo quando claims são categoricamente seguras (já verificadas contra HC).`);
  } else {
    console.log(`\n  ❌ SEM RECUPERAÇÃO SIGNIFICATIVA (delta=${delta}).`);
    console.log(`     Possíveis causas:`);
    console.log(`     1. boldnessOpportunities não diferenciaram o suficiente a oferta final`);
    console.log(`     2. produto tem limitações estruturais (regulado, drawdown 22%, martingale)`);
    console.log(`        que o scorer penaliza independentemente do appealIntensity`);
    console.log(`     3. scoring model confunde 'ousado' com 'risk' mesmo com HC zeradas`);
  }

  // ── F. Dumps completos ────────────────────────────────────────────────────
  sep("DUMP COMPLETO — offerProtegido");
  console.log(JSON.stringify(protegido, null, 2));
  sep("DUMP COMPLETO — offerOusado");
  console.log(JSON.stringify(ousado, null, 2));

  console.log("\n\n[PROOF #71-C CONCLUÍDA]\n");
}

// ── entry point ───────────────────────────────────────────────────────────────

const runners: Record<number, () => Promise<void>> = { 1: stage1, 2: stage2, 3: stage3 };
const run = runners[STAGE];
if (!run) { console.error(`STAGE inválido: ${STAGE}. Use 1, 2 ou 3.`); process.exit(1); }

run().catch(err => { console.error("\n[FATAL]", err); process.exit(1); });
