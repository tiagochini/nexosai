import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

const OUT_PATH = path.resolve("NexOS_AI_Investor_Prospect_v2.pdf");
const doc = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: false,
  info: { Title: "NexOS AI — Investor Prospect Paper v2.0", Author: "NexOS AI" } });
doc.pipe(fs.createWriteStream(OUT_PATH));

// ─── PALETTE ─────────────────────────────────────────────────────────────────
const C = {
  page:    "#ffffff",
  navy:    "#0d1f3c",
  navyMid: "#1e3a5f",
  navyLt:  "#2d5282",
  slate:   "#374151",
  slateLt: "#6b7280",
  rule:    "#d1d5db",
  tint:    "#f3f4f6",
  tintDk:  "#e5e7eb",
  gold:    "#92400e",
  goldBg:  "#fef3c7",
  white:   "#ffffff",
};

const PW   = 595.28;
const PH   = 841.89;
const ML   = 56;       // left margin
const MR   = 56;       // right margin
const CW   = PW - ML - MR;  // 483.28 usable width
const TOP  = 48;       // y after header
const BOT  = PH - 44;  // y before footer

// ─── PAGE STATE ──────────────────────────────────────────────────────────────
let pageNum  = 0;
let secLabel = "";

function addPage(label = "") {
  pageNum++;
  secLabel = label;
  doc.addPage({ size: "A4", margin: 0 });
  doc.rect(0, 0, PW, PH).fill(C.page);
  // header rule
  doc.moveTo(ML, 36).lineTo(PW - MR, 36).strokeColor(C.rule).lineWidth(0.4).stroke();
  doc.fillColor(C.slateLt).fontSize(6.5).font("Helvetica")
    .text("NEXOS AI  ·  GROWTH EXECUTION INFRASTRUCTURE", ML, 22, { lineBreak: false });
  if (label) {
    doc.fillColor(C.slateLt).fontSize(6.5).font("Helvetica")
      .text(label, PW - MR, 22, { lineBreak: false, align: "right", width: 220, x: PW - MR - 220 });
  }
  doc.y = TOP;
}

function footer() {
  const fy = PH - 30;
  doc.moveTo(ML, fy - 6).lineTo(PW - MR, fy - 6).strokeColor(C.rule).lineWidth(0.3).stroke();
  doc.fillColor(C.slateLt).fontSize(6.5).font("Helvetica")
    .text("NXS-2026-001  ·  Prospect Paper v2.0  ·  STRICTLY PRIVATE & CONFIDENTIAL", ML, fy);
  doc.fillColor(C.slateLt).fontSize(6.5).font("Helvetica")
    .text(`${pageNum}`, PW - MR - 10, fy, { lineBreak: false, align: "right", width: 10 });
}

// Auto-add page break + footer when near bottom
function space(needed: number, label?: string) {
  if (doc.y + needed > BOT - 10) {
    footer();
    addPage(label || secLabel);
  }
}

// ─── PRIMITIVES ──────────────────────────────────────────────────────────────

function rule() {
  doc.moveDown(0.3);
  doc.moveTo(ML, doc.y).lineTo(PW - MR, doc.y).strokeColor(C.rule).lineWidth(0.4).stroke();
  doc.y += 6;
}

function h2(num: string, text: string, label?: string) {
  space(40, label);
  doc.moveDown(0.6);
  const y = doc.y;
  doc.fillColor(C.navyLt).fontSize(7.5).font("Helvetica-Bold")
    .text(num, ML, y, { lineBreak: false });
  doc.fillColor(C.navy).fontSize(12).font("Helvetica-Bold")
    .text(text, ML + 24, y);
  doc.moveDown(0.15);
  doc.moveTo(ML, doc.y).lineTo(PW - MR, doc.y).strokeColor(C.navyLt).lineWidth(0.6).stroke();
  doc.y += 8;
}

function h3(text: string) {
  space(20);
  doc.moveDown(0.35);
  doc.fillColor(C.navyMid).fontSize(9).font("Helvetica-Bold").text(text, ML);
  doc.moveDown(0.1);
}

function body(text: string, indent = 0) {
  // estimate lines needed
  const charsPerLine = (CW - indent) / 4.8;
  const lines = Math.ceil(text.length / charsPerLine);
  const est = lines * 12 + 4;
  space(est);
  doc.fillColor(C.slate).fontSize(8.5).font("Helvetica")
    .text(text, ML + indent, doc.y, { width: CW - indent, lineGap: 1.8 });
}

function note(text: string) {
  space(16);
  doc.fillColor(C.slateLt).fontSize(7).font("Helvetica")
    .text(text, ML, doc.y, { width: CW, lineGap: 1.5 });
}

function highlight(text: string) {
  const charsPerLine = (CW - 28) / 4.8;
  const lines = Math.ceil(text.length / charsPerLine);
  const h = lines * 12 + 18;
  space(h + 10);
  doc.moveDown(0.35);
  const y = doc.y;
  doc.rect(ML, y, CW, h).fill(C.tint);
  doc.rect(ML, y, 3, h).fill(C.navyLt);
  doc.fillColor(C.navyMid).fontSize(8.5).font("Helvetica-BoldOblique")
    .text(text, ML + 12, y + 8, { width: CW - 20, lineGap: 2 });
  doc.y = y + h + 8;
}

function goldBlock(label: string, text: string) {
  const charsPerLine = (CW - 24) / 4.8;
  const lines = Math.ceil(text.length / charsPerLine);
  const h = lines * 12 + 24;
  space(h + 10);
  doc.moveDown(0.35);
  const y = doc.y;
  doc.rect(ML, y, CW, h).fill(C.goldBg);
  doc.rect(ML, y, 3, h).fill(C.gold);
  doc.fillColor(C.gold).fontSize(7).font("Helvetica-Bold").text(label, ML + 12, y + 6, { lineBreak: false });
  doc.fillColor(C.navy).fontSize(8.5).font("Helvetica-Bold")
    .text(text, ML + 12, y + 17, { width: CW - 20, lineGap: 2 });
  doc.y = y + h + 8;
}

// ─── TABLE ───────────────────────────────────────────────────────────────────

function tHead(cols: string[], widths: number[]) {
  space(20);
  const y   = doc.y;
  const tot = widths.reduce((a, b) => a + b, 0);
  doc.rect(ML, y, tot, 18).fill(C.tintDk);
  let x = ML;
  cols.forEach((c, i) => {
    doc.fillColor(C.navyMid).fontSize(7.5).font("Helvetica-Bold")
      .text(c, x + 5, y + 5, { width: widths[i] - 10, lineBreak: false, ellipsis: true });
    x += widths[i];
  });
  doc.moveTo(ML, y + 18).lineTo(ML + tot, y + 18).strokeColor(C.rule).lineWidth(0.3).stroke();
  doc.y = y + 18;
}

function tRow(cols: string[], widths: number[], shade = false, gold = false) {
  space(16);
  const y   = doc.y;
  const tot = widths.reduce((a, b) => a + b, 0);
  const bg  = gold ? C.goldBg : shade ? C.tint : C.white;
  doc.rect(ML, y, tot, 15).fill(bg);
  let x = ML;
  cols.forEach((c, i) => {
    doc.fillColor(gold ? C.gold : C.slate).fontSize(7.5).font("Helvetica")
      .text(c, x + 5, y + 4, { width: widths[i] - 10, lineBreak: false, ellipsis: true });
    x += widths[i];
  });
  doc.moveTo(ML, y + 15).lineTo(ML + tot, y + 15).strokeColor(C.rule).lineWidth(0.2).stroke();
  doc.y = y + 15;
}

