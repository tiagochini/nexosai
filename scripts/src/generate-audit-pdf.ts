import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

const OUT_PATH = path.resolve("nexos-audit-report.pdf");
const doc = new PDFDocument({ size: "A4", margin: 50, info: { Title: "NEXOS AI — Auditoria Estrutural", Author: "NEXOS AI System" } });
doc.pipe(fs.createWriteStream(OUT_PATH));

const C = {
  bg: "#0a0e1a",
  accent: "#6c63ff",
  accentBlue: "#00d4ff",
  red: "#ff4444",
  orange: "#ff8c00",
  yellow: "#ffd700",
  green: "#00cc66",
  white: "#ffffff",
  gray: "#8892a4",
  lightGray: "#c8d0dc",
  cardBg: "#111827",
  border: "#1e2a3a",
};

function pageBackground() {
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(C.bg);
}

function hr(y?: number, color = C.border) {
  const yPos = y ?? doc.y;
  doc.moveTo(50, yPos).lineTo(doc.page.width - 50, yPos).strokeColor(color).lineWidth(0.5).stroke();
  doc.y = yPos + 8;
}

function sectionTitle(text: string) {
  doc.moveDown(0.6);
  doc.rect(50, doc.y, doc.page.width - 100, 24).fill(C.accent + "22");
  doc.fillColor(C.accent).fontSize(11).font("Helvetica-Bold")
    .text(text, 58, doc.y + 6, { lineBreak: false });
  doc.y += 30;
  doc.fillColor(C.white);
}

function subTitle(text: string) {
  doc.moveDown(0.3);
  doc.fillColor(C.accentBlue).fontSize(9).font("Helvetica-Bold").text(text);
  doc.fillColor(C.white);
}

function body(text: string, indent = 0) {
  doc.fillColor(C.lightGray).fontSize(8.5).font("Helvetica")
    .text(text, 50 + indent, doc.y, { width: doc.page.width - 100 - indent });
}

function badge(label: string, color: string, x: number, y: number) {
  const w = label.length * 5.5 + 10;
  doc.rect(x, y - 1, w, 13).fill(color + "33");
  doc.fillColor(color).fontSize(7).font("Helvetica-Bold").text(label, x + 5, y + 1, { lineBreak: false });
  return w + 4;
}

function tableRow(cols: string[], widths: number[], isHeader = false, severity?: string) {
  const startX = 50;
  const rowH = 16;
  const y = doc.y;

  let bg = isHeader ? C.accent + "33" : C.cardBg;
  if (severity === "🔴") bg = C.red + "15";
  if (severity === "🟠") bg = C.orange + "15";
  if (severity === "🟡") bg = C.yellow + "15";
  if (severity === "✅") bg = C.green + "15";
  if (severity === "⚠️") bg = C.orange + "15";
  if (severity === "❌") bg = C.red + "15";

  doc.rect(startX, y, widths.reduce((a, b) => a + b, 0), rowH).fill(bg);

  let x = startX;
  cols.forEach((col, i) => {
    const color = isHeader ? C.accent : C.lightGray;
    doc.fillColor(color).fontSize(7.5)
      .font(isHeader ? "Helvetica-Bold" : "Helvetica")
      .text(col, x + 4, y + 4, { width: widths[i] - 8, lineBreak: false, ellipsis: true });
    x += widths[i];
  });

  doc.moveTo(startX, y + rowH).lineTo(startX + widths.reduce((a, b) => a + b, 0), y + rowH)
    .strokeColor(C.border).lineWidth(0.3).stroke();

  doc.y = y + rowH;
}

function codeBlock(lines: string[]) {
  const startY = doc.y;
  const lineH = 11;
  const totalH = lines.length * lineH + 10;
  doc.rect(50, startY, doc.page.width - 100, totalH).fill("#0d1117");
  lines.forEach((line, i) => {
    doc.fillColor("#c9d1d9").fontSize(7.5).font("Courier")
      .text(line, 58, startY + 5 + i * lineH, { lineBreak: false });
  });
  doc.y = startY + totalH + 4;
}

