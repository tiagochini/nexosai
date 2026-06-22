import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const _require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT = path.resolve(__dirname, "../../attached_assets");

const PDFDocument = _require("pdfkit") as any;

// ── Palette ──────────────────────────────────────────────────────────────
const BG     = "#0d0d12";
const CARD   = "#16161f";
const BORDER = "#252530";
const PRI    = "#6c5ce7";
const ACC    = "#00d4aa";
const WARN   = "#f39c12";
const DNGR   = "#e74c3c";
const TEXT   = "#e8e8f0";
const MUTED  = "#7c7c9a";
const WHITE  = "#ffffff";

// ── Helpers ───────────────────────────────────────────────────────────────
function newDoc(): any {
  return new PDFDocument({ size: "A4", margin: 0, autoFirstPage: false, info: { Author: "NexOS AI" } });
}

function collect(doc: any): Promise<Buffer> {
  return new Promise((res) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => res(Buffer.concat(chunks)));
    doc.end();
  });
}

function bg(doc: any) {
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(BG);
}

function heading(doc: any, label: string, title: string, y = doc.y) {
  doc.fontSize(7).fillColor(MUTED).text(label.toUpperCase(), 50, y, { characterSpacing: 2 });
  doc.y += 4;
  doc.fontSize(22).fillColor(WHITE).font("Helvetica-Bold").text(title, 50, doc.y, { width: 495 });
  doc.font("Helvetica").y += 10;
}

function rule(doc: any, color = BORDER) {
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(color).lineWidth(0.5).stroke();
  doc.y += 8;
}

function section(doc: any, num: string, title: string) {
  if (doc.y > 680) {
    doc.addPage();
    bg(doc);
  }
  doc.y += 24;
  rule(doc);
  doc.fontSize(7).fillColor(MUTED).text(`SECTION ${num}`, 50, doc.y, { characterSpacing: 2 });
  doc.y += 10;
  doc.fontSize(20).fillColor(WHITE).font("Helvetica-Bold").text(title, 50, doc.y, { width: 495 });
  doc.font("Helvetica").y += 14;
}

function h2(doc: any, title: string) {
  if (doc.y > 700) { doc.addPage(); bg(doc); }
  doc.y += 14;
  doc.fontSize(9).fillColor(PRI).font("Helvetica-Bold").text(title.toUpperCase(), 50, doc.y, { characterSpacing: 1 });
  doc.font("Helvetica").y += 6;
  rule(doc, BORDER);
}

function para(doc: any, text: string, color = TEXT) {
  if (doc.y > 720) { doc.addPage(); bg(doc); }
  doc.fontSize(9).fillColor(color).font("Helvetica").text(text, 50, doc.y, { width: 495, lineGap: 2 });
  doc.y += 6;
}

function callout(doc: any, text: string, borderColor = PRI) {
  if (doc.y > 700) { doc.addPage(); bg(doc); }
  const h = 50;
  doc.rect(50, doc.y, 495, h).fill(CARD);
  doc.moveTo(50, doc.y).lineTo(50, doc.y + h).strokeColor(borderColor).lineWidth(2).stroke();
  doc.fontSize(9).fillColor(TEXT).font("Helvetica-Oblique")
    .text(text, 60, doc.y + 8, { width: 477, lineGap: 2 });
  doc.font("Helvetica").y += h + 10;
}

interface KPI { val: string; label: string; color?: string }
function kpiRow(doc: any, items: KPI[]) {
  if (doc.y > 720) { doc.addPage(); bg(doc); }
  const w = 495 / items.length;
  const startY = doc.y;
  items.forEach((k, i) => {
    const x = 50 + i * w;
    doc.rect(x, startY, w - 1, 52).fill(CARD);
    doc.fontSize(16).fillColor(k.color ?? ACC).font("Helvetica-Bold")
      .text(k.val, x + 8, startY + 8, { width: w - 16 });
    doc.fontSize(7).fillColor(MUTED).font("Helvetica")
      .text(k.label, x + 8, startY + 30, { width: w - 16 });
  });
  doc.y = startY + 60;
}

interface Col { text: string; width: number; align?: "left" | "right" | "center" }
interface Row { cells: string[]; accent?: boolean; bold?: boolean; color?: string }
function table(doc: any, cols: Col[], rows: Row[]) {
  const startX = 50;
  let y = doc.y;

  // header
  let x = startX;
  const rowH = 20;
  doc.rect(startX, y, 495, rowH).fill(CARD);
  cols.forEach((c) => {
    doc.fontSize(7).fillColor(MUTED).font("Helvetica-Bold")
      .text(c.text.toUpperCase(), x + 4, y + 6, { width: c.width - 8, align: c.align ?? "left", characterSpacing: 0.8 });
    x += c.width;
  });
  y += rowH;

  rows.forEach((row, ri) => {
    if (y > 750) {
      doc.addPage();
      bg(doc);
      y = 50;
    }
    const rh = 18;
    const fill = ri % 2 === 0 ? BG : "#12121a";
    doc.rect(startX, y, 495, rh).fill(fill);
    doc.moveTo(startX, y).lineTo(startX + 495, y).strokeColor(BORDER).lineWidth(0.3).stroke();
    x = startX;
    row.cells.forEach((cell, ci) => {
      const col = cols[ci];
      const color = ci === 0 && row.bold ? WHITE :
        row.accent && ci > 0 ? ACC :
        row.color ? row.color : TEXT;
      doc.fontSize(8).fillColor(color)
        .font(row.bold && ci === 0 ? "Helvetica-Bold" : "Helvetica")
        .text(cell, x + 4, y + 5, { width: col.width - 8, align: col.align ?? "left" });
      x += col.width;
    });
    y += rh;
  });
  doc.moveTo(startX, y).lineTo(startX + 495, y).strokeColor(BORDER).lineWidth(0.3).stroke();
  doc.y = y + 10;
}

function footer(doc: any, text: string) {
  doc.fontSize(7).fillColor(MUTED).font("Helvetica")
    .text(text, 50, 820, { width: 495, align: "center" });
}