// ─── KPI CARD ────────────────────────────────────────────────────────────────

function kpiStrip(items: { label: string; value: string; sub?: string }[]) {
  space(65);
  const cw = CW / items.length - 5;
  const y  = doc.y;
  items.forEach((item, i) => {
    const cx = ML + i * (cw + 5 * items.length / items.length + (items.length > 3 ? 1.5 : 3));
    doc.rect(cx, y, cw, 52).fill(C.tint);
    doc.rect(cx, y, cw, 2).fill(C.navyLt);
    doc.fillColor(C.slateLt).fontSize(6).font("Helvetica-Bold")
      .text(item.label, cx + 6, y + 8, { width: cw - 12, lineBreak: false });
    doc.fillColor(C.navy).fontSize(13).font("Helvetica-Bold")
      .text(item.value, cx + 6, y + 20, { width: cw - 12, lineBreak: false });
    if (item.sub) {
      doc.fillColor(C.slateLt).fontSize(6).font("Helvetica")
        .text(item.sub, cx + 6, y + 38, { width: cw - 12, lineBreak: false });
    }
  });
  doc.y = y + 60;
}

// ─── MOAT CARD (half-width) ──────────────────────────────────────────────────
// returns the height consumed
function moatCard(num: string, title: string, desc: string, x: number, y: number): number {
  const w = CW / 2 - 6;
  const lines = Math.ceil(desc.length / ((w - 20) / 4.8));
  const h = lines * 11 + 34;
  doc.rect(x, y, w, h).fill(C.tint);
  doc.rect(x, y, 2, h).fill(C.navyLt);
  doc.fillColor(C.slateLt).fontSize(7).font("Helvetica-Bold").text(num, x + 8, y + 7, { lineBreak: false });
  doc.fillColor(C.navyMid).fontSize(8.5).font("Helvetica-Bold").text(title, x + 8, y + 18, { lineBreak: false });
  doc.fillColor(C.slate).fontSize(7.5).font("Helvetica").text(desc, x + 8, y + 30, { width: w - 16, lineGap: 1.5 });
  return h;
}

// ══════════════════════════════════════════════════════════════════════════════
//  PAGE 1 — COVER
// ══════════════════════════════════════════════════════════════════════════════
pageNum++;
doc.addPage({ size: "A4", margin: 0 });

// Navy header band
doc.rect(0, 0, PW, 165).fill(C.navy);

// Tiny confidential tag
doc.fillColor("#ffffff40").fontSize(7).font("Helvetica-Bold")
  .text("STRICTLY PRIVATE & CONFIDENTIAL", ML, 16, { lineBreak: false });
doc.fillColor("#ffffff30").fontSize(7).font("Helvetica")
  .text("NXS / 2026", PW - MR - 45, 16, { lineBreak: false });

// Wordmark
doc.fillColor(C.white).fontSize(42).font("Helvetica-Bold").text("NEXOS AI", ML, 38);
doc.fillColor("#94a3b8").fontSize(9).font("Helvetica-Bold")
  .text("GROWTH EXECUTION INFRASTRUCTURE", ML, 88);
doc.moveTo(ML, 106).lineTo(PW - MR, 106).strokeColor("#ffffff25").lineWidth(0.5).stroke();
doc.fillColor(C.white).fontSize(13).font("Helvetica-Bold")
  .text("Investor & Early Adopter Prospect Paper", ML, 114);
doc.fillColor("#94a3b8").fontSize(7.5).font("Helvetica")
  .text("Business plan  ·  White paper  ·  Investment thesis  ·  Economic model & strategic valuation framework", ML, 132);

// Light tint band — meta cards
doc.rect(0, 165, PW, 110).fill(C.tint);

const mW = CW / 3 - 8;
[
  { l: "DOCUMENTO", v: "NXS-2026-001", s: "Junho de 2026" },
  { l: "VERSÃO", v: "v 2.0", s: "Ecossistema + Masterprint" },
  { l: "CLASSIFICAÇÃO", v: "Confidencial", s: "Investidores convidados" },
].forEach((m, i) => {
  const cx = ML + i * (mW + 12);
  const cy = 175;
  doc.rect(cx, cy, mW, 52).fill(C.white);
  doc.rect(cx, cy, mW, 2).fill(C.navyLt);
  doc.fillColor(C.slateLt).fontSize(6.5).font("Helvetica-Bold").text(m.l, cx + 8, cy + 8);
  doc.fillColor(C.navy).fontSize(12).font("Helvetica-Bold").text(m.v, cx + 8, cy + 20);
  doc.fillColor(C.slateLt).fontSize(6).font("Helvetica").text(m.s, cx + 8, cy + 38);
});

doc.y = 285;

// KPI strip
const kW = CW / 4 - 3;
[
  { label: "AGENTES DE IA", value: "64", sub: "7 departamentos" },
  { label: "PRODUTOS NO ECOSSISTEMA", value: "5", sub: "Funil completo" },
  { label: "TRILHAS DE RECEITA", value: "3", sub: "6 · 8 · 10 dígitos" },
  { label: "MISSÃO ANO 1", value: "1.000.000", sub: "Clientes ativos" },
].forEach((s, i) => {
  const cx = ML + i * (kW + 5);
  doc.rect(cx, doc.y, kW, 50).fill(C.tint);
  doc.rect(cx, doc.y, kW, 2).fill(C.navyLt);
  doc.fillColor(C.slateLt).fontSize(5.5).font("Helvetica-Bold").text(s.label, cx + 6, doc.y + 8, { width: kW - 12, lineBreak: false });
  doc.fillColor(C.navy).fontSize(14).font("Helvetica-Bold").text(s.value, cx + 6, doc.y + 20, { width: kW - 12, lineBreak: false });
  doc.fillColor(C.slateLt).fontSize(6).font("Helvetica").text(s.sub, cx + 6, doc.y + 38, { width: kW - 12, lineBreak: false });
});
doc.y += 62;

// TOC
doc.fillColor(C.slateLt).fontSize(7).font("Helvetica-Bold").text("ÍNDICE", ML, doc.y);
doc.moveDown(0.3);

[
  ["—",  "Sumário Executivo",                                         "2"],
  ["01", "Executive Investment Thesis",                                "3"],
  ["02", "Market Context",                                             "3"],
  ["03", "The Structural Market Problem",                              "4"],
  ["04", "Product Definition & Ecosystem",                             "4"],
  ["05", "Core Product Capabilities (64 agentes)",                     "5"],
  ["05.10", "Masterprint Anti-Piracy System",                          "6"],
  ["06", "Economic Model v2.0",                                        "7"],
  ["07", "Year 1 Growth Mission",                                      "8"],
  ["08", "Revenue Projection — 1M Customers",                          "9"],
  ["09", "Valuation Framework",                                       "10"],
  ["10", "Path to Trillion-Dollar Valuation",                         "11"],
  ["11", "Why NexOS Commands Infrastructure Multiples",               "11"],
  ["12", "Strategic Moat (+ 12.6 Masterprint Security)",              "12"],
  ["13", "Investor Conclusion",                                       "13"],
].forEach(([num, title, pg]) => {
  const ty = doc.y;
  doc.fillColor(C.navyLt).fontSize(7).font("Helvetica-Bold").text(num, ML, ty, { lineBreak: false });
  doc.fillColor(C.slate).fontSize(7).font("Helvetica").text(title, ML + 26, ty, { lineBreak: false });
  doc.fillColor(C.slateLt).fontSize(7).text(pg, PW - MR - 14, ty, { lineBreak: false, align: "right", width: 14 });
  doc.moveTo(ML + 26, ty + 10).lineTo(PW - MR - 18, ty + 10).strokeColor(C.rule).lineWidth(0.2).stroke();
  doc.y = ty + 12.5;
});