function pill(label: string, color: string) {
  const w = label.length * 5 + 12;
  const y = doc.y;
  if (doc.x + w > doc.page.width - 50) {
    doc.x = 50;
    doc.y += 14;
  }
  doc.rect(doc.x, doc.y, w, 12).fill(color + "33");
  doc.fillColor(color).fontSize(6.5).font("Helvetica-Bold")
    .text(label, doc.x + 6, doc.y + 2, { lineBreak: false, continued: false });
  doc.x += w + 4;
  doc.y = y;
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 1 — COVER
// ─────────────────────────────────────────────────────────────────────────────
pageBackground();

// Gradient bar top
doc.rect(0, 0, doc.page.width, 6).fill(C.accent);

// Logo block
doc.rect(50, 60, 6, 60).fill(C.accent);
doc.fillColor(C.white).fontSize(32).font("Helvetica-Bold").text("NEXOS", 66, 68);
doc.fillColor(C.accentBlue).fontSize(32).font("Helvetica-Bold").text(" AI", 66 + 32 * 2.2, 68, { continued: false });
doc.fillColor(C.gray).fontSize(11).font("Helvetica").text("AUTOMATED LAUNCH PLATFORM", 66, 108);

// Title block
doc.moveDown(2);
doc.rect(50, doc.y, doc.page.width - 100, 2).fill(C.accent);
doc.moveDown(0.3);
doc.fillColor(C.white).fontSize(22).font("Helvetica-Bold").text("RELATÓRIO DE AUDITORIA ESTRUTURAL", 50, doc.y + 10);
doc.fillColor(C.gray).fontSize(10).font("Helvetica").text("Structural Stabilization Mode — DIAGNÓSTICO COMPLETO", 50, doc.y + 8);
doc.moveDown(0.4);
doc.rect(50, doc.y, doc.page.width - 100, 2).fill(C.accent);

// Meta info cards
doc.moveDown(1.5);
const metaY = doc.y;
const cardW = (doc.page.width - 120) / 3;

[
  { label: "DATA", value: "26 Mai 2026" },
  { label: "MODO", value: "Diagnóstico" },
  { label: "STATUS", value: "Aguardando Aprovação" },
].forEach((m, i) => {
  const cx = 50 + i * (cardW + 10);
  doc.rect(cx, metaY, cardW, 40).fill(C.cardBg);
  doc.rect(cx, metaY, cardW, 2).fill(C.accent);
  doc.fillColor(C.gray).fontSize(7).font("Helvetica-Bold").text(m.label, cx + 10, metaY + 8);
  doc.fillColor(C.white).fontSize(10).font("Helvetica-Bold").text(m.value, cx + 10, metaY + 20);
});

doc.y = metaY + 60;

// Summary numbers
const stats = [
  { n: "55", label: "Módulos Backend" },
  { n: "52", label: "Páginas Frontend" },
  { n: "38", label: "Tabelas DB" },
  { n: "70+", label: "Agent Roles" },
  { n: "18", label: "Agents Órfãos" },
  { n: "3", label: "Roles Sem Arquivo" },
];
const statW = (doc.page.width - 100) / 6;
const statY = doc.y;
stats.forEach((s, i) => {
  const sx = 50 + i * statW;
  doc.rect(sx, statY, statW - 4, 48).fill(C.cardBg);
  doc.fillColor(C.accent).fontSize(18).font("Helvetica-Bold").text(s.n, sx, statY + 8, { width: statW - 4, align: "center" });
  doc.fillColor(C.gray).fontSize(6.5).font("Helvetica").text(s.label, sx, statY + 32, { width: statW - 4, align: "center" });
});
doc.y = statY + 68;

// Index
sectionTitle("ÍNDICE DO RELATÓRIO");
const sections = [
  ["1", "Estrutura de Pastas", "p.2"],
  ["2", "Arquivos Duplicados / Redundantes", "p.2"],
  ["3", "Arquivos Mortos / Não Utilizados", "p.3"],
  ["4-5", "Workflows e Agentes Existentes", "p.3"],
  ["6-7", "Schemas e Prompts", "p.4"],
  ["8", "Integrações", "p.4"],
  ["9", "Riscos de Quebra Estrutural", "p.5"],
  ["10-13", "Acoplamento, UI vs Agente, Contratos, Aprovação Humana", "p.5"],
  ["14-15", "Loops e Perda de Contexto", "p.6"],
  ["16", "Plano de Estabilização por Fases", "p.6"],
];
sections.forEach(([num, title, page]) => {
  const iy = doc.y;
  doc.fillColor(C.accent).fontSize(8).font("Helvetica-Bold").text(num, 55, iy, { lineBreak: false });
  doc.fillColor(C.lightGray).fontSize(8).font("Helvetica").text(title, 80, iy, { lineBreak: false });
  doc.fillColor(C.gray).fontSize(8).text(page, doc.page.width - 80, iy, { lineBreak: false });
  doc.moveTo(80, iy + 10).lineTo(doc.page.width - 85, iy + 10).strokeColor(C.border).lineWidth(0.3).stroke();
  doc.y = iy + 14;
});

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 2
// ─────────────────────────────────────────────────────────────────────────────
doc.addPage();
pageBackground();
doc.rect(0, 0, doc.page.width, 6).fill(C.accent);

sectionTitle("1. ESTRUTURA ATUAL DE PASTAS");
codeBlock([
  "workspace/",
  "├── artifacts/",
  "│   ├── api-server/src/modules/   (55 módulos)",
  "│   ├── app/src/pages/            (52 páginas)",
  "│   ├── landing/                  (landing page pública)",
  "│   ├── nexos-academy/            (portal de treinamento)",
  "│   ├── video-editor/             (editor de vídeo)",
  "│   └── video-nexos/              (vídeo de marketing)",
  "├── lib/",
  "│   ├── db/src/schema/            (38 tabelas Drizzle)",
  "│   ├── api-spec/openapi.yaml     (1032 linhas — desatualizado)",
  "│   ├── api-client-react/         (gerado por Orval)",
  "│   └── api-zod/                  (gerado por Orval)",
  "└── scripts/src/                  (6 scripts de teste/seed)",
]);

sectionTitle("2. ARQUIVOS DUPLICADOS / REDUNDANTES");
subTitle("Módulos de Criativos — 3 módulos com responsabilidades sobrepostas:");
tableRow(["Módulo", "Responsabilidade", "Problema"], [160, 200, 155], true);
tableRow(["modules/creatives/", "DALL-E 3 + status machine", "Fluxo independente"], [160, 200, 155]);
tableRow(["modules/creative-intent/", "ConceptDraft + aprovação", "Tabela diferente, sem contrato com creatives"], [160, 200, 155]);
tableRow(["content/creative-auto-gen.service.ts", "Auto-cria conceitos do brief", "Ponte sem interface definida"], [160, 200, 155]);

doc.moveDown(0.5);
subTitle("Agentes de Estratégia — responsabilidade duplicada:");
tableRow(["Arquivo", "Imports em outros módulos", "Situação"], [200, 160, 155], true);
tableRow(["strategy.agent.ts", "21", "✅ Principal — amplamente usado"], [200, 160, 155], false, "✅");
tableRow(["strategic-core.agent.ts", "4", "⚠️ Uso parcial — função pouco clara"], [200, 160, 155], false, "⚠️");
tableRow(["strategic-doctrine.agent.ts", "2 (via campaign-memory)", "⚠️ Uso indireto apenas"], [200, 160, 155], false, "⚠️");

doc.moveDown(0.5);
subTitle("Agentes de Copy — sobreposição:");
tableRow(["Arquivo", "Imports", "Sobreposição"], [200, 80, 235], true);
tableRow(["copywriter.agent.ts", "1", "Copy geral de campanha"], [200, 80, 235]);
tableRow(["ad-copy.agent.ts", "1", "Copy específico de anúncio"], [200, 80, 235]);
tableRow(["hook-factory.agent.ts", "0", "Hooks — sem integração na pipeline"], [200, 80, 235]);
tableRow(["item-copy.agent.ts", "1", "Copy de item de sequência"], [200, 80, 235]);

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 3
// ─────────────────────────────────────────────────────────────────────────────
doc.addPage();
pageBackground();
doc.rect(0, 0, doc.page.width, 6).fill(C.accent);

sectionTitle("3. ARQUIVOS MORTOS / APARENTEMENTE NÃO UTILIZADOS");

subTitle("18 Agent Files com 0 importações em outros módulos:");
codeBlock([
  "ab-test-designer.agent.ts      ad-critic.agent.ts",
  "affiliate-campaign.agent.ts    content-calendar.agent.ts",
  "creative-concept.agent.ts      crisis-response.agent.ts",
  "email-architect.agent.ts       hook-factory.agent.ts",
  "launch-debriefing.agent.ts     market-intel.agent.ts",
  "objection-killer.agent.ts      organic-traffic.agent.ts",
  "pricing-psychologist.agent.ts  reengagement.agent.ts",
  "scarcity-engineer.agent.ts     testimonial-curator.agent.ts",
  "upsell-architect.agent.ts      video-hook.agent.ts",
]);
body("Estes agentes estão registrados no AGENT_PROVIDER_MAP e disponíveis para chat direto, mas sem integração\nna pipeline automatizada de campanhas.");

doc.moveDown(0.5);
subTitle("3 AgentRoles declarados no tipo sem arquivo .ts correspondente (RISCO CRÍTICO):");
tableRow(["AgentRole", "Arquivo .ts", "Impacto"], [160, 140, 215], true);
tableRow(["mental_frequency_coach", "❌ Não existe", "Chamada retorna erro não tratado em runtime"], [160, 140, 215], false, "🔴");
tableRow(["identity_architect", "❌ Não existe", "Chamada retorna erro não tratado em runtime"], [160, 140, 215], false, "🔴");
tableRow(["obstinacy_trainer", "❌ Não existe", "Chamada retorna erro não tratado em runtime"], [160, 140, 215], false, "🔴");

doc.moveDown(0.5);
subTitle("Tabelas DB sem módulo backend ativo:");
tableRow(["Tabela", "Referências fora do schema", "Status"], [160, 160, 195], true);
tableRow(["domains", "0", "Tabela órfã — sem módulo nem rota"], [160, 160, 195], false, "🔴");
tableRow(["pages", "0", "Tabela órfã — sem módulo nem rota"], [160, 160, 195], false, "🔴");
tableRow(["launch-pipelines", "1 (pipeline.service.ts interno)", "Uso mínimo — status experimental"], [160, 160, 195], false, "🟠");
tableRow(["vertical-memory", "2 (serviço interno)", "Sem rota exposta"], [160, 160, 195], false, "🟡");
tableRow(["invite-codes", "2 (sem rota pública)", "Feature incompleta"], [160, 160, 195], false, "🟡");
tableRow(["critique-logs", "2 (critique.runner interno)", "Sem rota de consulta"], [160, 160, 195], false, "🟡");

doc.moveDown(0.5);
subTitle("Página Frontend sem Backend:");
tableRow(["Página", "Rota", "Situação"], [180, 120, 215], true);
tableRow(["site-builder/index.tsx", "/site-builder", "Sem módulo de backend correspondente"], [180, 120, 215], false, "🟠");

sectionTitle("4. WORKFLOWS EXISTENTES");
tableRow(["Workflow", "Comando", "Status"], [180, 220, 115], true);
tableRow(["API Server", "pnpm --filter @workspace/api-server run dev", "✅ Running"], [180, 220, 115], false, "✅");
tableRow(["App Web", "pnpm --filter @workspace/app run dev", "✅ Running"], [180, 220, 115], false, "✅");
tableRow(["Landing", "pnpm --filter @workspace/landing run dev", "✅ Running"], [180, 220, 115], false, "✅");
tableRow(["Academy", "pnpm --filter @workspace/nexos-academy run dev", "✅ Running"], [180, 220, 115], false, "✅");
tableRow(["NEXOS Audit Test", "DRY_RUN_MODE=true ...nexos-audit-test", "❌ Failed"], [180, 220, 115], false, "❌");
tableRow(["NEXOS Launch Sim", "...nexos-launch-sim", "❌ Failed"], [180, 220, 115], false, "❌");
tableRow(["Platform Stress Test", "SAMPLE=3 ...stress-full", "⚠️ Finished (instável)"], [180, 220, 115], false, "⚠️");

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 4
// ─────────────────────────────────────────────────────────────────────────────
doc.addPage();
pageBackground();
doc.rect(0, 0, doc.page.width, 6).fill(C.accent);

sectionTitle("5. AGENTES EXISTENTES (70+ roles)");

subTitle("Núcleo — Ativos na pipeline automática:");
doc.x = 50; doc.y += 2;
["strategy", "command", "profile-builder", "agent.runner", "agent-brain", "critique.runner", "campaign-memory", "optimization"].forEach(a => {
  pill(a, C.green);
});
doc.y += 16; doc.x = 50;

subTitle("Conteúdo/Copy — Parcialmente integrados:");
doc.x = 50; doc.y += 2;
["copywriter", "creative-director", "media-brief", "landing-page", "social-media", "ad-copy", "vsl-script", "cpl-script", "item-copy", "stories-sequence"].forEach(a => {
  pill(a, C.accentBlue);
});
doc.y += 16; doc.x = 50;

subTitle("Vendas — Integrados via sales-team:");
doc.x = 50; doc.y += 2;
["sales_warmer", "sales_desire", "sales_closer", "sales_objection", "sales_consultant"].forEach(a => {
  pill(a, C.orange);
});
doc.y += 16; doc.x = 50;

subTitle("18 Agentes Especializados — Chat direto apenas (sem pipeline automática):");
doc.x = 50; doc.y += 2;
["ab-test-designer", "ad-critic", "affiliate-campaign", "content-calendar", "email-architect", "hook-factory", "launch-debriefing", "market-intel", "objection-killer", "organic-traffic", "pricing-psychologist", "reengagement", "scarcity-engineer", "testimonial-curator", "upsell-architect", "video-hook", "crisis-response", "creative-concept"].forEach(a => {
  pill(a, C.gray);
});
doc.y += 16; doc.x = 50;

subTitle("Mentalidade — Roles declarados sem arquivo (CRÍTICO):");
doc.x = 50; doc.y += 2;
["mental_frequency_coach", "identity_architect", "obstinacy_trainer"].forEach(a => {
  pill(a, C.red);
});
doc.y += 18; doc.x = 50;

sectionTitle("6. SCHEMAS EXISTENTES (38 tabelas)");
subTitle("Core:");
body("users, workspaces, plans, credits, campaigns, workspace-integrations, audit-logs");
subTitle("Agentes e Execução:");
body("campaign-agents, agent-execution-logs, approval-checkpoints, critique-logs, campaign-assets, vertical-memory, ai-provider-logs");
subTitle("Conteúdo e Criativos:");
body("content, creatives, campaign-groups, vsls, launch-recordings");
subTitle("Sequências e Despacho:");
body("launch-sequences, sequence-contacts, email-dispatches, whatsapp-dispatches");
subTitle("Receita e Vendas:");
body("sales-conversations, revenue-events, subscription-payments, product-sales, products, academy-purchases");
subTitle("Suporte e Infra:");
body("metrics, social-posts, social-comment-actions, launch-pipelines, client-profiles, workspace-memory");
subTitle("Órfãs (sem módulo ativo):");
body("domains, pages, waitlist, invite-codes, whitelabel-configs, agency-clients", 0);

sectionTitle("7. PROMPTS EXISTENTES");
body("Todos os prompts estão inline dentro dos arquivos .agent.ts — não há diretório dedicado.");
doc.moveDown(0.3);
tableRow(["Arquivo", "Problema"], [220, 295], true);
tableRow(["command.agent.ts (900+ linhas)", "Prompt + orquestração + side-effects misturados"], [220, 295], false, "🔴");
tableRow(["orchestration.worker.ts", "Lógica de fase + prompts inline"], [220, 295], false, "🟠");
tableRow(["agent.runner.ts", "Runner + formatação + retry + prompts no mesmo arquivo"], [220, 295], false, "🟠");
tableRow(["Todos os *.agent.ts", "Sem versionamento independente de prompts"], [220, 295], false, "🟡");

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 5
// ─────────────────────────────────────────────────────────────────────────────
doc.addPage();
pageBackground();
doc.rect(0, 0, doc.page.width, 6).fill(C.accent);

sectionTitle("8. INTEGRAÇÕES EXISTENTES");
subTitle("Por variável de ambiente (configuradas):");
tableRow(["Integração", "Env Var", "Status"], [140, 200, 175], true);
tableRow(["Anthropic (Claude)", "AI_INTEGRATIONS_ANTHROPIC_*", "✅ Provisionada via Replit"], [140, 200, 175], false, "✅");
tableRow(["OpenAI / DALL-E 3", "AI_INTEGRATIONS_OPENAI_*", "✅ Provisionada via Replit"], [140, 200, 175], false, "✅");
tableRow(["Gemini", "AI_INTEGRATIONS_GEMINI_*", "✅ Provisionada via Replit"], [140, 200, 175], false, "✅");
tableRow(["Resend Email", "RESEND_API_KEY", "✅ Configurado"], [140, 200, 175], false, "✅");
tableRow(["Meta CAPI", "META_APP_SECRET", "✅ Configurado"], [140, 200, 175], false, "✅");
tableRow(["TikTok", "TIKTOK_CLIENT_KEY/SECRET", "✅ Configurado"], [140, 200, 175], false, "✅");
tableRow(["Asaas", "ASAAS_API_KEY", "✅ Configurado"], [140, 200, 175], false, "✅");

doc.moveDown(0.4);
subTitle("Por workspace no DB (conectadas via UI) — sem backend completo:");
tableRow(["Integração", "Situação"], [180, 335], true);
tableRow(["Stripe", "Salva no DB — sem webhook de confirmação de pagamento implementado"], [180, 335], false, "🟠");
tableRow(["HubSpot", "Catalogada na UI — sem serviço de sincronização"], [180, 335], false, "🟠");
tableRow(["Kiwify", "Webhook mapeado — sem validação de assinatura"], [180, 335], false, "🟡");

sectionTitle("9. RISCOS DE QUEBRA ESTRUTURAL");
tableRow(["#", "Risco", "Severidade"], [25, 430, 60], true);
tableRow(["R1", "3 AgentRoles sem arquivo .ts — qualquer chamada retorna erro não tratado", "🔴 Alto"], [25, 430, 60], false, "🔴");
tableRow(["R2", "command.agent.ts tem 900+ linhas com 8 setImmediate — erros silenciosos", "🔴 Alto"], [25, 430, 60], false, "🔴");
tableRow(["R3", "social.worker.ts: 2 setInterval sem verificação de limpeza — timers duplicados", "🟠 Médio"], [25, 430, 60], false, "🟠");
tableRow(["R4", "OpenAPI spec não cobre 7 módulos novos — cliente Orval desatualizado", "🟠 Médio"], [25, 430, 60], false, "🟠");
tableRow(["R5", "247 res.json() vs 163 validações Zod — 35% dos endpoints sem schema", "🟠 Médio"], [25, 430, 60], false, "🟠");
tableRow(["R6", "Audit-test e launch-sim workflows em falha — testes de plataforma quebrados", "🟠 Médio"], [25, 430, 60], false, "🟠");
tableRow(["R7", "site-builder page sem backend — usuário vê UI que não funciona", "🟡 Baixo"], [25, 430, 60], false, "🟡");

sectionTitle("10. PONTOS DE ACOPLAMENTO EXCESSIVO");
tableRow(["Arquivo", "Problema de Acoplamento"], [180, 335], true);
tableRow(["command.agent.ts", "Orquestra, chama agentes, setImmediate, memória, DB — viola responsabilidade única"], [180, 335], false, "🔴");
tableRow(["content.routes.ts", "Aprovação dispara 3 side-effects: memória + autopost social + auto-criativos"], [180, 335], false, "🟠");
tableRow(["orchestration.worker.ts", "Chama campaign-brain, agents, scheduler, Socket.io e DB — orquestrador monolítico"], [180, 335], false, "🟠");
tableRow(["campaign-brain/ (10 sub-serviços)", "Chamado de 3 pontos distintos sem interface unificada"], [180, 335], false, "🟠");

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 6
// ─────────────────────────────────────────────────────────────────────────────
doc.addPage();
pageBackground();
doc.rect(0, 0, doc.page.width, 6).fill(C.accent);

sectionTitle("11. UI DEPENDENDO DIRETAMENTE DE LÓGICA DE AGENTE");
tableRow(["Arquivo Frontend", "Problema"], [200, 315], true);
tableRow(["campaigns/detail.tsx", "Interpreta campaign.status para botões — lógica de state machine duplicada no frontend"], [200, 315], false, "🟠");
tableRow(["campaigns/content.tsx", "Renderiza landing_page_structure JSON diretamente — acoplado ao shape do agente"], [200, 315], false, "🟠");
tableRow(["campaigns/creatives.tsx", "Renderiza conceptDescription, colorPalette do JSON — shape não contratado"], [200, 315], false, "🟠");
tableRow(["sequences/detail.tsx", "Interpreta aiGeneratedPlan.phases e milestones diretamente"], [200, 315], false, "🟡");

sectionTitle("12. PONTOS SEM CONTRATO JSON");
subTitle("Módulos sem schema de resposta validado (nem Zod nem OpenAPI):");
tableRow(["Módulo", "Problema"], [160, 355], true);
tableRow(["live-launcher", "Respostas livres — sem schema de entrada/saída"], [160, 355]);
tableRow(["pipeline", "Respostas livres"], [160, 355]);
tableRow(["creative-intent", "Shape de ConceptDraft não está no OpenAPI"], [160, 355]);
tableRow(["creatives", "Status machine não documentada no spec"], [160, 355]);
tableRow(["sales-team", "suggestSalesReply retorna shape livre"], [160, 355]);
tableRow(["server-events", "Endpoints públicos sem contrato de entrada validado"], [160, 355]);
tableRow(["social-moderation", "Respostas livres"], [160, 355]);

sectionTitle("13. PONTOS SEM APROVAÇÃO HUMANA OBRIGATÓRIA");
tableRow(["Fluxo", "Gate"], [280, 235], true);
tableRow(["Content approval → Social autopost", "❌ Fire-and-forget imediato, sem confirmação"], [280, 235], false, "❌");
tableRow(["Media brief approval → Auto-criativos", "⚠️ Cria conceitos mas não bloqueia antes do DALL-E"], [280, 235], false, "⚠️");
tableRow(["Sequence scheduler → Dispatch mensagens", "⚠️ Automático após activate — sem prévia final"], [280, 235], false, "⚠️");
tableRow(["Strategy output → Content generation", "✅ Requer POST /execute explícito"], [280, 235], false, "✅");
tableRow(["Creative concept → Preview DALL-E", "✅ Requer aprovação explícita"], [280, 235], false, "✅");
tableRow(["Creative preview → Final HD", "✅ Requer aprovação explícita"], [280, 235], false, "✅");

sectionTitle("14. PONTOS DE LOOP POTENCIAL");
tableRow(["Loop", "Risco"], [220, 295], true);
tableRow(["social.worker.ts — 2 setInterval", "Reinício sem clearInterval pode criar timers duplicados"], [220, 295], false, "🟠");
tableRow(["sequence-scheduler — BullMQ + setInterval fallback", "Redis volta online → execução dupla possível"], [220, 295], false, "🟠");
tableRow(["command.agent.ts — 8 setImmediate aninhados", "Múltiplos eventos paralelos se status não verificado antes de disparar"], [220, 295], false, "🟠");
tableRow(["Cadeia: campaign→sequence→webhook→converted", "Longa cadeia sem idempotência verificada end-to-end"], [220, 295], false, "🟡");

sectionTitle("15. PONTOS DE PERDA DE CONTEXTO");
tableRow(["Ponto", "Risco"], [220, 295], true);
tableRow(["memory-compression.agent.ts", "Existe mas sem trigger claro — memória cresce indefinidamente"], [220, 295], false, "🟠");
tableRow(["campaign-memory.service.ts", "command.agent decide quando ler — sem garantia de consulta pré-geração"], [220, 295], false, "🟠");
tableRow(["parseAgentJSON null silencioso", "JSON malformado retorna null sem alertar usuário ou pipeline"], [220, 295], false, "🟠");
tableRow(["Intake → agentes de conteúdo", "Briefing original não passado automaticamente para agentes de conteúdo"], [220, 295], false, "🟡");

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 7 — PLANO DE ESTABILIZAÇÃO
// ─────────────────────────────────────────────────────────────────────────────
doc.addPage();
pageBackground();
doc.rect(0, 0, doc.page.width, 6).fill(C.accent);

sectionTitle("16. PLANO DE ESTABILIZAÇÃO — POR FASES");

const phases = [
  {
    num: "FASE 0",
    title: "Parar Hemorragia",
    color: C.red,
    desc: "Sem alterar funcionalidade. Corrigir falhas críticas silenciosas.",
    items: [
      "Corrigir 3 AgentRoles sem arquivo — stub com erro gracioso ou remover do tipo",
      "Investigar e corrigir audit-test e launch-sim workflows quebrados",
      "Documentar os 18 agents órfãos — decidir: integrar ou mover para agents/experimental/",
    ],
  },
  {
    num: "FASE 1",
    title: "Contratos",
    color: C.orange,
    desc: "Sem mover código. Criar documentação de contratos e mapas.",
    items: [
      "Criar NEXOS_AGENT_CONTRACTS.md — shape de entrada/saída de cada agente ativo",
      "Criar NEXOS_WORKFLOW_MAP.md — fluxos automáticos com gates de aprovação",
      "Atualizar OpenAPI spec para cobrir os 7 módulos não documentados",
      "Re-rodar codegen (Orval) para sincronizar cliente React",
    ],
  },
  {
    num: "FASE 2",
    title: "Isolamento",
    color: C.yellow,
    desc: "Mudanças pequenas e cirúrgicas. Uma de cada vez, aprovação por aprovação.",
    items: [
      "Separar content.routes.ts — side-effects para handlers dedicados com gate explícito",
      "Extrair system prompts para agents/prompts/[role].prompt.ts",
      "Criar NEXOS_GUARDRAILS.md — regras de gate por tipo de ação",
    ],
  },
  {
    num: "FASE 3",
    title: "Consolidação Criativa",
    color: C.accentBlue,
    desc: "Definir contrato único entre os 3 módulos de criativos.",
    items: [
      "Definir contrato entre creative-intent → creatives → creative-auto-gen",
      "Decidir: manter 2 fluxos (intent vs auto-gen) ou unificar",
    ],
  },
  {
    num: "FASE 4",
    title: "Limpeza de Tabelas Órfãs",
    color: C.green,
    desc: "Somente após fases 0-3 aprovadas e estabilizadas.",
    items: [
      "Verificar domains e pages — se sem plano de uso, remover da schema",
      "Verificar launch-pipelines — documentar ou remover se experimental",
    ],
  },
];

phases.forEach((phase) => {
  const startY = doc.y;
  doc.rect(50, startY, 4, 80).fill(phase.color);
  doc.rect(54, startY, doc.page.width - 104, 80).fill(C.cardBg);

  doc.fillColor(phase.color).fontSize(8).font("Helvetica-Bold")
    .text(phase.num, 64, startY + 8);
  doc.fillColor(C.white).fontSize(10).font("Helvetica-Bold")
    .text(phase.title, 120, startY + 6);
  doc.fillColor(C.gray).fontSize(7.5).font("Helvetica")
    .text(phase.desc, 64, startY + 22, { width: doc.page.width - 120 });

  phase.items.forEach((item, i) => {
    doc.fillColor(C.accent).fontSize(7.5).text("→", 70, startY + 36 + i * 13, { lineBreak: false });
    doc.fillColor(C.lightGray).fontSize(7.5).text(item, 84, startY + 36 + i * 13, { width: doc.page.width - 140 });
  });

  doc.y = startY + 88;
});

doc.moveDown(0.5);

// Mantra
doc.rect(50, doc.y, doc.page.width - 100, 36).fill(C.accent + "22");
doc.rect(50, doc.y, doc.page.width - 100, 2).fill(C.accent);
doc.fillColor(C.accent).fontSize(9).font("Helvetica-Bold")
  .text("PROTOCOLO OBRIGATÓRIO PARA QUALQUER ALTERAÇÃO:", 60, doc.y + 8);
doc.fillColor(C.white).fontSize(9).font("Helvetica-Bold")
  .text("DIAGNOSTICAR → PLANEJAR → APROVAR → IMPLEMENTAR → TESTAR → DOCUMENTAR", 60, doc.y + 20);
doc.y += 44;

// Documents to create
doc.moveDown(0.3);
subTitle("Documentos a criar (aguardando aprovação):");
const docs = [
  "NEXOS_MASTER_ARCHITECTURE.md",
  "NEXOS_EXPERIENCE_CONTRACT.md",
  "NEXOS_AGENT_CONTRACTS.md",
  "NEXOS_WORKFLOW_MAP.md",
  "NEXOS_GUARDRAILS.md",
];
docs.forEach((d) => {
  const dy = doc.y;
  doc.rect(50, dy, 8, 8).fill(C.accent + "44");
  doc.fillColor(C.accentBlue).fontSize(8).font("Courier").text(d, 64, dy, { lineBreak: false });
  doc.y = dy + 12;
});

// Footer
doc.rect(0, doc.page.height - 30, doc.page.width, 30).fill(C.cardBg);
doc.rect(0, doc.page.height - 32, doc.page.width, 2).fill(C.accent);
doc.fillColor(C.gray).fontSize(7).font("Helvetica")
  .text("NEXOS AI — Relatório de Auditoria Estrutural — 26 Mai 2026 — CONFIDENCIAL", 50, doc.page.height - 20, { align: "center", width: doc.page.width - 100 });

doc.end();
console.log(`PDF gerado: ${OUT_PATH}`);