// ══════════════════════════════════════════════════════════════════════════
// ENGLISH INVESTOR PAPER
// ══════════════════════════════════════════════════════════════════════════
async function genEN(): Promise<Buffer> {
  const doc = newDoc();

  // COVER
  doc.addPage();
  bg(doc);
  doc.y = 50;
  doc.fontSize(7).fillColor(MUTED).text("STRICTLY PRIVATE & CONFIDENTIAL  ·  NXS / 2026", 50, 50, { characterSpacing: 2 });
  doc.fontSize(52).fillColor(WHITE).font("Helvetica-Bold").text("NexOS", 50, 100);
  const nexosW = doc.widthOfString("NexOS");
  doc.fillColor(PRI).text(".", 50 + nexosW, 100);
  doc.y = 165;
  doc.fontSize(11).fillColor(ACC).font("Helvetica").text("AI · GROWTH EXECUTION INFRASTRUCTURE", 50, doc.y, { characterSpacing: 3 });
  doc.y += 28;
  doc.fontSize(16).fillColor(WHITE).font("Helvetica-Bold").text("Investor & Early Adopter Prospect Paper v2.0", 50, doc.y, { width: 495 });
  doc.y += 36;
  doc.fontSize(9).fillColor(MUTED).font("Helvetica").text("Business Plan · White Paper · Investment Thesis · Economic Model & Strategic Valuation Framework", 50, doc.y, { width: 495 });
  doc.y += 30;
  kpiRow(doc, [
    { val: "R$ 15.99B", label: "Annualized Economic Potential — Year 1" },
    { val: "1,000,000", label: "Customers — 12-Month Growth Mission" },
    { val: "R$ 12B", label: "Credit ARR — 1M Active Customers", color: PRI },
    { val: "US$ 3T–6T", label: "Valuation — Global Expansion Scenario", color: WARN },
  ]);
  doc.y += 10;
  doc.fontSize(8).fillColor(MUTED).text("June 2026  ·  Document NXS-2026-002-EN  ·  v2.0  ·  64 AI Agents  ·  18+ Domain Modules  ·  nexos.ai", 50, doc.y);

  // LEGAL
  doc.addPage(); bg(doc); doc.y = 50;
  h2(doc, "Legal Notice — Confidentiality & Forward-Looking Statements");
  doc.rect(50, doc.y, 495, 110).fill(CARD);
  doc.y += 8;
  para(doc, "This document is provided on a strictly confidential basis for evaluation purposes by qualified investors and invited early adopters of NexOS AI. Reproduction or disclosure to unauthorized parties is prohibited without prior written consent.", MUTED);
  para(doc, "Revenue projections, valuation scenarios, and market estimates are prospective and illustrative. They do not constitute a guarantee of future results, investment recommendation, or offer to sell securities.", MUTED);
  para(doc, "This document v2.0 reflects the actual, operational state of the NexOS AI platform as of June 2026. The previous version (v1.0) contained projected items; this document explicitly distinguishes what is in production from what is on the roadmap.", MUTED);
  doc.y += 12;

  // EXECUTIVE SUMMARY
  section(doc, "00", "Executive Summary — An Infrastructure Thesis");
  para(doc, "NexOS AI transforms business intention into complete commercial execution — from idea to product, from campaign to sale, from lead to remarketing — replacing market fragmentation with an integrated, auditable, AI-automated operation.");
  doc.y += 6;
  kpiRow(doc, [
    { val: "64", label: "Specialized AI Agents in Production" },
    { val: "18+", label: "Domain Modules in Production", color: PRI },
    { val: "R$3,990", label: "Solo Ticket (Lifetime Access)", color: TEXT },
    { val: "R$9,990", label: "Agency Ticket (White-Label)", color: WARN },
  ]);
  callout(doc, '"If every company needs to sell, grow, appear, convert, or influence — then every company needs a growth infrastructure. NexOS AI is that infrastructure."');

  // MARKET
  section(doc, "01", "Market Context");
  table(doc,
    [{ text: "Market", width: 200 }, { text: "Current Size", width: 140, align: "right" }, { text: "Projection", width: 155, align: "right" }],
    [
      { cells: ["Digital Advertising", "US$ 567.9B (2025)", "US$ 1.69T (2033)"], accent: true },
      { cells: ["MarTech", "US$ 551.9B (2025)", "US$ 2.38T (2033)"], accent: true },
      { cells: ["Creator Economy", "—", "~US$ 480B (2027)"], accent: true },
      { cells: ["AI Agents (Enterprise)", "~US$ 5B (2024)", "US$ 47B (2030)"], accent: true },
      { cells: ["Intelligent Process Automation", "US$ 14.55B (2024)", "US$ 44.74B (2030)"], accent: true },
    ]
  );

  // PRODUCT
  section(doc, "02", "Product — 64 AI Agents in Production");
  para(doc, "NexOS operates with an AI General Director (NexOS Command Agent) that orchestrates 64 specialized agents organized in 7 categories. The user does not choose agents — the system summons each agent at the correct moment in the execution pipeline.");
  doc.y += 6;
  table(doc,
    [{ text: "Category", width: 90 }, { text: "Core Function", width: 270 }, { text: "Provider", width: 135 }],
    [
      { cells: ["Strategy", "Strategic reasoning, positioning, timeline, financial projections", "Claude Sonnet"], bold: true },
      { cells: ["Content", "Copywriting with 3-turn critique loop, creatives, scripts, pages", "GPT-4o / GPT-5"], bold: true },
      { cells: ["Audience", "Segmentation, lead qualification, AI WhatsApp auto-responses", "Claude Sonnet"], bold: true },
      { cells: ["Video", "Scripts, storyboard, clone studio, daily video, recording direction", "Gemini Flash"], bold: true },
      { cells: ["Analytics", "Metrics, ROAS, CPL, creative fatigue, engagement, optimization", "Gemini Flash"], bold: true },
      { cells: ["Automation", "Launch sequences, automated dispatch, social auto-publishing", "GPT-4o"], bold: true },
      { cells: ["Sales", "AI reply suggestion by funnel stage, kanban, conversation history", "Claude Sonnet"], bold: true },
    ]
  );

  // ECONOMIC MODEL
  doc.addPage(); bg(doc); doc.y = 50;
  section(doc, "03", "Economic Model — Updated v2.0");
  h2(doc, "Plans — One-Time Ticket, No Subscription");
  table(doc,
    [{ text: "Plan", width: 70 }, { text: "Launch Price", width: 90 }, { text: "Regular", width: 80 }, { text: "Campaigns", width: 80 }, { text: "Credits", width: 80 }, { text: "Features", width: 95 }],
    [
      { cells: ["Solo", "R$ 3,990", "R$ 5,000", "3", "900 cr", "6-digit · All agents"], bold: true, accent: true },
      { cells: ["Agency", "R$ 9,990", "R$ 14,000", "10", "2,000 cr", "All tracks · White-label"], bold: true, accent: true },
      { cells: ["Academy", "R$ 2,500", "R$ 3,900", "—", "—", "Bonus for NexOS AI buyers"], bold: true, accent: true },
    ]
  );
  h2(doc, "Credit Packs — Consumption Recurrence");
  table(doc,
    [{ text: "Pack", width: 70 }, { text: "Credits", width: 80 }, { text: "Price", width: 80 }, { text: "R$/Credit", width: 80 }, { text: "Typical Use", width: 185 }],
    [
      { cells: ["Boost", "500 cr", "R$ 85", "R$ 0.17", "1 light campaign or daily videos"], bold: true, accent: true },
      { cells: ["Starter", "1,500 cr", "R$ 239", "R$ 0.16", "~3 complete campaigns"], bold: true, accent: true },
      { cells: ["Pro", "3,500 cr", "R$ 529", "R$ 0.15", "~7–8 campaigns / month"], bold: true, accent: true },
      { cells: ["Elite", "7,000 cr", "R$ 979", "R$ 0.14", "Agency operation — high volume"], bold: true, accent: true },
    ]
  );
  callout(doc, "Total cost of a complete launch: ~230–400 credits (R$32–R$68) — versus R$5,000–R$30,000 for a traditional agency. 97%+ operational cost reduction.", ACC);

  // REVENUE & VALUATION
  section(doc, "04", "Revenue Projection — 1 Million Customers");
  kpiRow(doc, [
    { val: "R$3.99B", label: "Acquisition Revenue (1M × R$3,990)" },
    { val: "R$12B", label: "Credit ARR (1M × R$1,000/month × 12)" },
    { val: "R$15.99B+", label: "Combined Annual Economic Potential", color: WARN },
  ]);

  section(doc, "05", "Valuation Framework");
  table(doc,
    [{ text: "Scenario", width: 220 }, { text: "ARR Base", width: 130 }, { text: "Valuation", width: 145 }],
    [
      { cells: ["Traditional SaaS (6x)", "R$ 12B", "R$ 72B"], accent: true },
      { cells: ["AI-Native Platform (25x)", "R$ 12B", "R$ 300B"], accent: true },
      { cells: ["Growth Infrastructure (75x)", "R$ 12B", "R$ 900B"], accent: true },
      { cells: ["Infrastructure (100x)", "R$ 12B", "R$ 1.2T"], bold: true, accent: true },
      { cells: ["50M Global Customers (25x on US$120B ARR)", "US$ 120B", "US$ 3T"], bold: true, color: WARN },
      { cells: ["100M Global Customers (25x on US$240B ARR)", "US$ 240B", "US$ 6T"], bold: true, color: WARN },
    ]
  );

  // MOAT
  doc.addPage(); bg(doc); doc.y = 50;
  section(doc, "06", "Strategic Moat — 6 Defensive Pillars");
  const moats = [
    ["1 — Data Moat", "Each campaign generates proprietary data: winning creatives, audiences, objections, timing, CPL, CPA, ROAS. No competitor will have this Brazilian launch dataset."],
    ["2 — Execution Moat", "Tools generate assets. NexOS executes. Execution creates dependency. Campaign history, audiences, sequences, and data remain on the platform."],
    ["3 — Workflow Moat", "The more the customer uses NexOS, the more the system understands their brand, audience, offer, and history — impossible to replicate in a new tool."],
    ["4 — Proof Moat", "The documented self-launch becomes the central case. Self-Proof Engine in production. The platform sells itself with its own technology."],
    ["5 — Category Moat", "NexOS creates the category Growth Execution Infrastructure. Category creators tend to capture market leadership perception and revenue leadership."],
    ["6 — Compliance Moat ✦ NEW", "Native LGPD, Meta CAPI server-side, audit trail by design. Compliance is architectural — reducing regulatory risk for the customer and the platform."],
  ];
  moats.forEach(([title, desc]) => {
    doc.fontSize(9).fillColor(PRI).font("Helvetica-Bold").text(title, 50, doc.y);
    doc.font("Helvetica").y += 12;
    para(doc, desc);
    doc.y += 4;
  });

  // CONCLUSION
  section(doc, "07", "Investor Conclusion");
  callout(doc, "NexOS AI is an infrastructure thesis. Not a tool thesis. The question is not how much is a marketing tool worth. The right question is: how much is the infrastructure that makes business growth executable, auditable, scalable, and accessible to any person or company worth? The answer: it is worth the size of the economic layer it comes to control. And that layer is global.", ACC);
  kpiRow(doc, [
    { val: "64", label: "AI Agents in Production" },
    { val: "18+", label: "Active Domain Modules", color: PRI },
    { val: "R$12B", label: "Credit ARR — 1M Customers" },
    { val: "US$6T", label: "Valuation — 100M Global Customers", color: WARN },
  ]);

  footer(doc, "NXS-2026-002-EN · NexOS AI Prospect Paper v2.0 (English) · June 2026 · STRICTLY PRIVATE & CONFIDENTIAL · nexos.ai");
  return collect(doc);
}