footer();

// ══════════════════════════════════════════════════════════════════════════════
//  PAGE 2 — AVISO LEGAL + SUMÁRIO EXECUTIVO
// ══════════════════════════════════════════════════════════════════════════════
addPage("AVISO LEGAL  ·  SUMÁRIO EXECUTIVO");

h2("—", "Aviso Legal");
h3("Confidencialidade & Declarações Prospectivas");
body("Este documento é fornecido em caráter estritamente confidencial, exclusivamente para fins de avaliação por investidores qualificados e early adopters convidados da NexOS AI. Sua reprodução, distribuição ou divulgação, total ou parcial, a terceiros não autorizados é vedada sem consentimento prévio por escrito.");
doc.moveDown(0.4);
body("As projeções de receita, cenários de valuation, premissas de crescimento e estimativas de mercado têm natureza prospectiva e ilustrativa. Elas refletem premissas internas e não constituem garantia de resultados futuros, recomendação de investimento ou oferta de venda de valores mobiliários. Resultados reais podem diferir materialmente em função de dinâmica competitiva, capacidade de execução, regulação e condições macroeconômicas.");
doc.moveDown(0.4);
body("Ao prosseguir com a leitura, o destinatário concorda em tratar o conteúdo como informação confidencial nos termos de eventual NDA firmado com a NexOS AI.");

h2("—", "Sumário Executivo");
h3("Uma tese de infraestrutura, não de ferramenta");
body("NexOS AI transforma intenção empresarial em execução comercial completa — da ideia ao produto, da campanha à venda, do lead ao remarketing — substituindo a fragmentação do mercado de growth por uma operação integrada, auditável e automatizada por IA.");
doc.moveDown(0.4);
body("O mercado endereçável combina publicidade digital, MarTech, creator economy e automação de processos — juntos, mercados multibilionários em expansão acelerada. A tese central: se toda empresa precisa vender, crescer, aparecer, converter ou influenciar, então toda empresa precisa de uma infraestrutura de crescimento. NexOS AI é essa infraestrutura.");

doc.moveDown(0.5);
kpiStrip([
  { label: "POTENCIAL ECONÔMICO ANUALIZADO — ANO 1", value: "R$ 18,48B+", sub: "Aquisição + taxas + run-rate créditos" },
  { label: "ARR ANUALIZADO DE CRÉDITOS (1M CLIENTES)", value: "R$ 12B", sub: "Consumo médio R$1.000/mês" },
  { label: "FAIXA DE VALUATION — EXPANSÃO GLOBAL", value: "US$ 3T–6T", sub: "50–100M clientes ativos" },
]);

goldBlock("TESE CENTRAL", "A pergunta correta não é 'quanto vale uma ferramenta de marketing?'. A pergunta é: quanto vale a infraestrutura que torna o crescimento empresarial executável, auditável, escalável e acessível para qualquer pessoa ou empresa?");

footer();

// ══════════════════════════════════════════════════════════════════════════════
//  PAGE 3 — THESIS + MARKET CONTEXT
// ══════════════════════════════════════════════════════════════════════════════
addPage("01–02  INVESTMENT THESIS  ·  MARKET CONTEXT");

h2("01", "Executive Investment Thesis");
body("NexOS AI não é uma ferramenta de marketing. NexOS AI é uma infraestrutura operacional de crescimento. A plataforma transforma intenção empresarial em execução comercial completa:");
highlight("ideia → produto → oferta → campanha → criativos → vídeos → anúncios → audiência → leads → aquecimento → carrinho → vendas → remarketing → aprendizado → próxima campanha");
body("O valor do NexOS não está em gerar textos, imagens ou páginas. O valor está em executar crescimento. O mercado atual é fragmentado — empresas coordenam copywriters, designers, editores, estrategistas, gestores de tráfego, analistas, agências, ferramentas de CRM, SEO, automação, funis e vídeo. O NexOS substitui essa fragmentação por uma operação integrada, auditável e automatizada.");
goldBlock("TESE CENTRAL", "Se toda empresa precisa vender, crescer, aparecer, converter ou influenciar, então toda empresa precisa de uma infraestrutura de crescimento. NexOS AI é essa infraestrutura.");

h2("02", "Market Context");
body("O NexOS atua na interseção de mercados gigantescos. Aquisição de atenção já é uma das maiores linhas de gasto empresarial do mundo, enquanto empresas migram aceleradamente para infraestrutura de marketing, personalização e automação.");
doc.moveDown(0.4);

tHead(["Mercado", "Tamanho atual", "Projeção"], [210, 130, 143]);
tRow(["Advertising (global)",             "—",                "~US$ 1,26T (2026)"], [210, 130, 143]);
tRow(["Digital Advertising",              "US$ 567,9B (2025)", "US$ 1,69T (2033)"],  [210, 130, 143], true);
tRow(["MarTech",                          "US$ 551,9B (2025)", "US$ 2,38T (2033)"],  [210, 130, 143]);
tRow(["Creator Economy",                  "—",                "~US$ 480B (2027)"],   [210, 130, 143], true);
tRow(["Intelligent Process Automation",   "US$ 14,55B (2024)", "US$ 44,74B (2030)"], [210, 130, 143]);

doc.moveDown(0.3);
note("Fontes: estimativas consolidadas — Advertising, MarTech, Creator Economy (Goldman Sachs) e Automação de Processos.");
doc.moveDown(0.3);
body("O NexOS captura valor em todos esses mercados: MarTech · Digital Advertising · Creator Economy · AI Agents · Business Automation · Sales Enablement · Video Production · Funnel Infrastructure · Campaign Execution · Regional Growth & Affiliate Distribution.");

footer();

// ══════════════════════════════════════════════════════════════════════════════
//  PAGE 4 — STRUCTURAL PROBLEM + PRODUCT ECOSYSTEM
// ══════════════════════════════════════════════════════════════════════════════
addPage("03–04  STRUCTURAL PROBLEM  ·  PRODUCT ECOSYSTEM");

h2("03", "The Structural Market Problem");
body("O problema global não é falta de ferramentas. O problema é que as ferramentas não executam a cadeia inteira.");
doc.moveDown(0.4);

[
  { t: "SEO",              d: "Gera tráfego, mas não cria produto, oferta, vídeos, lançamento, carrinho ou remarketing." },
  { t: "CRM",              d: "Organiza contatos, mas não cria contatos, não aquece audiência, não cria desejo, não fecha vendas." },
  { t: "Landing builders", d: "Criam páginas, mas não sabem qual oferta converte, qual público atingir ou qual timing aplicar." },
  { t: "AI content tools", d: "Criam textos e vídeos, mas dependem de alguém para estratégia, campanha, distribuição, aprovação e execução." },
  { t: "Agências",         d: "Executam, mas são caras, lentas, limitadas por agenda, capacidade e custo proporcional." },
].forEach((p) => {
  space(30);
  const y = doc.y;
  doc.rect(ML, y, CW, 26).fill(C.tint);
  doc.rect(ML, y, 2, 26).fill(C.navyLt);
  doc.fillColor(C.navy).fontSize(8).font("Helvetica-Bold").text(p.t, ML + 10, y + 5, { lineBreak: false });
  doc.fillColor(C.slate).fontSize(7.5).font("Helvetica").text(p.d, ML + 10, y + 16, { width: CW - 20 });
  doc.y = y + 29;
});

goldBlock("NEXOS", "NexOS elimina a fragmentação. O NexOS não pergunta apenas 'o que você quer criar?' — O que você quer conquistar? E executa a operação.");

h2("04", "Product Definition & Ecosystem — v2.0");
body("NexOS AI opera como um AI-Powered Growth Execution Operating System e se posiciona no mercado através de um ecossistema de produtos em funil ascendente:");
doc.moveDown(0.4);

tHead(["Produto", "Regular", "Lançamento", "Modelo de acesso"], [168, 82, 92, 141]);
tRow(["Isca — Os 7 Erros Fatais",        "Grátis",   "Grátis",   "PDF via WhatsApp + grupo"],         [168, 82, 92, 141]);
tRow(["Tripwire — Primeiros R$10K",       "R$ 290",   "R$ 97",    "Mini-guia digital"],                [168, 82, 92, 141], true);
tRow(["NexOS AI Solo",                    "R$ 15.990","R$ 3.990", "Vitalício · sem mensalidade"],       [168, 82, 92, 141]);
tRow(["NexOS AI Agency",                  "R$ 14.000","R$ 9.990", "10 campanhas · white-label"],        [168, 82, 92, 141], true);
tRow(["NexOS Academy",                    "R$ 3.900", "R$ 2.500", "Metodologia · incluso no NexOS AI"], [168, 82, 92, 141]);
tRow(["NexOS Connect — Guia de APIs",     "R$ 297",   "R$ 197",   "Guia técnico · standalone"],        [168, 82, 92, 141], true);

doc.moveDown(0.4);
body("Taxa por execução: o primeiro lançamento é gratuito. A partir do 2.º lançamento executado na plataforma → R$ 497 por lançamento (pay per execution) — alinhando a receita do NexOS ao crescimento real do cliente.");

footer();

// ══════════════════════════════════════════════════════════════════════════════
//  PAGE 5 — CORE CAPABILITIES
// ══════════════════════════════════════════════════════════════════════════════
addPage("05  CORE PRODUCT CAPABILITIES");

h2("05", "Core Product Capabilities");

h3("5.1 — NexOS Command Agent — 64 agentes · 7 departamentos");
body("O NexOS opera com um Diretor Geral de IA que orquestra 64 agentes especializados. O usuário não escolhe agentes — o sistema convoca cada agente no momento correto da execução.");
doc.moveDown(0.35);

tHead(["Departamento", "Agentes"], [175, 308]);
[
  ["Estratégia & Planejamento", "Strategy · Command · Profile Builder · Market Intel · Offer · Pricing Psychologist"],
  ["Conteúdo & Copy",           "Copywriter · Creative Director · VSL · CPL · Social Media · Ad Copy · Landing Page · Hook Factory"],
  ["Audiência & Tráfego",       "Targeting · Media Buyer · Organic Traffic · A/B Test Designer · Compliance"],
  ["Vídeo & Criativos",         "Video Director · Creative Concept · Ad Critic · Stories Sequence · Video Hook"],
  ["Analytics & Otimização",    "Analytics · Optimization · Launch Debriefing · Scarcity Engineer"],
  ["Automação & Vendas",        "Sales Warmer · Closer · Desire · Objection · Consultant · Affiliate · Reengagement"],
  ["Mentalidade & Crescimento", "Mental Frequency Coach · Identity Architect · Obstinacy Trainer · Creator Growth"],
].forEach(([d, a], i) => tRow([d, a], [175, 308], i % 2 === 1));

h3("5.2 — Live Production Display");
body("Frontend exibe produção em tempo real — o usuário vê estratégia sendo escrita, criativos sendo criados, vídeos sendo planejados, públicos definidos e decisões registradas. Tudo vira log auditável: cria percepção de valor, confiança e prova operacional.");

h3("5.3 — Video Production Engine");
tHead(["Modo", "Execução"], [100, 383]);
tRow(["Com aparição",  "Roteiro, cenário, enquadramento, iluminação, gravação orientada, corte automático, legendas, B-roll, trilha, versões."], [100, 383]);
tRow(["Sem aparição",  "Avatar digital, voz clonada, apresentador sintético, motion graphics, narração automatizada."], [100, 383], true);
tRow(["Híbrido",       "Imagem real, avatar parcial, voz clonada, cenas complementares, edição por IA."], [100, 383]);

h3("5.4–5.5 — Campaign Type Engine · Launch Engine");
body("Identifica tipo de campanha e trilha de receita — lançamento, branding, autoridade regional, remarketing, creator monetization. O usuário escolhe o objetivo; a IA escolhe a arquitetura.");
doc.moveDown(0.3);
tHead(["Trilha", "Meta em 7 dias", "Stack de agentes"], [100, 130, 253]);
tRow(["6 Dígitos",  "R$ 100K – R$ 999K",  "Strategy + Launch + Copy + Traffic"],        [100, 130, 253]);
tRow(["8 Dígitos",  "R$ 10M – R$ 99M",    "Full stack: todos os agentes + tracking"],   [100, 130, 253], true);
tRow(["10 Dígitos", "R$ 100M+",           "Infraestrutura completa + agency + white-label"], [100, 130, 253]);

h3("5.6 — Self-Proof Engine");
body("O maior case inicial do NexOS é ele próprio. O NexOS se lança, documenta seu próprio lançamento e grava suas próprias telas. O lead não assiste uma promessa — ele vive a demonstração. Esse é o maior mecanismo de prova social.");

h3("5.7–5.8 — Paid Traffic Intelligence · Adaptive Interface (Fundador / Arquiteto)");
body("Tráfego pago: agentes atuam sobre sinais de entrega, otimização de lance, janelas de aprendizado, segmentação dinâmica e comportamento de leilão. Interface: dois modos — Fundador (simples, guiado) e Arquiteto (técnico, granular). Switch a qualquer momento.");

footer();

// ══════════════════════════════════════════════════════════════════════════════
//  PAGE 6 — MASTERPRINT
// ══════════════════════════════════════════════════════════════════════════════
addPage("05.10  MASTERPRINT ANTI-PIRACY SYSTEM");

h2("05.10", "Masterprint Anti-Piracy System — NOVO · v2.0");

space(26);
doc.rect(ML, doc.y, CW, 24).fill(C.tintDk);
doc.rect(ML, doc.y, 3, 24).fill(C.gold);
doc.fillColor(C.navy).fontSize(9).font("Helvetica-Bold")
  .text("Proteção forense nativa de propriedade intelectual gerada na plataforma", ML + 12, doc.y + 8, { lineBreak: false });