// ══════════════════════════════════════════════════════════════════════════
// PT-BR INVESTOR PAPER
// ══════════════════════════════════════════════════════════════════════════
async function genPT(): Promise<Buffer> {
  const doc = newDoc();

  doc.addPage(); bg(doc); doc.y = 50;
  doc.fontSize(7).fillColor(MUTED).text("ESTRITAMENTE CONFIDENCIAL  ·  NXS / 2026", 50, 50, { characterSpacing: 2 });
  doc.fontSize(52).fillColor(WHITE).font("Helvetica-Bold").text("NexOS", 50, 100);
  const nw = doc.widthOfString("NexOS");
  doc.fillColor(PRI).text(".", 50 + nw, 100);
  doc.y = 165;
  doc.fontSize(11).fillColor(ACC).font("Helvetica").text("AI · INFRAESTRUTURA DE EXECUÇÃO DE CRESCIMENTO", 50, doc.y, { characterSpacing: 2 });
  doc.y += 28;
  doc.fontSize(16).fillColor(WHITE).font("Helvetica-Bold").text("Prospect Paper para Investidores e Early Adopters v2.0", 50, doc.y, { width: 495 });
  doc.y += 36;
  doc.fontSize(9).fillColor(MUTED).font("Helvetica").text("Plano de Negócios · White Paper · Tese de Investimento · Modelo Econômico e Framework de Valuation Estratégico", 50, doc.y, { width: 495 });
  doc.y += 30;
  kpiRow(doc, [
    { val: "R$ 15,99B", label: "Potencial Econômico Anualizado — Ano 1" },
    { val: "1.000.000", label: "Clientes — Missão de Crescimento 12 Meses" },
    { val: "R$ 12B", label: "ARR de Créditos — 1M Clientes Ativos", color: PRI },
    { val: "US$ 3T–6T", label: "Valuation — Cenário de Expansão Global", color: WARN },
  ]);
  doc.fontSize(8).fillColor(MUTED).text("Junho 2026  ·  Documento NXS-2026-002-PT  ·  v2.0  ·  64 Agentes de IA  ·  18+ Módulos  ·  nexos.ai", 50, doc.y);

  doc.addPage(); bg(doc); doc.y = 50;
  h2(doc, "Aviso Legal — Confidencialidade e Declarações Prospectivas");
  doc.rect(50, doc.y, 495, 100).fill(CARD);
  doc.y += 8;
  para(doc, "Este documento é fornecido em caráter estritamente confidencial para avaliação por investidores qualificados e early adopters convidados da NexOS AI. Reprodução ou divulgação a terceiros não autorizados é proibida sem consentimento prévio por escrito.", MUTED);
  para(doc, "Projeções de receita, cenários de valuation e estimativas de mercado são prospectivos e ilustrativos. Não constituem garantia de resultados futuros, recomendação de investimento ou oferta de venda de valores mobiliários.", MUTED);
  para(doc, "Este documento v2.0 reflete o estado real e operacional da plataforma NexOS AI em junho de 2026.", MUTED);
  doc.y += 12;

  section(doc, "00", "Sumário Executivo — Uma Tese de Infraestrutura");
  para(doc, "NexOS AI transforma intenção de negócio em execução comercial completa — da ideia ao produto, da campanha à venda, do lead ao remarketing — substituindo fragmentação de mercado por uma operação integrada, auditável e automatizada por IA.");
  doc.y += 6;
  kpiRow(doc, [
    { val: "64", label: "Agentes de IA Especializados em Produção" },
    { val: "18+", label: "Módulos de Domínio em Produção", color: PRI },
    { val: "R$3.990", label: "Ticket Solo (Acesso Vitalício)", color: TEXT },
    { val: "R$9.990", label: "Ticket Agency (White-Label)", color: WARN },
  ]);
  callout(doc, '"Se toda empresa precisa vender, crescer, aparecer, converter ou influenciar — então toda empresa precisa de uma infraestrutura de crescimento. NexOS AI é essa infraestrutura."');

  section(doc, "01", "Contexto de Mercado");
  table(doc,
    [{ text: "Mercado", width: 200 }, { text: "Tamanho Atual", width: 140, align: "right" }, { text: "Projeção", width: 155, align: "right" }],
    [
      { cells: ["Publicidade Digital", "US$ 567,9B (2025)", "US$ 1,69T (2033)"], accent: true },
      { cells: ["MarTech", "US$ 551,9B (2025)", "US$ 2,38T (2033)"], accent: true },
      { cells: ["Creator Economy", "—", "~US$ 480B (2027)"], accent: true },
      { cells: ["Agentes de IA (Enterprise)", "~US$ 5B (2024)", "US$ 47B (2030)"], accent: true },
      { cells: ["Automação Inteligente de Processos", "US$ 14,55B (2024)", "US$ 44,74B (2030)"], accent: true },
    ]
  );

  section(doc, "02", "Produto — 64 Agentes de IA em Produção");
  table(doc,
    [{ text: "Categoria", width: 90 }, { text: "Função Principal", width: 270 }, { text: "Provider", width: 135 }],
    [
      { cells: ["Estratégia", "Raciocínio estratégico, posicionamento, cronograma, projeções financeiras", "Claude Sonnet"], bold: true },
      { cells: ["Conteúdo", "Copywriting com loop de crítica 3 turnos, criativos, scripts, landing pages", "GPT-4o"], bold: true },
      { cells: ["Audiência", "Segmentação, qualificação de leads, auto-respostas por WhatsApp", "Claude Sonnet"], bold: true },
      { cells: ["Vídeo", "Scripts, storyboard, Clone Studio, Vídeo Diário, direção", "Gemini Flash"], bold: true },
      { cells: ["Analytics", "Métricas, ROAS, CPL, fadiga criativa, engajamento, otimização", "Gemini Flash"], bold: true },
      { cells: ["Automação", "Sequências de lançamento, disparo auto, publicação social", "GPT-4o"], bold: true },
      { cells: ["Vendas", "5 agentes por etapa do funil, kanban, sugestão IA de resposta", "Claude Sonnet"], bold: true },
    ]
  );

  doc.addPage(); bg(doc); doc.y = 50;
  section(doc, "03", "Modelo Econômico — v2.0 Atualizado");
  h2(doc, "Planos de Acesso — Ticket Único, Sem Mensalidade");
  table(doc,
    [{ text: "Plano", width: 70 }, { text: "Lançamento", width: 90 }, { text: "Regular", width: 80 }, { text: "Campanhas", width: 80 }, { text: "Créditos", width: 80 }, { text: "Recursos", width: 95 }],
    [
      { cells: ["Solo", "R$ 3.990", "R$ 5.000", "3", "900 cr", "Track 6 dígitos · Todos agentes"], bold: true, accent: true },
      { cells: ["Agency", "R$ 9.990", "R$ 14.000", "10", "2.000 cr", "Todos tracks · White-label"], bold: true, accent: true },
      { cells: ["Academy", "R$ 2.500", "R$ 3.900", "—", "—", "Bônus incluso nos planos"], bold: true, accent: true },
    ]
  );
  h2(doc, "Pacotes de Créditos Adicionais");
  table(doc,
    [{ text: "Pack", width: 70 }, { text: "Créditos", width: 80 }, { text: "Preço", width: 80 }, { text: "R$/crédito", width: 80 }, { text: "Uso Típico", width: 185 }],
    [
      { cells: ["Boost", "500 cr", "R$ 85", "R$ 0,17", "1 campanha leve ou vídeos diários"], bold: true, accent: true },
      { cells: ["Starter", "1.500 cr", "R$ 239", "R$ 0,16", "~3 campanhas completas"], bold: true, accent: true },
      { cells: ["Pro", "3.500 cr", "R$ 529", "R$ 0,15", "~7–8 campanhas / mês"], bold: true, accent: true },
      { cells: ["Elite", "7.000 cr", "R$ 979", "R$ 0,14", "Operação de agência — alto volume"], bold: true, accent: true },
    ]
  );
  callout(doc, "Custo total de um lançamento completo: ~230–400 créditos (R$32–R$68) — versus R$5.000–R$30.000 em uma agência tradicional. Redução de custo operacional de 97%+.", ACC);

  section(doc, "04", "Projeção de Receita — 1 Milhão de Clientes");
  kpiRow(doc, [
    { val: "R$3,99B", label: "Receita de Aquisição (1M × R$3.990)" },
    { val: "R$12B", label: "ARR de Créditos (1M × R$1.000/mês × 12)" },
    { val: "R$15,99B+", label: "Potencial Econômico Anualizado Combinado", color: WARN },
  ]);

  section(doc, "05", "Framework de Valuation");
  table(doc,
    [{ text: "Cenário", width: 220 }, { text: "Base ARR", width: 130 }, { text: "Valuation", width: 145 }],
    [
      { cells: ["SaaS Tradicional (6x)", "R$ 12B", "R$ 72B"], accent: true },
      { cells: ["Plataforma AI-Nativa (25x)", "R$ 12B", "R$ 300B"], accent: true },
      { cells: ["Infraestrutura de Crescimento (75x)", "R$ 12B", "R$ 900B"], accent: true },
      { cells: ["Infraestrutura Máxima (100x)", "R$ 12B", "R$ 1,2T"], bold: true, accent: true },
      { cells: ["50M Clientes Globais (25x sobre US$120B ARR)", "US$ 120B", "US$ 3T"], bold: true, color: WARN },
      { cells: ["100M Clientes Globais (25x sobre US$240B ARR)", "US$ 240B", "US$ 6T"], bold: true, color: WARN },
    ]
  );

  doc.addPage(); bg(doc); doc.y = 50;
  section(doc, "06", "Moat Estratégico — 6 Pilares Defensivos");
  const moats = [
    ["1 — Moat de Dados", "Cada campanha gera dados proprietários: criativos vencedores, audiências, objeções, timing, CPL, CPA, ROAS. Nenhum concorrente terá esse dataset de lançamentos brasileiros."],
    ["2 — Moat de Execução", "Ferramentas geram assets. NexOS executa. Execução cria dependência. Histórico de campanhas, audiências, sequências e dados ficam na plataforma."],
    ["3 — Moat de Workflow", "Quanto mais o cliente usa, mais o NexOS entende: produto, marca, audiência, campanhas, resultados, tom, oferta e histórico. Impossível replicar em outra ferramenta."],
    ["4 — Moat de Prova", "O auto-lançamento documentado vira o case central. Self-Proof Engine em produção. A plataforma que vende a si mesma com sua própria tecnologia é o argumento mais forte."],
    ["5 — Moat de Categoria", "NexOS cria a categoria Infraestrutura de Execução de Crescimento. Criadores de categoria capturam percepção de liderança e liderança de receita."],
    ["6 — Moat de Compliance ✦ NOVO", "LGPD nativa, CAPI server-side, audit trail by design. Compliance é arquitetural — reduzindo risco regulatório para o cliente e a plataforma."],
  ];
  moats.forEach(([title, desc]) => {
    doc.fontSize(9).fillColor(PRI).font("Helvetica-Bold").text(title, 50, doc.y);
    doc.font("Helvetica").y += 12;
    para(doc, desc);
    doc.y += 4;
  });

  section(doc, "07", "Conclusão para o Investidor");
  callout(doc, "NexOS AI é uma tese de infraestrutura. Não uma tese de ferramenta. A pergunta não é quanto vale uma ferramenta de marketing. A pergunta certa é: quanto vale a infraestrutura que torna o crescimento de negócios executável, auditável, escalável e acessível a qualquer pessoa ou empresa? A resposta: vale o tamanho da camada econômica que vier a controlar. E essa camada é global.", ACC);
  kpiRow(doc, [
    { val: "64", label: "Agentes de IA em Produção" },
    { val: "18+", label: "Módulos de Domínio Ativos", color: PRI },
    { val: "R$12B", label: "ARR de Créditos — 1M Clientes" },
    { val: "US$6T", label: "Valuation — 100M Clientes Globais", color: WARN },
  ]);

  footer(doc, "NXS-2026-002-PT · NexOS AI Prospect Paper v2.0 (Português) · Junho 2026 · ESTRITAMENTE CONFIDENCIAL · nexos.ai");
  return collect(doc);
}