doc.y += 32;

body("O NexOS protege toda propriedade intelectual gerada na plataforma com rastreamento forense de documentos. Cada PDF, guia, roteiro, estratégia ou material exportado recebe um fingerprint único e invisível — permitindo identificação do vazador em caso de distribuição não autorizada.");
doc.moveDown(0.4);

tHead(["Componente", "Descrição"], [155, 328]);
tRow(["Fingerprint único",            "Código NXS-XXXX-XXXX embutido por download — invisível ao usuário, único por titular"],             [155, 328]);
tRow(["Cadeia de custódia",           "Registro completo: userId · email · nome · IP · user-agent · workspace · campanha · timestamp"],     [155, 328], true);
tRow(["Admin lookup",                 "Código extraído de arquivo vazado → identificação imediata do titular original"],                     [155, 328]);
tRow(["Cross-referência econômica",   "CPF Asaas + device fingerprint + padrão IP → identifica culpado mesmo com cadastro fraudulento"],    [155, 328], true);
tRow(["Dossiê jurídico",              "Exportação estruturada para notificação legal — LGPD Art. 42 + Marco Civil da Internet"],            [155, 328]);
tRow(["Alertas automáticos",          "Detecta mesmo documento em múltiplos IPs distintos e notifica o admin em tempo real"],               [155, 328], true);

goldBlock("DIFERENCIAL COMPETITIVO", "Nenhuma plataforma de SaaS de marketing no Brasil oferece rastreabilidade forense nativa de documentos gerados. O Masterprint cria uma barreira de proteção de IP sem precedentes no setor.");

h3("5.9 — Landing Page, Domain & Hosting Engine");
body("O NexOS cria a landing page completa de cada campanha sem que o usuário precise desenvolver ou configurar nada manualmente. A plataforma auxilia na aquisição e hospedagem do domínio com integração nativa.");

doc.moveDown(0.5);
rule();
h3("Resumo de Capacidades — v2.0");
doc.moveDown(0.2);
tHead(["Capability", "Status"], [345, 138]);
tRow(["64 agentes de IA em 7 departamentos",            "Ativo"],               [345, 138]);
tRow(["Live Production Display (Socket.io real-time)",  "Ativo"],               [345, 138], true);
tRow(["Video Production Engine (3 modos)",              "Ativo"],               [345, 138]);
tRow(["Launch Engine — trilhas 6 / 8 / 10 dígitos",    "Ativo"],               [345, 138], true);
tRow(["Adaptive Interface Fundador / Arquiteto",        "Ativo"],               [345, 138]);
tRow(["Masterprint Anti-Piracy System",                 "Ativo — NOVO v2.0"],  [345, 138], false, true);
tRow(["NexOS Connect — API Guide (standalone)",         "Em desenvolvimento"],  [345, 138], true);

footer();

// ══════════════════════════════════════════════════════════════════════════════
//  PAGE 7 — ECONOMIC MODEL
// ══════════════════════════════════════════════════════════════════════════════
addPage("06  ECONOMIC MODEL  —  v2.0");

h2("06", "Economic Model — v2.0 (Atualizado)");
body("Modelo baseado em aquisição única + consumo por uso. Sem mensalidade. Sem recorrência forçada. O cliente consome mais quando opera mais — alinhando a receita do NexOS ao crescimento real do cliente.");

h3("Aquisição — Ticket Único Vitalício");
tHead(["Plano", "Preço Regular", "Preço Lançamento", "Campanhas", "Créditos incluídos"], [78, 115, 100, 90, 100]);
tRow(["Solo",   "R$ 15.990", "R$ 3.990", "3 campanhas",  "900 cr (~2 lançamentos)"],  [78, 115, 100, 90, 100]);
tRow(["Agency", "R$ 14.000", "R$ 9.990", "10 campanhas", "2.000 cr (~5 lançamentos)"], [78, 115, 100, 90, 100], true);

h3("Taxa por Execução — Pay per Execution");
space(42);
const pyY = doc.y;
doc.rect(ML, pyY, CW, 38).fill(C.tint);
doc.rect(ML, pyY, 3, 38).fill(C.gold);
doc.fillColor(C.navyMid).fontSize(9).font("Helvetica-Bold").text("Primeiro lançamento: GRATUITO", ML + 12, pyY + 7);
doc.fillColor(C.slate).fontSize(8).font("Helvetica")
  .text("A partir do 2.º lançamento executado → R$ 497 por lançamento. Modelo pay-per-execution: a receita do NexOS cresce quando o cliente executa.", ML + 12, pyY + 21, { width: CW - 20 });
doc.y = pyY + 46;

h3("Créditos de IA — Consumo por Uso (v2.0 — preços atualizados)");
tHead(["Pacote", "Créditos", "Preço", "Equivalente", "Custo/cr"], [70, 65, 70, 200, 78]);
tRow(["Boost",   "500 cr",   "R$ 85",  "~1 lançamento pequeno",         "R$ 0,17"],  [70, 65, 70, 200, 78]);
tRow(["Starter", "1.500 cr", "R$ 239", "~3–4 lançamentos completos",    "R$ 0,16"],  [70, 65, 70, 200, 78], true);
tRow(["Pro",     "3.500 cr", "R$ 529", "~8–9 lançamentos completos",    "R$ 0,15"],  [70, 65, 70, 200, 78]);
tRow(["Elite",   "7.000 cr", "R$ 979", "~17–18 lançamentos · agências", "R$ 0,14"],  [70, 65, 70, 200, 78], true);

h3("Receita pelo Ecossistema Completo de Produtos");
tHead(["Produto", "Preço", "Função econômica", "Recorrência"], [135, 75, 178, 95]);
tRow(["Isca — Os 7 Erros Fatais",     "Grátis",       "Captura de lead qualificado",                 "Topo de funil"],     [135, 75, 178, 95]);
tRow(["Tripwire — Primeiros R$10K",   "R$ 97",        "Primeira transação · qualificação financeira", "Entrada no funil"], [135, 75, 178, 95], true);
tRow(["NexOS AI Solo / Agency",       "R$3.990–9.990","Aquisição principal — ticket único vitalício",  "Uma vez"],          [135, 75, 178, 95]);
tRow(["NexOS Academy",                "R$ 2.500",     "Metodologia · bônus incluso no NexOS AI",     "Junto ou separado"], [135, 75, 178, 95], true);
tRow(["Taxa de lançamento",           "R$ 497",       "Pay-per-execution (2.º lançamento+)",          "Por uso"],          [135, 75, 178, 95]);
tRow(["Créditos de IA",               "R$85–R$979",   "Consumo recorrente por uso operacional",       "Contínuo"],         [135, 75, 178, 95], true);
tRow(["NexOS Connect — API Guide",    "R$ 197",       "Guia técnico de integrações · standalone",     "Entry-level técnico"],[135, 75, 178, 95]);

footer();

// ══════════════════════════════════════════════════════════════════════════════
//  PAGE 8 — GROWTH MISSION
// ══════════════════════════════════════════════════════════════════════════════
addPage("07  YEAR 1 GROWTH MISSION");

h2("07", "Year 1 Growth Mission");

space(58);
const mY = doc.y;
doc.rect(ML, mY, CW, 52).fill(C.navy);
doc.fillColor(C.white).fontSize(32).font("Helvetica-Bold")
  .text("1.000.000", ML, mY + 8, { width: CW, align: "center" });
doc.fillColor("#94a3b8").fontSize(8.5).font("Helvetica")
  .text("CLIENTES ATIVOS EM 12 MESES — MISSÃO INTERNA", ML, mY + 40, { width: CW, align: "center" });
doc.y = mY + 62;

doc.moveDown(0.3);
body("Estratégia: 52 semanas, 52 regiões estratégicas do Brasil, 52 públicos prioritários e 52 ciclos de lançamento — combinando campanhas próprias acumulativas, afiliados regionais, prova social crescente e reinjeção de capital.");

h3("Funil de Aquisição — Do Lead ao Cliente");
tHead(["Estágio", "Produto", "Objetivo"], [120, 168, 195]);
tRow(["Topo de funil",           "Isca — Os 7 Erros Fatais",    "Volume massivo de leads qualificados"],    [120, 168, 195]);
tRow(["Qualificação financeira", "Tripwire R$97",                "Filtrar leads prontos para comprar"],      [120, 168, 195], true);
tRow(["Conversão principal",     "NexOS AI R$3.990–R$9.990",    "Aquisição vitalícia — receita central"],   [120, 168, 195]);
tRow(["Upsell metodologia",      "NexOS Academy R$2.500",       "Profundidade + LTV por cliente"],          [120, 168, 195], true);
tRow(["Consumo recorrente",      "Créditos + taxa de lançamento","Receita contínua por uso operacional"],   [120, 168, 195]);

h3("Diferencial Operacional");
space(48);
const dfY = doc.y;
doc.rect(ML, dfY, CW, 44).fill(C.tint);
doc.rect(ML, dfY, 3, 44).fill(C.navyLt);
doc.fillColor(C.navyMid).fontSize(8.5).font("Helvetica-Bold").text("Por que só o NexOS consegue executar isso em escala:", ML + 10, dfY + 7);
doc.fillColor(C.slate).fontSize(8).font("Helvetica")
  .text("Sem expansão proporcional de time. Sem contratar agências regionais. Sem depender de 52 equipes. O NexOS executa essa amplitude com baixo atrito operacional porque o produto é a própria máquina de execução.", ML + 10, dfY + 21, { width: CW - 20 });
doc.y = dfY + 52;

h3("Multiplicadores de Crescimento");
tHead(["Multiplicador", "Mecanismo", "Impacto"], [148, 190, 145]);
tRow(["Auto-lançamento",         "NexOS se lança com NexOS — case público",        "Prova de produto como marketing"],      [148, 190, 145]);
tRow(["Afiliados regionais",     "Comissão por indicação validada",                 "Força de vendas sem custo fixo"],       [148, 190, 145], true);
tRow(["Prova social acumulativa","Casos documentados na plataforma",                "Reduz custo de conversão"],             [148, 190, 145]);
tRow(["Reinjeção de capital",    "Receita anterior financia próxima semana",        "Crescimento composto semanal"],         [148, 190, 145], true);

footer();

// ══════════════════════════════════════════════════════════════════════════════
//  PAGE 9 — REVENUE PROJECTION
// ══════════════════════════════════════════════════════════════════════════════
addPage("08  REVENUE PROJECTION — 1 MILLION CUSTOMERS");

h2("08", "Revenue Projection — 1 Million Customers");

h3("8.1 — Receita de aquisição (ticket único)");
tHead(["Clientes", "Ticket (lançamento)", "Receita total"], [130, 180, 173]);
tRow(["1.000.000", "R$ 3.990 (Solo — base)",             "R$ 3,99 bilhões"],  [130, 180, 173]);
tRow(["1.000.000", "R$ 9.990 (Agency — blended 20%)",    "Até R$ 9,99B"],     [130, 180, 173], true);

h3("8.2 — Taxa por lançamento (pay-per-execution)");
body("A partir do 2.º lançamento: R$497 × 3 lançamentos pagos/ano × 1M clientes:");
tHead(["Clientes ativos", "Execuções/ano (pagas)", "Receita por taxa"], [150, 165, 168]);
tRow(["1.000.000", "3 lançamentos pagos × R$ 497", "R$ 1,49 bilhão/ano"], [150, 165, 168]);

h3("8.3 — Receita recorrente de créditos de IA");
tHead(["Clientes ativos", "Consumo médio/mês", "Receita mensal", "ARR"], [122, 110, 120, 131]);
tRow(["1.000.000", "R$ 1.000", "R$ 1 bilhão", "R$ 12 bilhões"], [122, 110, 120, 131]);

h3("8.4 — Ecossistema (uplift adicional)");
tHead(["Produto", "Penetração estimada", "Receita adicional"], [188, 148, 147]);
tRow(["NexOS Academy R$2.500", "40% dos clientes NexOS AI", "R$ 1B"], [188, 148, 147]);
tRow(["NexOS Connect R$197",   "15% da base ativa",          "R$ 29,55M"], [188, 148, 147], true);

h3("8.5 — Potencial Econômico Anualizado Consolidado");
space(80);
const rY = doc.y;
doc.rect(ML, rY, CW, 68).fill(C.tint);
doc.rect(ML, rY, 2, 68).fill(C.navyLt);
[
  { l: "Receita de aquisição (Solo — 1M clientes)",          v: "R$ 3,99B" },
  { l: "Taxa de lançamento (3 paid × 1M clientes)",          v: "R$ 1,49B" },
  { l: "Run-rate anualizado de créditos (R$1k/mês × 1M)",   v: "R$ 12B"   },
  { l: "NexOS Academy (40% penetração)",                     v: "+ R$ 1B"  },
].forEach(({ l, v }, i) => {
  const ry = rY + 8 + i * 15;
  doc.fillColor(C.slate).fontSize(8).font("Helvetica").text(l, ML + 10, ry, { lineBreak: false });
  doc.fillColor(C.navyMid).fontSize(8).font("Helvetica-Bold").text(v, PW - MR - 55, ry, { lineBreak: false });
});
doc.y = rY + 78;

space(30);
const ttY = doc.y;
doc.rect(ML, ttY, CW, 24).fill(C.navy);
doc.fillColor(C.white).fontSize(9).font("Helvetica-Bold")
  .text("POTENCIAL ECONÔMICO ANUALIZADO — ANO 1", ML + 10, ttY + 7, { lineBreak: false });
doc.fillColor(C.white).fontSize(13).font("Helvetica-Bold")
  .text("R$ 18,48B+", PW - MR - 68, ttY + 5, { lineBreak: false });
doc.y = ttY + 32;

doc.moveDown(0.35);
note("Nota: valores refletem o run-rate anualizado ao atingir 1M de clientes ativos. Se os clientes entram progressivamente ao longo do ano, os valores realizados no primeiro ano variam conforme o mês de entrada de cada coorte.");

footer();

// ══════════════════════════════════════════════════════════════════════════════
//  PAGE 10 — VALUATION FRAMEWORK
// ══════════════════════════════════════════════════════════════════════════════
addPage("09  VALUATION FRAMEWORK");

h2("09", "Valuation Framework");
body("Valuation depende de como o mercado classifica o NexOS.");