// ══════════════════════════════════════════════════════════════════════════
// TECHNICAL HANDOFF DOCUMENT
// ══════════════════════════════════════════════════════════════════════════
async function genTech(): Promise<Buffer> {
  const doc = newDoc();

  // COVER
  doc.addPage(); bg(doc); doc.y = 50;
  doc.fontSize(7).fillColor(MUTED).text("NEXOS AI · INTERNAL TECHNICAL DOCUMENT · CONFIDENTIAL", 50, 50, { characterSpacing: 2 });
  doc.fontSize(40).fillColor(WHITE).font("Helvetica-Bold").text("NexOS", 50, 100);
  const nw2 = doc.widthOfString("NexOS");
  doc.fillColor(PRI).text(".", 50 + nw2, 100);
  doc.y = 155;
  doc.fontSize(16).fillColor(WHITE).font("Helvetica-Bold").text("Technical Handoff & Developer Onboarding", 50, doc.y, { width: 495 });
  doc.y += 30;
  doc.fontSize(10).fillColor(MUTED).font("Helvetica").text("Everything a developer needs to take over and finalize the platform", 50, doc.y);
  doc.y += 30;
  kpiRow(doc, [
    { val: "Node.js 24", label: "Runtime", color: ACC },
    { val: "TypeScript 5.9", label: "Language", color: ACC },
    { val: "PostgreSQL + Drizzle", label: "Database", color: PRI },
    { val: "React + Vite", label: "Frontend", color: PRI },
  ]);
  kpiRow(doc, [
    { val: "64", label: "AI Agents (7 Categories)", color: ACC },
    { val: "~55", label: "Database Tables", color: PRI },
    { val: "18+", label: "Domain Modules", color: WARN },
    { val: "BullMQ + Redis", label: "Queue System", color: TEXT },
  ]);
  doc.fontSize(8).fillColor(MUTED).text("June 2026  ·  NXS-TECH-001  ·  nexos.ai", 50, doc.y);

  // SECTION 00 — STATUS
  doc.addPage(); bg(doc); doc.y = 50;
  section(doc, "00", "Project Overview & Current State");
  para(doc, "NexOS AI is a full-stack AI-powered growth execution platform built as a pnpm monorepo. The platform is functionally complete at MVP level — backend API, frontend app, database schema, AI pipeline, and all core modules are built and typechecking cleanly.");
  callout(doc, "Main remaining work: production hardening, testing coverage expansion, and Q3 2026 roadmap features (HeyGen avatar, native domain hosting, Stripe).", WARN);
  doc.y += 6;
  table(doc,
    [{ text: "Area", width: 200 }, { text: "Status", width: 80 }, { text: "Notes", width: 215 }],
    [
      { cells: ["API Server (Express 5)", "✓ Done", "18+ domain modules, all routes, auth middleware, Zod v4"], accent: true },
      { cells: ["Frontend App (React + Vite)", "✓ Done", "30+ pages, sidebar nav, real-time Socket.io"], accent: true },
      { cells: ["Database Schema (PostgreSQL)", "✓ Done", "~55 tables, all migrations applied, seed scripts ready"], accent: true },
      { cells: ["AI Gateway (multi-provider)", "✓ Done", "Claude + GPT-4o + Gemini with automatic fallback cascade"], accent: true },
      { cells: ["Campaign Execution Pipeline", "✓ Done", "State machine, checkpoint/resume, BullMQ + setInterval fallback"], accent: true },
      { cells: ["64 AI Agents", "✓ Done", "All 7 categories, provider mapping, DOMINO framework injected"], accent: true },
      { cells: ["Clone Studio + Daily Video", "✓ Done", "Recording, face detection, session reconnect, 2 styles"], accent: true },
      { cells: ["AI Sales Team", "✓ Done", "5 agents, kanban, AI reply suggestion, conversation history"], accent: true },
      { cells: ["LGPD Compliance Module", "✓ Done", "Consent timestamping, audit trail, data subject rights"], accent: true },
      { cells: ["Meta CAPI + TikTok Events API", "✓ Done", "Server-side event firing, SHA-256 PII hashing"], accent: true },
      { cells: ["HeyGen Avatar Integration", "Roadmap Q3", "Planned Q3 2026"], color: WARN },
      { cells: ["Native Domain Hosting", "Roadmap Q3", "Planned Q3 2026"], color: WARN },
      { cells: ["E2E Test Suite", "Partial", "Playwright scripts exist; coverage needs expansion"], color: WARN },
    ]
  );

  // SECTION 01 — REPO STRUCTURE
  section(doc, "01", "Repository Structure");
  para(doc, "The project is a pnpm workspace monorepo. Libs (lib/*) are TypeScript composite packages that emit declarations. Artifacts (artifacts/*) are leaf packages — no declaration emit, no cross-artifact imports.");
  h2(doc, "Workspace Layout");
  const treeItems = [
    ["workspace/", PRI, true],
    ["├── artifacts/", PRI, false],
    ["│   ├── api-server/         Express 5 API (port 8080, proxied at /api)", ACC, false],
    ["│   │   ├── src/modules/    40+ domain modules", MUTED, false],
    ["│   │   ├── src/lib/        env, errors, logger, shared utils", MUTED, false],
    ["│   │   └── src/routes/     route barrel (mounts all module routers)", MUTED, false],
    ["│   ├── app/                React + Vite frontend (BASE_PATH=/)", ACC, false],
    ["│   ├── landing/            Marketing landing page", MUTED, false],
    ["│   └── nexos-academy/      Training portal (Professor Allan AI)", MUTED, false],
    ["├── lib/", PRI, false],
    ["│   └── db/                 PostgreSQL + Drizzle ORM (composite lib)", ACC, false],
    ["│       ├── src/schema/     ~55 table definitions (one file per domain)", MUTED, false],
    ["│       └── src/seed-plans.ts   seed Solo + Agency plans", MUTED, false],
    ["├── scripts/                Utility scripts (audit, sim, stress)", MUTED, false],
    ["└── replit.md               PROJECT SOURCE OF TRUTH — read this first", WARN, true],
  ];
  doc.rect(50, doc.y, 495, treeItems.length * 14 + 16).fill(CARD);
  doc.y += 8;
  treeItems.forEach(([line, color, bold]) => {
    doc.fontSize(7.5).fillColor(color as string).font(bold ? "Helvetica-Bold" : "Courier")
      .text(line as string, 58, doc.y, { width: 479 });
    doc.y += 14;
  });
  doc.y += 8;

  // SECTION 02 — ENV VARS
  doc.addPage(); bg(doc); doc.y = 50;
  section(doc, "02", "Environment Variables");
  h2(doc, "Required — Will Crash Without These");
  table(doc,
    [{ text: "Variable", width: 180 }, { text: "Description", width: 315 }],
    [
      { cells: ["DATABASE_URL", "PostgreSQL connection string — postgresql://user:pass@host:5432/nexos"], bold: true, color: DNGR },
      { cells: ["SESSION_SECRET", "Random 32+ char string — used as JWT secret fallback"], bold: true, color: DNGR },
    ]
  );
  h2(doc, "Strongly Recommended");
  table(doc,
    [{ text: "Variable", width: 200 }, { text: "Description", width: 295 }],
    [
      { cells: ["JWT_SECRET", "Dedicated JWT signing key (defaults to SESSION_SECRET)"], color: WARN },
      { cells: ["REDIS_URL", "Redis URL for BullMQ + Socket.io (gracefully degraded if absent)"], color: WARN },
      { cells: ["ANTHROPIC_API_KEY", "Claude — strategy, compliance, sales agents"], color: WARN },
      { cells: ["OPENAI_API_KEY", "GPT-4o/5 — copy, content, creative agents"], color: WARN },
      { cells: ["GEMINI_API_KEY", "Gemini — analytics, optimization, video agents"], color: WARN },
      { cells: ["RESEND_API_KEY", "Resend email dispatch — weekly reports"], color: WARN },
      { cells: ["ALLOWED_ORIGINS", "Comma-separated CORS origins for production"], color: WARN },
      { cells: ["PLATFORM_OPEN", '"true" to skip invite code gate on registration'], color: ACC },
      { cells: ["ADMIN_EMAILS (hardcoded)", "Update BOTH admin.routes.ts AND app/src/pages/auth.tsx"], color: DNGR },
    ]
  );

  // SECTION 03 — CRITICAL GOTCHAS
  section(doc, "03", "Critical Gotchas — Read Before Writing Any Code");
  callout(doc, "WARNING: These are issues that are NOT obvious from the code and have caused bugs in the past. Failure to follow these rules will cause production errors.", DNGR);
  table(doc,
    [{ text: "Topic", width: 120 }, { text: "Gotcha", width: 175 }, { text: "Correct Behavior", width: 200 }],
    [
      { cells: ["Zod v4", "z.record() requires two args", "z.record(z.string(), z.unknown())"], accent: true },
      { cells: ["BullMQ names", "Cannot contain ':'", "Use '-': 'campaign-execution' not 'campaign:execution'"], accent: true },
      { cells: ["deductCredits()", "3rd arg is log, NOT optional", "deductCredits(workspaceId, action, log, campaignId?)"], accent: true },
      { cells: ["runAgent campaignId", "Pass null (not undefined) for sequence-level agents", "Prevents FK violation in campaign_agents table"] },
      { cells: ["parseAgentJSON", "LLM responses often truncated mid-JSON at 4096 tokens", "Always use parseAgentJSON(), never JSON.parse() directly"], accent: true },
      { cells: ["State machine", "Check if already in target state", "Skip transition silently if already at target"] },
      { cells: ["agentTypeEnum sync", "DB enum + AgentRole type must stay in sync", "Add new roles to BOTH files or get 22P02 DB error"], bold: true, color: DNGR },
      { cells: ["GPT-5.x tokens", "max_tokens not supported on GPT-5.x", "callOpenAI() auto-detects gpt-5.x → max_completion_tokens"], accent: true },
      { cells: ["Integration gate", "Only at execute/launch phase", "NEVER block at content approval or status PATCH"], bold: true, color: DNGR },
      { cells: ["Invite codes", "Registration blocked by default", "Set PLATFORM_OPEN=true OR create inviteCodesTable row"] },
      { cells: ["typecheck order", "After DB schema changes: libs first", "pnpm run typecheck:libs FIRST, then typecheck"], accent: true },
      { cells: ["Video stream auth", "<video src> can't send auth headers", "Use GET /api/recordings/:id/video-stream?token="] },
      { cells: ["Redis ECONNREFUSED", "Appears in dev logs constantly", "Expected — BullMQ/ioredis internal retry. Not a bug."] },
    ]
  );

  // SECTION 04 — COMMIT LOG
  doc.addPage(); bg(doc); doc.y = 50;
  section(doc, "04", "Recent Commit History (Newest → Oldest)");
  const commits = [
    ["db82977", "Update investor document with current platform capabilities"],
    ["a314b91", "Add user identification and compliance features to settings (LGPD)"],
    ["249700f", "Add feature to generate daily video scripts with customizable options"],
    ["06f6b21", "Add persistent video style selection for creators and campaigns"],
    ["4241e08", "Add interactive clone studio and wow moment to onboarding flow"],
    ["1199be5", "Add new payment gateways and organize integration categories"],
    ["13e4494", "Add campaign creative gallery and improve social media integration flow"],
    ["fcedf5e", "Add an audit scanner before launching campaigns (Pre-Launch Checklist)"],
    ["5f325f0", "Improve campaign viewing and status management features"],
    ["9310f11", "Add identity tab for voice cloning and persona settings (Clone Studio)"],
    ["a03e139", "Make social media channel requirements dynamic and add content download"],
    ["713ca32", "Add a mandatory content approval gate before campaign launch"],
    ["4c7b983", "Add a copy button to content pieces and improve error handling"],
    ["718c228", "Update campaign setup to improve social media and landing page integrations"],
    ["9d5c6cd", "Add social media and landing page gates to the pre-launch checklist"],
    ["dfd3e2d", "Improve reliability of displayed metrics on the war room page"],
    ["dfe83f9", "Improve error handling for background operations and external service calls"],
    ["6444dca", "Add ability to regenerate plans without losing existing data"],
    ["9c5f2f1", "Make the plan generation process asynchronous and non-blocking"],
    ["8da61ed", "Add validation for generated content to ensure correct format"],
    ["8c57f78", "Add compliance review stage to content generation pipeline"],
    ["05568c1", "Fix multiple bugs in the strategy and content generation pipeline"],
    ["78b77fc", "Improve system stability and user experience with error handling"],
    ["8bdf3d6", "Improve strategy module display and automate VSL generation"],
    ["3817d5e", "Add guided tour and campaign overview to improve user onboarding"],
    ["2ff2af6", "Add ability to archive campaigns and view live metrics"],
  ];
  table(doc,
    [{ text: "Hash", width: 70 }, { text: "Commit Message", width: 425 }],
    commits.map(([hash, msg], i) => ({
      cells: [hash, msg],
      bold: i < 5,
      color: i < 5 ? ACC : undefined,
    }))
  );

  // SECTION 05 — OPEN TASKS
  section(doc, "05", "Open Tasks & Known Technical Debt");
  h2(doc, "High Priority — Must Complete for Launch");
  table(doc,
    [{ text: "Task", width: 220 }, { text: "Priority", width: 80 }, { text: "Notes", width: 195 }],
    [
      { cells: ["Production deployment configuration", "CRITICAL", "Set all prod env vars, ALLOWED_ORIGINS, APP_URL"], bold: true, color: DNGR },
      { cells: ["Database seeding in production", "CRITICAL", "Run seed-plans.ts before first user registration"], bold: true, color: DNGR },
      { cells: ["E2E test suite completion", "HIGH", "Playwright scripts exist; expand to cover full pipeline"], color: WARN },
      { cells: ["Rate limiting on AI endpoints", "HIGH", "Prevent credit drain from rapid-fire requests"], color: WARN },
      { cells: ["Email delivery (Resend)", "HIGH", "RESEND_API_KEY + RESEND_FROM_EMAIL ready; wire to reports"], color: WARN },
      { cells: ["WhatsApp webhook verification", "HIGH", "META_APP_SECRET needed for webhook signature verify"], color: WARN },
    ]
  );
  h2(doc, "Roadmap Q3 2026");
  table(doc,
    [{ text: "Task", width: 220 }, { text: "Notes", width: 275 }],
    [
      { cells: ["HeyGen avatar integration", "Digital presenter. HeyGen API + ElevenLabs voice"] },
      { cells: ["Native domain + hosting", "Acquire and point domain + hosting within NexOS"] },
      { cells: ["Stripe payment integration", "Module scaffolded; needs Stripe API key + webhook setup"] },
      { cells: ["SMS dispatch channel", "Add SMS as sequence dispatch alongside email + WhatsApp"] },
      { cells: ["Multi-language (EN + ES)", "PT-BR first; EN-US and ES-LA are modular additions"] },
    ]
  );

  // SECTION 06 — HANDOFF CHECKLIST
  doc.addPage(); bg(doc); doc.y = 50;
  section(doc, "06", "Onboarding Steps & Handoff Checklist");
  h2(doc, "Onboarding Steps — Do These in Order");
  const steps = [
    "Read replit.md in full — it is the authoritative project README",
    "Run pnpm install and verify no errors",
    "Set all required env vars (see Section 02)",
    "Run: pnpm --filter @workspace/db run push (apply DB schema)",
    "Run: npx tsx lib/db/src/seed-plans.ts (seed Solo + Agency plans)",
    "Start workflows (api-server + app) and verify /api/healthz responds",
    "Set PLATFORM_OPEN=true, register a test user, run through full campaign pipeline",
    "Read Section 03 (Critical Gotchas) before writing any new code",
    "Run: DRY_RUN_MODE=true pnpm --filter @workspace/scripts run nexos-audit-test",
  ];
  steps.forEach((step, i) => {
    doc.fontSize(9).fillColor(TEXT).font("Helvetica")
      .text(`${i + 1}.  ${step}`, 50, doc.y, { width: 495, lineGap: 1 });
    doc.y += 16;
  });

  h2(doc, "Credentials Needed from Founder");
  table(doc,
    [{ text: "Credential", width: 220 }, { text: "Purpose", width: 275 }],
    [
      { cells: ["DATABASE_URL (dev + production)", "PostgreSQL connection strings"] },
      { cells: ["SESSION_SECRET + JWT_SECRET", "JWT signing and session management"] },
      { cells: ["Anthropic + OpenAI + Gemini API keys", "AI agent execution — 64 agents depend on these"] },
      { cells: ["Resend API key + sender email", "Email dispatch for sequences and weekly reports"] },
      { cells: ["Meta App ID + App Secret", "WhatsApp webhook verification + Instagram auto-post"] },
      { cells: ["TikTok Client Key + Client Secret", "TikTok OAuth for social auto-publishing"] },
      { cells: ["Asaas API key", "Brazil payment gateway (billing module)"] },
      { cells: ["Redis connection URL (production)", "BullMQ jobs + Socket.io real-time events"] },
    ]
  );

  h2(doc, "Production Deployment Checklist");
  const checklist = [
    "☐ DATABASE_URL set to production PostgreSQL",
    "☐ SESSION_SECRET = random 64-char string (never reuse dev value)",
    "☐ REDIS_URL set (without Redis, no real-time events in production)",
    "☐ ANTHROPIC_API_KEY + OPENAI_API_KEY + GEMINI_API_KEY set",
    "☐ ALLOWED_ORIGINS = your production domain(s)",
    "☐ APP_URL = your production URL",
    "☐ Database schema pushed: pnpm --filter @workspace/db run push",
    "☐ Plans seeded: npx tsx lib/db/src/seed-plans.ts",
    "☐ Admin emails updated in admin.routes.ts AND app/src/pages/auth.tsx",
    "☐ Payment webhook URLs configured in Hotmart/Kiwify dashboards",
    "☐ Meta webhook URL configured: POST /api/whatsapp/webhook",
  ];
  checklist.forEach((item) => {
    doc.fontSize(9).fillColor(TEXT).font("Helvetica").text(item, 50, doc.y, { width: 495 });
    doc.y += 16;
  });

  footer(doc, "NXS-TECH-001 · NexOS AI Technical Handoff Document · June 2026 · INTERNAL · CONFIDENTIAL · nexos.ai");
  return collect(doc);
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════
async function main() {
  const jobs = [
    { fn: genPT,   out: "NexOS_AI_Prospect_Paper_PT_v2_2026.pdf" },
    { fn: genEN,   out: "NexOS_AI_Prospect_Paper_EN_v2_2026.pdf" },
    { fn: genTech, out: "NexOS_AI_Technical_Handoff.pdf" },
  ];

  for (const { fn, out } of jobs) {
    const buf = await fn();
    const outPath = path.join(OUT, out);
    fs.writeFileSync(outPath, buf);
    console.log(`✓ ${out}  (${Math.round(buf.length / 1024)} KB)`);
  }
  console.log("\nAll 3 PDFs generated!");
}

main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