h3("9.1 — Como SaaS tradicional");
body("O BVP Nasdaq Emerging Cloud Index mostra múltiplo médio de ~6,3x. Aplicando múltiplos conservadores ao run-rate de R$12B em créditos:");
tHead(["Classificação", "Múltiplo", "Valuation"], [220, 100, 163]);
tRow(["SaaS conservador", "6x receita",  "R$ 72B"],  [220, 100, 163]);
tRow(["SaaS agressivo",   "10x receita", "R$ 120B"], [220, 100, 163], true);

h3("9.2 — Como AI-native high-growth platform");
body("Para uma plataforma AI-native com crescimento extremo, consumo recorrente e dominância de categoria:");
tHead(["Múltiplo", "Base ARR", "Valuation"], [100, 180, 203]);
tRow(["15x", "R$ 12B ARR", "R$ 180B"], [100, 180, 203]);
tRow(["20x", "R$ 12B ARR", "R$ 240B"], [100, 180, 203], true);
tRow(["25x", "R$ 12B ARR", "R$ 300B"], [100, 180, 203]);
tRow(["40x", "R$ 12B ARR", "R$ 480B"], [100, 180, 203], true);

h3("9.3 — Como Growth Infrastructure");
body("Se o mercado classifica NexOS como infraestrutura de crescimento empresarial, a avaliação passa a ser feita em função da dependência econômica criada:");
tHead(["Cenário estratégico", "Valuation"], [250, 233]);
tRow(["R$ 12B ARR × 50x",  "R$ 600B"], [250, 233]);
tRow(["R$ 12B ARR × 75x",  "R$ 900B"], [250, 233], true);
tRow(["R$ 12B ARR × 100x", "R$ 1,2T"], [250, 233]);

goldBlock("PREMISSA", "Esse valuation exige que o mercado veja o NexOS como camada operacional indispensável, não como software de marketing.");

h3("9.4 — Base expandida com ecossistema completo (~R$ 14,5B ARR)");
body("Incluindo taxas de lançamento (R$1,49B) e Academy (R$1B), a base sobe para ~R$14,5B — expandindo todos os cenários em ~20%:");
tHead(["Múltiplo", "Base expandida", "Valuation expandido"], [100, 220, 163]);
tRow(["25x",  "R$ 14,5B ARR", "R$ 362B"],  [100, 220, 163]);
tRow(["50x",  "R$ 14,5B ARR", "R$ 725B"],  [100, 220, 163], true);
tRow(["100x", "R$ 14,5B ARR", "R$ 1,45T"], [100, 220, 163]);

footer();

// ══════════════════════════════════════════════════════════════════════════════
//  PAGE 11 — PATH TO TRILLION + WHY INFRASTRUCTURE
// ══════════════════════════════════════════════════════════════════════════════
addPage("10–11  PATH TO TRILLION  ·  INFRASTRUCTURE MULTIPLES");

h2("10", "Path to Trillion-Dollar Valuation");
body("A tese de trilhões não vem de 1 milhão de clientes isoladamente — 1 milhão de clientes é a prova de categoria. A tese de trilhões vem quando o mercado projeta que o NexOS será infraestrutura global.");

h3("10.1 — Cenário de expansão global (50M clientes)");
note("PREMISSA: 50M clientes ativos globais · R$1.000/mês consumo médio · Receita ≈ US$120B ARR (câmbio R$5/USD)");
tHead(["Múltiplo sobre ARR", "Valuation"], [250, 233]);
tRow(["US$ 120B ARR × 25x", "US$ 3T"],   [250, 233]);
tRow(["US$ 120B ARR × 40x", "US$ 4,8T"], [250, 233], true);

h3("10.2 — Cenário de 100 milhões de clientes");
note("100M × R$1.000 × 12 = R$1,2T/ano ≈ US$240B ARR");
tHead(["Múltiplo sobre ARR", "Valuation"], [250, 233]);
tRow(["US$ 240B ARR × 20x", "US$ 4,8T"], [250, 233]);
tRow(["US$ 240B ARR × 25x", "US$ 6T"],   [250, 233], true);

goldBlock("CONCLUSÃO MATEMÁTICA", "Nesse cenário, a marca de US$5T deixa de ser uma afirmação emocional e passa a ser uma consequência matemática de base global massiva, consumo recorrente, infraestrutura indispensável e múltiplos de plataforma dominante.");

h2("11", "Why NexOS Can Command Infrastructure Multiples");
body("Microsoft tornou-se indispensável porque o computador pessoal precisava de um sistema operacional. AWS tornou-se indispensável porque empresas precisavam de computação escalável. Stripe tornou-se indispensável porque negócios digitais precisavam processar pagamentos.");
doc.moveDown(0.4);
body("NexOS torna-se indispensável porque todo agente econômico precisa crescer. Todo mundo vende, influencia, depende de clientes, de audiência, de autoridade, de conversão. O NexOS transforma isso em operação.");
doc.moveDown(0.4);
body("O mercado não adotará NexOS apenas porque ele é inteligente. O mercado adotará porque fazer sem NexOS será mais lento, mais caro, mais confuso e menos eficiente.");
highlight("Assim como qualquer pessoa pode escrever sem Word, qualquer empresa pode tentar crescer sem NexOS. Mas quando a alternativa é mais lenta, mais cara e mais frágil, o padrão muda.");

footer();

// ══════════════════════════════════════════════════════════════════════════════
//  PAGE 12 — STRATEGIC MOAT
// ══════════════════════════════════════════════════════════════════════════════
addPage("12  STRATEGIC MOAT");

h2("12", "Strategic Moat");
doc.moveDown(0.3);

// Two-column moat cards
const moats = [
  { n: "12.1", t: "Data Moat",      d: "Cada campanha gera dados proprietários: criativos vencedores, públicos vencedores, objeções, timing, regiões, CPL, CPA, ROAS. Esses dados não existem em nenhuma outra plataforma." },
  { n: "12.2", t: "Execution Moat", d: "Ferramentas geram ativos. NexOS executa. Execução cria dependência operacional — quanto mais o cliente executa, mais difícil é migrar sem perder o contexto acumulado." },
  { n: "12.3", t: "Workflow Moat",  d: "Quanto mais o cliente usa, mais o NexOS entende: produto, marca, público, resultado, tom e oferta. Esse contexto acumulado é intransferível para qualquer concorrente." },
  { n: "12.4", t: "Proof Moat",     d: "O auto-lançamento documentado vira case central. O lead não assiste uma promessa — ele vive a demonstração. Loop de prova social que se auto-alimenta com cada novo lançamento." },
];

// Draw pairs side by side
const halfW = CW / 2 - 6;
for (let i = 0; i < moats.length; i += 2) {
  const left  = moats[i];
  const right = moats[i + 1];
  // estimate height for both
  const lLines = Math.ceil(left.d.length / ((halfW - 20) / 4.8));
  const rLines = right ? Math.ceil(right.d.length / ((halfW - 20) / 4.8)) : 0;
  const h = Math.max(lLines, rLines) * 11 + 36;
  space(h + 8);
  const y = doc.y;
  // left card
  doc.rect(ML, y, halfW, h).fill(C.tint);
  doc.rect(ML, y, 2, h).fill(C.navyLt);
  doc.fillColor(C.slateLt).fontSize(7).font("Helvetica-Bold").text(left.n, ML + 8, y + 7, { lineBreak: false });
  doc.fillColor(C.navyMid).fontSize(8.5).font("Helvetica-Bold").text(left.t, ML + 8, y + 18);
  doc.fillColor(C.slate).fontSize(7.5).font("Helvetica").text(left.d, ML + 8, doc.y + 2, { width: halfW - 16, lineGap: 1.5 });
  // right card
  if (right) {
    const rx = ML + halfW + 12;
    doc.rect(rx, y, halfW, h).fill(C.tint);
    doc.rect(rx, y, 2, h).fill(C.navyLt);
    doc.fillColor(C.slateLt).fontSize(7).font("Helvetica-Bold").text(right.n, rx + 8, y + 7, { lineBreak: false });
    doc.fillColor(C.navyMid).fontSize(8.5).font("Helvetica-Bold").text(right.t, rx + 8, y + 18);
    doc.fillColor(C.slate).fontSize(7.5).font("Helvetica").text(right.d, rx + 8, y + 30, { width: halfW - 16, lineGap: 1.5 });
  }
  doc.y = y + h + 8;
}

// 12.5 full width
space(34);
const m5Y = doc.y;
doc.rect(ML, m5Y, CW, 30).fill(C.tint);
doc.rect(ML, m5Y, 2, 30).fill(C.navyLt);
doc.fillColor(C.slateLt).fontSize(7).font("Helvetica-Bold").text("12.5", ML + 8, m5Y + 7, { lineBreak: false });
doc.fillColor(C.navyMid).fontSize(8.5).font("Helvetica-Bold").text("Category Moat", ML + 8, m5Y + 7, { lineBreak: false, x: ML + 28 });
doc.fillColor(C.slate).fontSize(7.5).font("Helvetica")
  .text("NexOS cria uma categoria: Growth Execution Infrastructure. Quem cria a categoria tende a capturar percepção de liderança permanente — independente de quem entre depois.", ML + 8, m5Y + 18, { width: CW - 16 });
doc.y = m5Y + 38;

// 12.6 Masterprint — full width gold
space(66);
const mpY = doc.y;
doc.rect(ML, mpY, CW, 62).fill(C.goldBg);
doc.rect(ML, mpY, CW, 1).fill(C.gold);
doc.rect(ML, mpY, 3, 62).fill(C.gold);
doc.fillColor(C.slateLt).fontSize(7).font("Helvetica-Bold").text("12.6 — NOVO · v2.0", ML + 10, mpY + 7, { lineBreak: false });
doc.fillColor(C.gold).fontSize(10).font("Helvetica-Bold")
  .text("Proprietary Content Security Moat — Masterprint", ML + 10, mpY + 18);
doc.fillColor(C.navy).fontSize(8).font("Helvetica")
  .text("Toda saída da plataforma — PDFs, guias, roteiros, estratégias — carrega rastreabilidade forense nativa. Fingerprint único por usuário + cadeia de custódia completa + cruzamento econômico via CPF/Asaas/device/IP + exportação de dossiê jurídico. Nenhuma plataforma de SaaS de marketing no Brasil oferece isso. O Masterprint cria uma barreira de proteção de IP sem precedentes no setor.", ML + 10, mpY + 34, { width: CW - 18 });
doc.y = mpY + 70;

footer();

// ══════════════════════════════════════════════════════════════════════════════
//  PAGE 13 — INVESTOR CONCLUSION
// ══════════════════════════════════════════════════════════════════════════════
addPage("13  INVESTOR CONCLUSION");

h2("13", "Investor Conclusion");

body("NexOS AI é uma tese de infraestrutura. Não é uma tese de ferramenta.");
doc.moveDown(0.3);
body("O mercado não precisa de mais uma IA para escrever texto. O mercado precisa de uma camada que execute crescimento. NexOS entrega:");
highlight("planejamento · produção · direção · criativos · vídeos · tráfego · funil · segmentação · aquecimento · venda · remarketing · auditoria · aprendizado · escala");
body("O primeiro grande case é o próprio NexOS: uma plataforma que se lança, se vende, documenta sua própria execução e transforma esse histórico em prova pública.");

h3("Por que a v2.0 é uma tese mais sólida:");
doc.moveDown(0.2);

[
  ["Ecossistema de 5 produtos",        "Funil completo — da isca grátis ao guia técnico. Múltiplas portas de entrada, múltiplas fontes de receita."],
  ["Modelo pay-per-execution",         "R$497/lançamento (2.º+) alinha receita ao sucesso do cliente — participação no resultado da execução."],
  ["Masterprint Anti-Piracy",          "Proteção forense de IP nativa — diferencial técnico sem precedente no setor de SaaS de marketing no Brasil."],
  ["64 agentes especializados",        "7 departamentos completos — de mentalidade a vendas. Não é um chatbot; é uma equipe de especialistas de IA."],
  ["Trilhas 6 / 8 / 10 dígitos",       "Produto calibrado por meta de receita — não por tamanho de empresa. Qualquer pessoa pode usar."],
  ["Academy como produto autônomo",    "R$3.900 de metodologia vendida separadamente — expansão de LTV sem custo marginal adicional."],
].forEach(([title, desc]) => {
  space(28);
  const iy = doc.y;
  doc.rect(ML, iy, CW, 26).fill(C.tint);
  doc.rect(ML, iy, 2, 26).fill(C.navyLt);
  doc.fillColor(C.navyMid).fontSize(8).font("Helvetica-Bold").text(title, ML + 10, iy + 5, { lineBreak: false });
  doc.fillColor(C.slate).fontSize(7.5).font("Helvetica").text(desc, ML + 10, iy + 16, { width: CW - 20 });
  doc.y = iy + 29;
});

doc.moveDown(0.7);
space(62);
const cY = doc.y;
doc.rect(ML, cY, CW, 58).fill(C.navy);
doc.fillColor(C.white).fontSize(8.5).font("Helvetica-BoldOblique")
  .text('"Quanto vale uma ferramenta de marketing?" — essa não é a pergunta definitiva para investidores.', ML + 14, cY + 8, { width: CW - 26 });
doc.fillColor("#94a3b8").fontSize(8.5).font("Helvetica-Bold")
  .text("A pergunta correta é: quanto vale a infraestrutura que torna crescimento empresarial executável, auditável, escalável e acessível para qualquer pessoa ou empresa?", ML + 14, cY + 24, { width: CW - 26 });
doc.y = cY + 66;

doc.moveDown(0.5);
body("A resposta é: vale o tamanho da camada econômica que ela passa a controlar.");
doc.moveDown(0.8);
space(30);
doc.fillColor(C.navy).fontSize(16).font("Helvetica-Bold").text("E essa camada é global.", ML, doc.y, { width: CW, align: "center" });
doc.moveDown(1);
doc.fillColor(C.slateLt).fontSize(6.5).font("Helvetica")
  .text("NexOS AI  ·  NXS-2026-001  ·  Prospect Paper v2.0  ·  Junho 2026  ·  STRICTLY PRIVATE & CONFIDENTIAL", ML, doc.y, { width: CW, align: "center" });

footer();

// ─── FINALIZE ────────────────────────────────────────────────────────────────
doc.end();
console.log(`✅ PDF gerado: ${OUT_PATH}  (${pageNum} páginas)`);
