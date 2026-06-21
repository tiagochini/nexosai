/**
 * NexOS AI — Investor Prospect Paper v2.1
 * White + Deep Navy  ·  Dynamic row heights  ·  Solo only (Agency removed)
 */
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

const OUT = path.resolve("NexOS_AI_Investor_Prospect_v2.pdf");
const doc = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: false,
  info: { Title: "NexOS AI — Investor Prospect Paper v2.1", Author: "NexOS AI" },
});
doc.pipe(fs.createWriteStream(OUT));

// ── Palette ──────────────────────────────────────────────────────────────────
const C = {
  page:   "#ffffff",
  navy:   "#0d1f3c",
  mid:    "#1e3a5f",
  lt:     "#2d5282",
  slate:  "#374151",
  muted:  "#6b7280",
  rule:   "#e5e7eb",
  tint:   "#f3f4f6",
  tintDk: "#e2e8f0",
  gold:   "#92400e",
  goldBg: "#fef3c7",
  white:  "#ffffff",
};

// ── Page geometry ─────────────────────────────────────────────────────────────
const PW  = 595.28;
const PH  = 841.89;
const L   = 56;           // left margin
const R   = 56;           // right margin
const CW  = PW - L - R;  // 483.28
const TOP = 50;           // body starts after header
const BOT = PH - 46;     // body ends before footer

// ── Page state ────────────────────────────────────────────────────────────────
let pageNum = 0;
let section = "";

function startPage(sec = "") {
  pageNum++;
  section = sec;
  doc.addPage({ size: "A4", margin: 0 });
  doc.rect(0, 0, PW, PH).fill(C.page);
  // header
  doc.fillColor(C.muted).fontSize(6.5).font("Helvetica")
    .text("NEXOS AI  ·  GROWTH EXECUTION INFRASTRUCTURE", L, 20, { lineBreak: false });
  if (sec) {
    doc.fillColor(C.muted).fontSize(6.5).font("Helvetica")
      .text(sec, 0, 20, { width: PW - R - 8, align: "right", lineBreak: false });
  }
  doc.moveTo(L, 34).lineTo(PW - R, 34).strokeColor(C.rule).lineWidth(0.5).stroke();
  doc.y = TOP;
}

function putFooter() {
  const y = PH - 30;
  doc.moveTo(L, y - 6).lineTo(PW - R, y - 6).strokeColor(C.rule).lineWidth(0.4).stroke();
  doc.fillColor(C.muted).fontSize(6.5).font("Helvetica")
    .text("NXS-2026-001  ·  Prospect Paper v2.1  ·  STRICTLY PRIVATE & CONFIDENTIAL", L, y);
  doc.fillColor(C.muted).fontSize(6.5).font("Helvetica")
    .text(String(pageNum), PW - R, y, { lineBreak: false, align: "right", width: PW - R - L });
}

/** Ensures `needed` pts remain before footer. If not, closes current page and opens a new one. */
function need(needed: number) {
  if (doc.y + needed > BOT) {
    putFooter();
    startPage(section);
  }
}

// ── Typography helpers ────────────────────────────────────────────────────────

function divider() {
  need(12);
  doc.moveDown(0.25);
  doc.moveTo(L, doc.y).lineTo(PW - R, doc.y).strokeColor(C.rule).lineWidth(0.4).stroke();
  doc.y += 8;
}

function sectionHeading(num: string, title: string, sec?: string) {
  need(48);
  doc.moveDown(0.6);
  const y = doc.y;
  doc.fillColor(C.lt).fontSize(7.5).font("Helvetica-Bold")
    .text(num, L, y, { lineBreak: false });
  doc.fillColor(C.navy).fontSize(13).font("Helvetica-Bold")
    .text(title, L + 28, y);
  doc.y += 2;
  doc.moveTo(L, doc.y).lineTo(PW - R, doc.y).strokeColor(C.lt).lineWidth(0.7).stroke();
  doc.y += 10;
  if (sec) section = sec;
}

function subHead(text: string) {
  need(22);
  doc.moveDown(0.4);
  doc.fillColor(C.mid).fontSize(9).font("Helvetica-Bold").text(text, L);
  doc.moveDown(0.15);
}

function para(text: string, indent = 0) {
  const w = CW - indent;
  // calc estimated height to trigger page break if needed
  doc.fontSize(8.5).font("Helvetica");
  const h = doc.heightOfString(text, { width: w }) + 6;
  need(h);
  doc.fillColor(C.slate).fontSize(8.5).font("Helvetica")
    .text(text, L + indent, doc.y, { width: w, lineGap: 2.5 });
}

function caption(text: string) {
  need(14);
  doc.fillColor(C.muted).fontSize(7).font("Helvetica")
    .text(text, L, doc.y, { width: CW, lineGap: 1.5 });
}

function callout(text: string) {
  doc.fontSize(8.5).font("Helvetica-BoldOblique");
  const textH = doc.heightOfString(text, { width: CW - 26 });
  const h = textH + 22;
  need(h + 10);
  doc.moveDown(0.4);
  const y = doc.y;
  doc.rect(L, y, CW, h).fill(C.tint);
  doc.rect(L, y, 3,  h).fill(C.lt);
  doc.fillColor(C.mid).fontSize(8.5).font("Helvetica-BoldOblique")
    .text(text, L + 12, y + 10, { width: CW - 22, lineGap: 2.5 });
  doc.y = y + h + 10;
}

function goldCallout(label: string, text: string) {
  doc.fontSize(8.5).font("Helvetica-Bold");
  const textH = doc.heightOfString(text, { width: CW - 26 });
  const h = textH + 30;
  need(h + 10);
  doc.moveDown(0.4);
  const y = doc.y;
  doc.rect(L, y, CW, h).fill(C.goldBg);
  doc.rect(L, y, 3,  h).fill(C.gold);
  doc.fillColor(C.gold).fontSize(7).font("Helvetica-Bold")
    .text(label, L + 12, y + 7, { lineBreak: false });
  doc.fillColor(C.navy).fontSize(8.5).font("Helvetica-Bold")
    .text(text, L + 12, y + 19, { width: CW - 22, lineGap: 2.5 });
  doc.y = y + h + 10;
}

// ── Table helpers (dynamic row heights) ───────────────────────────────────────

/** Calculate the height of a single table row given column texts and widths. */
function rowH(cols: string[], widths: number[], vPad = 9): number {
  let max = 0;
  cols.forEach((text, i) => {
    doc.fontSize(7.5).font("Helvetica");
    const h = doc.heightOfString(text, { width: widths[i] - 12 });
    if (h > max) max = h;
  });
  return Math.max(max + vPad * 2, 18);
}

function tableHeader(cols: string[], widths: number[]) {
  const h   = 20;
  const tot = widths.reduce((a, b) => a + b, 0);
  need(h);
  const y = doc.y;
  doc.rect(L, y, tot, h).fill(C.tintDk);
  let x = L;
  cols.forEach((c, i) => {
    doc.fillColor(C.mid).fontSize(7.5).font("Helvetica-Bold")
      .text(c, x + 6, y + 5, { width: widths[i] - 12, lineBreak: false, ellipsis: true });
    x += widths[i];
  });
  doc.moveTo(L, y + h).lineTo(L + tot, y + h).strokeColor(C.rule).lineWidth(0.3).stroke();
  doc.y = y + h;
}

function tableRow(cols: string[], widths: number[], shade = false, highlight = false) {
  const h   = rowH(cols, widths);
  const tot = widths.reduce((a, b) => a + b, 0);
  need(h);
  const y = doc.y;
  const bg = highlight ? C.goldBg : shade ? C.tint : C.white;
  doc.rect(L, y, tot, h).fill(bg);
  let x = L;
  cols.forEach((c, i) => {
    doc.fillColor(highlight ? C.gold : C.slate).fontSize(7.5).font("Helvetica")
      .text(c, x + 6, y + 9, { width: widths[i] - 12, lineGap: 2 });
    x += widths[i];
  });
  doc.moveTo(L, y + h).lineTo(L + tot, y + h).strokeColor(C.rule).lineWidth(0.2).stroke();
  doc.y = y + h;
}

// ── KPI card strip ────────────────────────────────────────────────────────────
function kpiCards(items: { label: string; value: string; sub?: string }[]) {
  const cardW = CW / items.length - 4;
  const cH    = 54;
  need(cH + 10);
  doc.moveDown(0.3);
  const y = doc.y;
  items.forEach((item, i) => {
    const cx = L + i * (cardW + 4 + (4 / items.length));
    doc.rect(cx, y, cardW, cH).fill(C.tint);
    doc.rect(cx, y, cardW, 2).fill(C.lt);
    doc.fillColor(C.muted).fontSize(6).font("Helvetica-Bold")
      .text(item.label, cx + 7, y + 8, { width: cardW - 14, lineBreak: false, ellipsis: true });
    doc.fillColor(C.navy).fontSize(14).font("Helvetica-Bold")
      .text(item.value, cx + 7, y + 20, { width: cardW - 14, lineBreak: false });
    if (item.sub) {
      doc.fillColor(C.muted).fontSize(6).font("Helvetica")
        .text(item.sub, cx + 7, y + 40, { width: cardW - 14, lineBreak: false });
    }
  });
  doc.y = y + cH + 10;
}

// ══════════════════════════════════════════════════════════════════════════════
//  COVER PAGE
// ══════════════════════════════════════════════════════════════════════════════
pageNum++;
doc.addPage({ size: "A4", margin: 0 });
doc.rect(0, 0, PW, PH).fill(C.page);

// Navy top bar
doc.rect(0, 0, PW, 170).fill(C.navy);
doc.fillColor("#ffffff20").fontSize(7).font("Helvetica-Bold")
  .text("STRICTLY PRIVATE & CONFIDENTIAL", L, 18, { lineBreak: false });

// Wordmark
doc.fillColor(C.white).fontSize(46).font("Helvetica-Bold").text("NEXOS AI", L, 40);
doc.fillColor("#94a3b8").fontSize(10).font("Helvetica-Bold")
  .text("GROWTH EXECUTION INFRASTRUCTURE", L, 94);
doc.moveTo(L, 114).lineTo(PW - R, 114).strokeColor("#ffffff20").lineWidth(0.5).stroke();
doc.fillColor(C.white).fontSize(14).font("Helvetica-Bold")
  .text("Investor & Early Adopter Prospect Paper", L, 122);
doc.fillColor("#94a3b8").fontSize(8).font("Helvetica")
  .text("Business plan  ·  White paper  ·  Investment thesis  ·  Economic model & strategic valuation", L, 143);

// Meta strip
doc.rect(0, 170, PW, 100).fill(C.tint);
const mW = CW / 3 - 8;
[
  { l: "DOCUMENTO", v: "NXS-2026-001",  s: "Junho de 2026" },
  { l: "VERSÃO",    v: "v 2.1",         s: "Solo only · Masterprint" },
  { l: "NÍVEL",     v: "Confidencial",  s: "Investidores convidados" },
].forEach((m, i) => {
  const cx = L + i * (mW + 12);
  doc.rect(cx, 178, mW, 52).fill(C.white);
  doc.rect(cx, 178, mW, 2).fill(C.lt);
  doc.fillColor(C.muted).fontSize(6.5).font("Helvetica-Bold").text(m.l, cx + 8, 186);
  doc.fillColor(C.navy).fontSize(12).font("Helvetica-Bold").text(m.v, cx + 8, 198);
  doc.fillColor(C.muted).fontSize(6).font("Helvetica").text(m.s, cx + 8, 216);
});

doc.y = 280;

// KPI strip (cover)
const kW = CW / 4 - 3;
[
  { label: "AGENTES DE IA",           value: "64",        sub: "7 departamentos" },
  { label: "PRODUTOS ECOSSISTEMA",    value: "5",         sub: "Funil completo" },
  { label: "TRILHAS DE RECEITA",      value: "3",         sub: "6 · 8 · 10 dígitos" },
  { label: "MISSÃO ANO 1",            value: "1.000.000", sub: "Clientes ativos" },
].forEach((s, i) => {
  const cx = L + i * (kW + 4);
  doc.rect(cx, doc.y, kW, 50).fill(C.tint);
  doc.rect(cx, doc.y, kW, 2).fill(C.lt);
  doc.fillColor(C.muted).fontSize(5.5).font("Helvetica-Bold").text(s.label, cx + 6, doc.y + 8, { width: kW - 12, lineBreak: false });
  doc.fillColor(C.navy).fontSize(14).font("Helvetica-Bold").text(s.value, cx + 6, doc.y + 20, { width: kW - 12, lineBreak: false });
  doc.fillColor(C.muted).fontSize(6).font("Helvetica").text(s.sub, cx + 6, doc.y + 38, { width: kW - 12, lineBreak: false });
});
doc.y += 62;

// TOC
doc.fillColor(C.muted).fontSize(7).font("Helvetica-Bold").text("ÍNDICE", L, doc.y);
doc.moveDown(0.35);
[
  ["—",     "Sumário Executivo",                                    "2"],
  ["01",    "Executive Investment Thesis",                           "3"],
  ["02",    "Market Context",                                        "3"],
  ["03",    "The Structural Market Problem",                         "4"],
  ["04",    "Product Definition & Ecosystem",                        "4"],
  ["05",    "Core Product Capabilities — 64 agentes",               "5"],
  ["05.10", "Masterprint Anti-Piracy System",                        "6"],
  ["06",    "Economic Model v2.1",                                   "7"],
  ["07",    "Year 1 Growth Mission — 1M customers",                  "8"],
  ["08",    "Revenue Projection",                                    "9"],
  ["09",    "Valuation Framework",                                  "10"],
  ["10",    "Path to Trillion · Infrastructure Multiples",          "11"],
  ["11",    "Strategic Moat (+ Masterprint Security)",              "12"],
  ["12",    "Investor Conclusion",                                  "13"],
].forEach(([n, t, p]) => {
  const ty = doc.y;
  doc.fillColor(C.lt).fontSize(7).font("Helvetica-Bold").text(n, L, ty, { lineBreak: false });
  doc.fillColor(C.slate).fontSize(7).font("Helvetica").text(t, L + 30, ty, { lineBreak: false });
  doc.fillColor(C.muted).fontSize(7).font("Helvetica")
    .text(p, PW - R - 14, ty, { lineBreak: false, align: "right", width: 14 });
  doc.moveTo(L + 30, ty + 10.5).lineTo(PW - R - 18, ty + 10.5)
    .strokeColor(C.rule).lineWidth(0.2).stroke();
  doc.y = ty + 13;
});

putFooter();

// ══════════════════════════════════════════════════════════════════════════════
//  P2 — AVISO LEGAL  +  SUMÁRIO EXECUTIVO
// ══════════════════════════════════════════════════════════════════════════════
startPage("AVISO LEGAL  ·  SUMÁRIO EXECUTIVO");

sectionHeading("—", "Aviso Legal");
para("Este documento é fornecido em caráter estritamente confidencial, exclusivamente para fins de avaliação por investidores qualificados e early adopters convidados da NexOS AI. Sua reprodução, distribuição ou divulgação, total ou parcial, a terceiros não autorizados é vedada sem consentimento prévio por escrito.");
doc.moveDown(0.4);
para("As projeções de receita, cenários de valuation e estimativas de mercado têm natureza prospectiva e ilustrativa. Não constituem garantia de resultados futuros, recomendação de investimento ou oferta de venda de valores mobiliários. Resultados reais podem diferir materialmente em função de dinâmica competitiva, capacidade de execução, regulação e condições macroeconômicas.");
doc.moveDown(0.4);
para("Ao prosseguir com a leitura, o destinatário concorda em tratar o conteúdo como informação confidencial nos termos de eventual NDA firmado com a NexOS AI.");

sectionHeading("—", "Sumário Executivo");
subHead("Uma tese de infraestrutura, não de ferramenta");
para("NexOS AI transforma intenção empresarial em execução comercial completa — da ideia ao produto, da campanha à venda, do lead ao remarketing — substituindo a fragmentação do mercado de growth por uma operação integrada, auditável e automatizada por IA.");
doc.moveDown(0.4);
para("O mercado endereçável combina publicidade digital, MarTech, creator economy e automação de processos — mercados multibilionários em expansão acelerada. A tese central: se toda empresa precisa vender, crescer, aparecer, converter ou influenciar, então toda empresa precisa de uma infraestrutura de crescimento. NexOS AI é essa infraestrutura.");
doc.moveDown(0.5);
kpiCards([
  { label: "POTENCIAL ECONÔMICO ANUALIZADO — ANO 1", value: "R$ 17B+", sub: "Aquisição + taxas + run-rate créditos + Academy" },
  { label: "ARR ANUALIZADO DE CRÉDITOS (1M CLIENTES)", value: "R$ 12B", sub: "Consumo médio R$1.000/mês" },
  { label: "VALUATION — EXPANSÃO GLOBAL", value: "US$ 3T–6T", sub: "50–100M clientes ativos" },
]);
goldCallout("TESE CENTRAL",
  "A pergunta correta não é 'quanto vale uma ferramenta de marketing?'. A pergunta é: quanto vale a infraestrutura que torna o crescimento empresarial executável, auditável, escalável e acessível para qualquer pessoa ou empresa?");

putFooter();

// ══════════════════════════════════════════════════════════════════════════════
//  P3 — THESIS  +  MARKET CONTEXT
// ══════════════════════════════════════════════════════════════════════════════
startPage("01–02  INVESTMENT THESIS  ·  MARKET CONTEXT");

sectionHeading("01", "Executive Investment Thesis");
para("NexOS AI não é uma ferramenta de marketing. NexOS AI é uma infraestrutura operacional de crescimento. A plataforma transforma intenção empresarial em execução comercial completa:");
callout("ideia → produto → oferta → campanha → criativos → vídeos → anúncios → audiência → leads → aquecimento → carrinho → vendas → remarketing → aprendizado → próxima campanha");
para("O valor do NexOS não está em gerar textos, imagens ou páginas. O valor está em executar crescimento. O mercado atual é fragmentado — empresas coordenam copywriters, designers, editores, estrategistas, gestores de tráfego, analistas, agências, ferramentas de CRM, SEO, automação, funis e vídeo. O NexOS substitui essa fragmentação por uma operação integrada, auditável e automatizada.");
goldCallout("TESE CENTRAL", "Se toda empresa precisa vender, crescer, aparecer, converter ou influenciar, então toda empresa precisa de uma infraestrutura de crescimento. NexOS AI é essa infraestrutura.");

sectionHeading("02", "Market Context");
para("O NexOS atua na interseção de mercados gigantescos. Aquisição de atenção já é uma das maiores linhas de gasto empresarial do mundo, enquanto empresas migram aceleradamente para infraestrutura de marketing, personalização e automação.");
doc.moveDown(0.4);
tableHeader(["Mercado", "Tamanho atual", "Projeção"], [213, 130, 140]);
tableRow(["Advertising (global)",           "—",                "~US$ 1,26T (2026)"], [213, 130, 140]);
tableRow(["Digital Advertising",            "US$ 567,9B (2025)", "US$ 1,69T (2033)"],  [213, 130, 140], true);
tableRow(["MarTech",                        "US$ 551,9B (2025)", "US$ 2,38T (2033)"],  [213, 130, 140]);
tableRow(["Creator Economy",               "—",                "~US$ 480B (2027)"],   [213, 130, 140], true);
tableRow(["Intelligent Process Automation", "US$ 14,55B (2024)", "US$ 44,74B (2030)"], [213, 130, 140]);
doc.moveDown(0.3);
caption("Fontes: estimativas consolidadas — Advertising, MarTech, Creator Economy e Automação de Processos.");
doc.moveDown(0.4);
para("O NexOS captura valor em todos esses mercados simultaneamente: MarTech · Digital Advertising · Creator Economy · AI Agents · Business Automation · Sales Enablement · Video Production · Funnel Infrastructure · Campaign Execution · Regional Growth & Affiliate Distribution.");

putFooter();

// ══════════════════════════════════════════════════════════════════════════════
//  P4 — STRUCTURAL PROBLEM  +  PRODUCT ECOSYSTEM
// ══════════════════════════════════════════════════════════════════════════════
startPage("03–04  STRUCTURAL PROBLEM  ·  PRODUCT ECOSYSTEM");

sectionHeading("03", "The Structural Market Problem");
para("O problema global não é falta de ferramentas. O problema é que as ferramentas não executam a cadeia inteira.");
doc.moveDown(0.4);

[
  ["SEO",              "Gera tráfego, mas não cria produto, oferta, vídeos, lançamento, carrinho ou remarketing."],
  ["CRM",              "Organiza contatos, mas não cria os contatos, não aquece audiência, não cria desejo, não fecha vendas."],
  ["Landing builders", "Criam páginas, mas não sabem qual oferta converte, qual público atingir ou qual timing aplicar."],
  ["AI content tools", "Criam textos e vídeos, mas dependem de alguém para estratégia, campanha, distribuição e execução."],
  ["Agências",         "Executam, mas são caras, lentas, limitadas por agenda, capacidade e custo proporcional ao escopo."],
].forEach(([t, d]) => {
  doc.fontSize(7.5).font("Helvetica");
  const textH = doc.heightOfString(d, { width: CW - 24 });
  const bH = textH + 24;
  need(bH + 6);
  const y = doc.y;
  doc.rect(L, y, CW, bH).fill(C.tint);
  doc.rect(L, y, 2, bH).fill(C.lt);
  doc.fillColor(C.navy).fontSize(8.5).font("Helvetica-Bold").text(t, L + 10, y + 8, { lineBreak: false });
  doc.fillColor(C.slate).fontSize(7.5).font("Helvetica").text(d, L + 10, y + 20, { width: CW - 22, lineGap: 2 });
  doc.y = y + bH + 5;
});
goldCallout("NEXOS", "NexOS elimina a fragmentação. O NexOS não pergunta apenas 'o que você quer criar?' — O que você quer conquistar? E executa a operação.");

sectionHeading("04", "Product Definition & Ecosystem — v2.1");
para("NexOS AI opera como um AI-Powered Growth Execution Operating System e se posiciona no mercado através de um ecossistema de produtos em funil ascendente:");
doc.moveDown(0.4);

tableHeader(["Produto", "Regular", "Lançamento", "Modelo de acesso"], [168, 82, 90, 143]);
tableRow(["Isca — Os 7 Erros Fatais que Matam Lançamentos", "Grátis",   "Grátis",   "PDF via WhatsApp + grupo WhatsApp/Telegram"], [168, 82, 90, 143]);
tableRow(["Tripwire — Primeiros R$10K em 30 Dias",           "R$ 290",   "R$ 97",    "Mini-guia digital"],                          [168, 82, 90, 143], true);
tableRow(["NexOS AI Solo",                                   "R$ 15.990","R$ 3.990", "Acesso vitalício · sem mensalidade · 3 campanhas · 900 créditos incluídos"], [168, 82, 90, 143]);
tableRow(["NexOS Academy",                                   "R$ 3.900", "R$ 2.500", "Metodologia completa · incluso para clientes NexOS AI"], [168, 82, 90, 143], true);
tableRow(["NexOS Connect — Guia de APIs & Integrações",      "R$ 297",   "R$ 197",   "Guia técnico standalone"],                    [168, 82, 90, 143]);

doc.moveDown(0.4);
para("Taxa por execução: o primeiro lançamento é gratuito. A partir do 2.º lançamento executado na plataforma → R$ 497 por lançamento (pay per execution) — alinhando a receita do NexOS ao crescimento real do cliente.");

putFooter();

// ══════════════════════════════════════════════════════════════════════════════
//  P5 — CORE CAPABILITIES
// ══════════════════════════════════════════════════════════════════════════════
startPage("05  CORE PRODUCT CAPABILITIES");

sectionHeading("05", "Core Product Capabilities");

subHead("5.1 — NexOS Command Agent — 64 agentes · 7 departamentos");
para("O NexOS opera com um Diretor Geral de IA que orquestra 64 agentes especializados. O usuário não escolhe agentes — o sistema convoca cada agente no momento correto.");
doc.moveDown(0.35);

tableHeader(["Departamento", "Agentes especializados"], [175, 308]);
tableRow(["Estratégia & Planejamento", "Strategy · Command · Profile Builder · Market Intel · Offer Architect · Pricing Psychologist"],                   [175, 308]);
tableRow(["Conteúdo & Copy",           "Copywriter · Creative Director · VSL Writer · CPL · Social Media · Ad Copy · Landing Page · Hook Factory"],      [175, 308], true);
tableRow(["Audiência & Tráfego",       "Targeting · Media Buyer · Organic Traffic · A/B Test Designer · Compliance Officer"],                            [175, 308]);
tableRow(["Vídeo & Criativos",         "Video Director · Creative Concept · Ad Critic · Stories Sequence · Video Hook"],                                 [175, 308], true);
tableRow(["Analytics & Otimização",    "Analytics · Optimization · Launch Debriefing · Scarcity Engineer"],                                              [175, 308]);
tableRow(["Automação & Vendas",        "Sales Warmer · Sales Closer · Sales Desire · Sales Objection · Sales Consultant · Affiliate · Reengagement"],    [175, 308], true);
tableRow(["Mentalidade & Crescimento", "Mental Frequency Coach · Identity Architect · Obstinacy Trainer · Creator Growth"],                              [175, 308]);

subHead("5.2 — Live Production Display");
para("Frontend exibe produção em tempo real via Socket.io — o usuário vê estratégia sendo escrita, criativos sendo criados e decisões sendo registradas. Tudo vira log auditável: cria percepção de valor, confiança e prova operacional.");

subHead("5.3 — Video Production Engine");
tableHeader(["Modo", "Execução"], [110, 373]);
tableRow(["Com aparição", "Roteiro, cenário, enquadramento, iluminação, gravação orientada, corte automático, legendas, B-roll, trilha e versões."], [110, 373]);
tableRow(["Sem aparição", "Avatar digital, voz clonada, apresentador sintético, motion graphics e narração automatizada por IA."],                   [110, 373], true);
tableRow(["Híbrido",      "Imagem real, avatar parcial, voz clonada, cenas complementares e edição final por IA."],                                [110, 373]);

subHead("5.4–5.5 — Launch Engine · Trilhas de Receita");
callout("captação → aquecimento → autoridade → desejo → oferta → escassez → abertura de carrinho → fechamento → remarketing → prova social → próximo ciclo");
tableHeader(["Trilha", "Meta em 7 dias", "Stack de agentes"], [100, 135, 248]);
tableRow(["6 Dígitos",  "R$ 100K – R$ 999K",  "Strategy + Launch + Copy + Traffic (stack completo)"],          [100, 135, 248]);
tableRow(["8 Dígitos",  "R$ 10M – R$ 99M",    "Full stack: todos os agentes + tracking avançado"],             [100, 135, 248], true);
tableRow(["10 Dígitos", "R$ 100M+",           "Infraestrutura completa + agency track + white-label mode"],    [100, 135, 248]);

subHead("5.6 — Self-Proof Engine  ·  5.7 — Paid Traffic Intelligence  ·  5.8 — Adaptive Interface");
para("Self-Proof: o maior case do NexOS é ele próprio — se lança, documenta seu próprio lançamento e grava suas próprias telas. O lead não assiste uma promessa, ele vive a demonstração.");
doc.moveDown(0.3);
para("Tráfego pago: agentes atuam sobre sinais de entrega, otimização de lance, janelas de aprendizado, segmentação dinâmica e comportamento de leilão. Interface: modo Fundador (guiado) e modo Arquiteto (técnico) com switch a qualquer momento.");

putFooter();

// ══════════════════════════════════════════════════════════════════════════════
//  P6 — MASTERPRINT
// ══════════════════════════════════════════════════════════════════════════════
startPage("05.10  MASTERPRINT ANTI-PIRACY SYSTEM");

sectionHeading("05.10", "Masterprint Anti-Piracy System — NOVO · v2.1");

need(28);
const bannerY = doc.y;
doc.rect(L, bannerY, CW, 26).fill(C.tintDk);
doc.rect(L, bannerY, 3,  26).fill(C.gold);
doc.fillColor(C.navy).fontSize(9.5).font("Helvetica-Bold")
  .text("Proteção forense nativa de propriedade intelectual gerada na plataforma", L + 12, bannerY + 9, { lineBreak: false });
doc.y = bannerY + 34;

para("O NexOS protege toda propriedade intelectual gerada na plataforma com rastreamento forense de documentos. Cada PDF, guia, roteiro, estratégia ou material exportado recebe um fingerprint único e invisível — permitindo identificação do vazador em caso de distribuição não autorizada.");
doc.moveDown(0.5);

tableHeader(["Componente", "Descrição completa"], [158, 325]);
tableRow(["Fingerprint único",          "Código NXS-XXXX-XXXX embutido por download — invisível ao usuário final, único por titular e por documento gerado."],     [158, 325]);
tableRow(["Cadeia de custódia",         "Registro completo: userId · email · nome · IP de origem · user-agent · workspace · campanha · timestamp de geração."],   [158, 325], true);
tableRow(["Admin lookup",              "Código extraído de arquivo vazado → identificação imediata do titular original sem ambiguidade."],                         [158, 325]);
tableRow(["Cross-referência econômica","CPF via Asaas + device fingerprint + padrão de IP → identifica culpado mesmo com cadastro fraudulento ou VPN."],          [158, 325], true);
tableRow(["Dossiê jurídico",           "Exportação estruturada para notificação legal conforme LGPD Art. 42 e Marco Civil da Internet."],                         [158, 325]);
tableRow(["Alertas automáticos",       "Sistema detecta mesmo documento circulando em múltiplos IPs distintos e notifica o admin em tempo real."],                 [158, 325], true);

goldCallout("DIFERENCIAL COMPETITIVO",
  "Nenhuma plataforma de SaaS de marketing no Brasil oferece rastreabilidade forense nativa de documentos gerados. O Masterprint cria uma barreira de proteção de propriedade intelectual sem precedentes no setor.");

subHead("5.9 — Landing Page, Domain & Hosting Engine");
para("O NexOS cria a landing page completa de cada campanha sem que o usuário precise desenvolver ou configurar nada manualmente. A plataforma auxilia na aquisição e hospedagem do domínio com integração nativa.");

divider();
subHead("Resumo de Capacidades — v2.1");
tableHeader(["Capability", "Status"], [350, 133]);
tableRow(["64 agentes de IA em 7 departamentos",               "Ativo"],              [350, 133]);
tableRow(["Live Production Display (Socket.io real-time)",     "Ativo"],              [350, 133], true);
tableRow(["Video Production Engine (3 modos)",                 "Ativo"],              [350, 133]);
tableRow(["Launch Engine — trilhas 6 / 8 / 10 dígitos",       "Ativo"],              [350, 133], true);
tableRow(["Adaptive Interface Fundador / Arquiteto",           "Ativo"],              [350, 133]);
tableRow(["Masterprint Anti-Piracy System",                    "Ativo — NOVO v2.1"],  [350, 133], false, true);
tableRow(["NexOS Connect — API Guide (standalone)",            "Em desenvolvimento"], [350, 133], true);

putFooter();

// ══════════════════════════════════════════════════════════════════════════════
//  P7 — ECONOMIC MODEL
// ══════════════════════════════════════════════════════════════════════════════
startPage("06  ECONOMIC MODEL  —  v2.1");

sectionHeading("06", "Economic Model — v2.1  (Solo only · Agency removida)");
para("Modelo baseado em aquisição única + consumo por uso. Sem mensalidade. Sem recorrência forçada. O cliente consome mais quando opera mais — alinhando a receita do NexOS ao crescimento real do cliente.");

subHead("Produto Principal — NexOS AI Solo · Ticket Único Vitalício");
tableHeader(["Item", "Valor"], [260, 223]);
tableRow(["Preço âncora (regular)",     "R$ 15.990"],  [260, 223]);
tableRow(["Preço de lançamento",        "R$ 3.990"],   [260, 223], true);
tableRow(["Campanhas incluídas",        "3 campanhas"],[260, 223]);
tableRow(["Créditos de IA incluídos",   "900 créditos (~2 lançamentos completos)"], [260, 223], true);
tableRow(["Modelo de acesso",           "Vitalício — sem mensalidade, sem renovação"], [260, 223]);
tableRow(["NexOS Academy (bônus)",      "Incluso para clientes NexOS AI — R$3.900 se vendido separado"], [260, 223], true);

subHead("Taxa de Execução — Pay per Execution");
need(44);
const pyY = doc.y;
doc.rect(L, pyY, CW, 40).fill(C.tint);
doc.rect(L, pyY, 3,  40).fill(C.gold);
doc.fillColor(C.mid).fontSize(9).font("Helvetica-Bold").text("Primeiro lançamento: GRATUITO", L + 12, pyY + 8);
doc.fillColor(C.slate).fontSize(8).font("Helvetica")
  .text("A partir do 2.º lançamento executado na plataforma → R$ 497 por lançamento.  Modelo pay-per-execution: a receita do NexOS só cresce quando o cliente executa.", L + 12, pyY + 22, { width: CW - 22, lineGap: 2 });
doc.y = pyY + 48;

subHead("Créditos de IA — Consumo por Uso · Preços v2.1");
tableHeader(["Pacote", "Créditos", "Preço", "Equivalente operacional", "Custo/cr"], [72, 68, 72, 200, 71]);
tableRow(["Boost",   "500 cr",   "R$ 85",  "~1 lançamento pequeno",                  "R$ 0,17"], [72, 68, 72, 200, 71]);
tableRow(["Starter", "1.500 cr", "R$ 239", "~3–4 lançamentos completos",             "R$ 0,16"], [72, 68, 72, 200, 71], true);
tableRow(["Pro",     "3.500 cr", "R$ 529", "~8–9 lançamentos completos",             "R$ 0,15"], [72, 68, 72, 200, 71]);
tableRow(["Elite",   "7.000 cr", "R$ 979", "~17–18 lançamentos — operações maiores", "R$ 0,14"], [72, 68, 72, 200, 71], true);

subHead("Receita pelo Ecossistema de Produtos");
tableHeader(["Produto", "Preço", "Função econômica", "Tipo"], [138, 75, 188, 82]);
tableRow(["Isca — Os 7 Erros Fatais",   "Grátis",   "Captura massiva de leads qualificados",              "Topo de funil"],  [138, 75, 188, 82]);
tableRow(["Tripwire — Primeiros R$10K", "R$ 97",    "Primeira transação · qualificação financeira do lead","Entrada no funil"],[138, 75, 188, 82], true);
tableRow(["NexOS AI Solo",              "R$ 3.990", "Aquisição principal — ticket único vitalício",        "Uma vez"],        [138, 75, 188, 82]);
tableRow(["NexOS Academy",              "R$ 2.500", "Metodologia completa (incluso / vendido separado)",   "Uma vez"],        [138, 75, 188, 82], true);
tableRow(["Taxa de lançamento",         "R$ 497",   "Pay-per-execution (2.º lançamento+)",                 "Por uso"],        [138, 75, 188, 82]);
tableRow(["Créditos de IA",             "R$85–979", "Consumo recorrente por uso operacional",              "Contínuo"],       [138, 75, 188, 82], true);
tableRow(["NexOS Connect",              "R$ 197",   "Guia técnico de APIs e integrações · standalone",     "Entry-level"],    [138, 75, 188, 82]);

putFooter();

// ══════════════════════════════════════════════════════════════════════════════
//  P8 — GROWTH MISSION
// ══════════════════════════════════════════════════════════════════════════════
startPage("07  YEAR 1 GROWTH MISSION");

sectionHeading("07", "Year 1 Growth Mission");

need(56);
const mY = doc.y;
doc.rect(L, mY, CW, 52).fill(C.navy);
doc.fillColor(C.white).fontSize(32).font("Helvetica-Bold")
  .text("1.000.000", L, mY + 8, { width: CW, align: "center" });
doc.fillColor("#94a3b8").fontSize(9).font("Helvetica")
  .text("CLIENTES ATIVOS EM 12 MESES — MISSÃO INTERNA", L, mY + 42, { width: CW, align: "center" });
doc.y = mY + 62;

doc.moveDown(0.4);
para("Estratégia: 52 semanas, 52 regiões estratégicas do Brasil, 52 públicos prioritários e 52 ciclos de lançamento — combinando campanhas próprias acumulativas, afiliados regionais, prova social crescente e reinjeção de capital.");

subHead("Funil de Aquisição — Do Lead ao Cliente Ativo");
tableHeader(["Estágio", "Produto", "Objetivo"], [120, 168, 195]);
tableRow(["Topo de funil",           "Isca — Os 7 Erros Fatais",     "Volume massivo de leads qualificados"],    [120, 168, 195]);
tableRow(["Qualificação financeira", "Tripwire R$97",                 "Filtrar leads prontos para comprar"],      [120, 168, 195], true);
tableRow(["Conversão principal",     "NexOS AI Solo R$3.990",        "Aquisição vitalícia — receita central"],   [120, 168, 195]);
tableRow(["Upsell metodologia",      "NexOS Academy R$2.500",        "Profundidade + LTV por cliente"],          [120, 168, 195], true);
tableRow(["Consumo recorrente",      "Créditos + taxa de lançamento", "Receita contínua por uso operacional"],   [120, 168, 195]);

subHead("Por que só o NexOS consegue executar isso em escala");
need(50);
const dfY = doc.y;
doc.rect(L, dfY, CW, 46).fill(C.tint);
doc.rect(L, dfY, 3,  46).fill(C.lt);
doc.fillColor(C.navy).fontSize(8.5).font("Helvetica-Bold")
  .text("Sem expansão proporcional de time. Sem contratar agências regionais. Sem depender de 52 equipes.", L + 12, dfY + 8, { width: CW - 22 });
doc.fillColor(C.slate).fontSize(8).font("Helvetica")
  .text("O NexOS executa essa amplitude com baixo atrito operacional porque o produto é a própria máquina de execução — cada lançamento feedbacka para o próximo, o contexto acumula e a velocidade aumenta.", L + 12, dfY + 26, { width: CW - 22, lineGap: 2 });
doc.y = dfY + 54;

subHead("Multiplicadores de Crescimento");
tableHeader(["Multiplicador", "Mecanismo", "Impacto"], [148, 190, 145]);
tableRow(["Auto-lançamento",        "NexOS se lança com NexOS — case público documentado",  "Prova de produto como marketing"],     [148, 190, 145]);
tableRow(["Afiliados regionais",    "Comissão por indicação validada por CPF/pagamento",     "Força de vendas sem custo fixo"],      [148, 190, 145], true);
tableRow(["Prova social acumulativa","Casos reais documentados dentro da plataforma",         "Reduz custo de conversão"],            [148, 190, 145]);
tableRow(["Reinjeção de capital",   "Receita anterior financia a semana seguinte",            "Crescimento composto semanal"],        [148, 190, 145], true);

putFooter();

// ══════════════════════════════════════════════════════════════════════════════
//  P9 — REVENUE PROJECTION
// ══════════════════════════════════════════════════════════════════════════════
startPage("08  REVENUE PROJECTION — 1 MILLION CUSTOMERS");

sectionHeading("08", "Revenue Projection — 1 Million Customers (Solo only)");

subHead("8.1 — Receita de aquisição (ticket único)");
tableHeader(["Clientes", "Ticket (lançamento)", "Receita total de aquisição"], [130, 180, 173]);
tableRow(["1.000.000", "R$ 3.990 (Solo — cenário base)", "R$ 3,99 bilhões"], [130, 180, 173]);

subHead("8.2 — Taxa por lançamento (pay-per-execution)");
para("A partir do 2.º lançamento, cada execução gera R$497. Média estimada de 4 lançamentos/ano por cliente (descontando o primeiro gratuito = 3 pagos):");
tableHeader(["Clientes ativos", "Execuções/ano (pagas)", "Receita anual por taxa"], [152, 165, 166]);
tableRow(["1.000.000", "3 lançamentos × R$ 497", "R$ 1,49 bilhão/ano"], [152, 165, 166]);

subHead("8.3 — Receita recorrente de créditos de IA");
tableHeader(["Clientes ativos", "Consumo médio/mês", "Receita mensal", "ARR (run-rate)"], [122, 110, 120, 131]);
tableRow(["1.000.000", "R$ 1.000", "R$ 1 bilhão", "R$ 12 bilhões"], [122, 110, 120, 131]);

subHead("8.4 — Uplift do ecossistema");
tableHeader(["Produto adicional", "Penetração estimada", "Receita adicional"], [188, 148, 147]);
tableRow(["NexOS Academy R$2.500", "40% dos clientes NexOS AI", "R$ 1B sobre 1M clientes"], [188, 148, 147]);
tableRow(["NexOS Connect R$197",   "15% da base ativa",         "R$ 29,55M"],               [188, 148, 147], true);

subHead("8.5 — Potencial Econômico Anualizado Consolidado");
need(78);
const rY = doc.y;
doc.rect(L, rY, CW, 64).fill(C.tint);
doc.rect(L, rY, 2,  64).fill(C.lt);
const items = [
  { l: "Receita de aquisição — 1M clientes Solo R$3.990",       v: "R$ 3,99B" },
  { l: "Taxa de lançamento — 3 paid/ano × 1M clientes",         v: "R$ 1,49B" },
  { l: "Run-rate anualizado de créditos (R$1k/mês × 1M)",       v: "R$ 12B"   },
  { l: "NexOS Academy (40% penetração × 1M clientes)",          v: "+ R$ 1B"  },
];
items.forEach(({ l, v }, i) => {
  const ry = rY + 8 + i * 14;
  doc.fillColor(C.slate).fontSize(8).font("Helvetica").text(l, L + 10, ry, { lineBreak: false });
  doc.fillColor(C.mid).fontSize(8).font("Helvetica-Bold").text(v, PW - R - 58, ry, { lineBreak: false });
});
doc.y = rY + 74;
need(28);
const ttY = doc.y;
doc.rect(L, ttY, CW, 26).fill(C.navy);
doc.fillColor(C.white).fontSize(9).font("Helvetica-Bold")
  .text("POTENCIAL ECONÔMICO ANUALIZADO — ANO 1", L + 10, ttY + 8, { lineBreak: false });
doc.fillColor(C.white).fontSize(14).font("Helvetica-Bold")
  .text("R$ 17B+", PW - R - 60, ttY + 6, { lineBreak: false });
doc.y = ttY + 34;

doc.moveDown(0.4);
caption("Nota: valores refletem o run-rate anualizado ao atingir 1M de clientes ativos. Clientes que entram ao longo do ano contribuem proporcionalmente ao seu mês de entrada.");

putFooter();

// ══════════════════════════════════════════════════════════════════════════════
//  P10 — VALUATION FRAMEWORK
// ══════════════════════════════════════════════════════════════════════════════
startPage("09  VALUATION FRAMEWORK");

sectionHeading("09", "Valuation Framework");
para("Valuation depende de como o mercado classifica o NexOS. Apresentamos três classificações distintas.");

subHead("9.1 — Como SaaS tradicional");
para("O BVP Nasdaq Emerging Cloud Index mostra múltiplo médio de ~6,3x ARR. Aplicando múltiplos conservadores ao run-rate de R$12B em créditos:");
tableHeader(["Classificação", "Múltiplo", "Valuation"], [220, 100, 163]);
tableRow(["SaaS conservador", "6× ARR",  "R$ 72B"],  [220, 100, 163]);
tableRow(["SaaS agressivo",   "10× ARR", "R$ 120B"], [220, 100, 163], true);

subHead("9.2 — Como AI-native high-growth platform");
para("Para uma plataforma AI-native com crescimento extremo, consumo recorrente, retenção e dominância de categoria:");
tableHeader(["Múltiplo", "Base ARR", "Valuation resultante"], [100, 180, 203]);
tableRow(["15×", "R$ 12B ARR", "R$ 180B"], [100, 180, 203]);
tableRow(["25×", "R$ 12B ARR", "R$ 300B"], [100, 180, 203], true);
tableRow(["40×", "R$ 12B ARR", "R$ 480B"], [100, 180, 203]);

subHead("9.3 — Como Growth Infrastructure (tese máxima)");
para("Se o mercado classifica NexOS como infraestrutura de crescimento empresarial, a avaliação passa a ser feita em função da dependência econômica criada e da impossibilidade de substituição:");
tableHeader(["Cenário estratégico", "Valuation"], [250, 233]);
tableRow(["R$ 12B ARR × 50×",  "R$ 600B"], [250, 233]);
tableRow(["R$ 12B ARR × 75×",  "R$ 900B"], [250, 233], true);
tableRow(["R$ 12B ARR × 100×", "R$ 1,2T"], [250, 233]);
goldCallout("PREMISSA ESTRUTURAL",
  "Esse valuation exige que o mercado veja o NexOS como camada operacional indispensável — não como software de marketing. A premissa é execução, adoção massiva e dominância de categoria.");

subHead("9.4 — Base expandida com ecossistema completo (~R$ 14,5B ARR)");
para("Incluindo taxas de lançamento (R$1,49B) e Academy (R$1B), a base de ARR sobe para ~R$14,5B, expandindo todos os cenários em aproximadamente 20%:");
tableHeader(["Múltiplo", "Base expandida", "Valuation expandido"], [100, 220, 163]);
tableRow(["25×",  "R$ 14,5B ARR", "R$ 362B"],  [100, 220, 163]);
tableRow(["50×",  "R$ 14,5B ARR", "R$ 725B"],  [100, 220, 163], true);
tableRow(["100×", "R$ 14,5B ARR", "R$ 1,45T"], [100, 220, 163]);

putFooter();

// ══════════════════════════════════════════════════════════════════════════════
//  P11 — PATH TO TRILLION  +  INFRASTRUCTURE MULTIPLES
// ══════════════════════════════════════════════════════════════════════════════
startPage("10  PATH TO TRILLION  ·  INFRASTRUCTURE MULTIPLES");

sectionHeading("10", "Path to Trillion-Dollar Valuation");
para("A tese de trilhões não vem de 1 milhão de clientes isoladamente — 1 milhão de clientes é a prova de categoria. A tese de trilhões vem quando o mercado projeta que o NexOS será infraestrutura global.");

subHead("10.1 — Cenário de expansão global: 50M clientes");
caption("PREMISSA: 50M clientes ativos globais · R$1.000/mês consumo médio · ≈ US$120B ARR (câmbio ilustrativo R$5/USD)");
tableHeader(["Múltiplo sobre ARR", "Valuation resultante"], [250, 233]);
tableRow(["US$ 120B ARR × 25×", "US$ 3T"],   [250, 233]);
tableRow(["US$ 120B ARR × 40×", "US$ 4,8T"], [250, 233], true);

subHead("10.2 — Cenário de 100M clientes globais");
caption("100M clientes × R$1.000/mês × 12 = R$1,2T/ano ≈ US$240B ARR");
tableHeader(["Múltiplo sobre ARR", "Valuation resultante"], [250, 233]);
tableRow(["US$ 240B ARR × 20×", "US$ 4,8T"], [250, 233]);
tableRow(["US$ 240B ARR × 25×", "US$ 6T"],   [250, 233], true);

goldCallout("CONCLUSÃO MATEMÁTICA",
  "A marca de US$5T deixa de ser uma afirmação emocional e passa a ser uma consequência matemática de base global massiva, consumo recorrente, infraestrutura indispensável e múltiplos de plataforma dominante.");

subHead("Por que NexOS pode comandar múltiplos de infraestrutura");
para("Microsoft tornou-se indispensável porque o computador pessoal precisava de um sistema operacional. AWS tornou-se indispensável porque empresas precisavam de computação escalável. Stripe tornou-se indispensável porque negócios digitais precisavam processar pagamentos.");
doc.moveDown(0.4);
para("NexOS torna-se indispensável porque todo agente econômico precisa crescer. Todo mundo vende, influencia, depende de clientes, de audiência, de autoridade, de conversão. O NexOS transforma isso em operação sistematizada.");
doc.moveDown(0.4);
para("O mercado não adotará NexOS apenas porque ele é inteligente. O mercado adotará porque fazer sem NexOS será mais lento, mais caro, mais confuso e menos eficiente.");
callout("Assim como qualquer pessoa pode escrever sem Word, qualquer empresa pode tentar crescer sem NexOS. Mas quando a alternativa é mais lenta, mais cara e mais frágil, o padrão de mercado muda.");

putFooter();

// ══════════════════════════════════════════════════════════════════════════════
//  P12 — STRATEGIC MOAT
// ══════════════════════════════════════════════════════════════════════════════
startPage("11  STRATEGIC MOAT");

sectionHeading("11", "Strategic Moat");

const moats = [
  { n: "11.1", t: "Data Moat",      d: "Cada campanha gera dados proprietários: criativos vencedores, públicos vencedores, objeções, timing, regiões, CPL, CPA, ROAS, conversão e retenção. Esses dados não existem em nenhuma outra plataforma." },
  { n: "11.2", t: "Execution Moat", d: "Ferramentas geram ativos. NexOS executa. Execução cria dependência operacional — quanto mais o cliente executa, mais difícil é migrar sem perder todo o contexto acumulado." },
  { n: "11.3", t: "Workflow Moat",  d: "Quanto mais o cliente usa, mais o NexOS entende: produto, marca, público, campanhas, resultado, tom, oferta e histórico. Esse contexto acumulado é intransferível para qualquer ferramenta concorrente." },
  { n: "11.4", t: "Proof Moat",     d: "O auto-lançamento documentado vira case central. O lead não assiste uma promessa — ele vive a demonstração. Um loop de prova social que se auto-alimenta com cada novo lançamento." },
  { n: "11.5", t: "Category Moat",  d: "NexOS cria uma categoria: Growth Execution Infrastructure. Quem cria a categoria tende a capturar percepção de liderança permanente nela — independente de quem entre depois no mercado." },
];

moats.forEach((m) => {
  doc.fontSize(7.5).font("Helvetica");
  const descH = doc.heightOfString(m.d, { width: CW - 22 });
  const bH    = descH + 34;
  need(bH + 6);
  const y = doc.y;
  doc.rect(L, y, CW, bH).fill(C.tint);
  doc.rect(L, y, 2,  bH).fill(C.lt);
  doc.fillColor(C.muted).fontSize(7).font("Helvetica-Bold").text(m.n, L + 10, y + 8, { lineBreak: false });
  doc.fillColor(C.mid).fontSize(9).font("Helvetica-Bold").text(m.t, L + 10, y + 20);
  doc.fillColor(C.slate).fontSize(7.5).font("Helvetica").text(m.d, L + 10, doc.y + 2, { width: CW - 22, lineGap: 2 });
  doc.y = y + bH + 6;
});

// 11.6 Masterprint — gold border
doc.fontSize(8).font("Helvetica");
const mpDescH = doc.heightOfString(
  "Toda saída da plataforma — PDFs, guias, roteiros, estratégias e materiais exportados — carrega rastreabilidade forense nativa. Fingerprint único por usuário + cadeia de custódia completa + cruzamento econômico via CPF/Asaas/device/IP + exportação de dossiê jurídico. Nenhuma plataforma de SaaS de marketing no Brasil oferece isso. O Masterprint cria uma barreira de proteção de IP sem precedentes no setor.",
  { width: CW - 22 }
);
const mpH = mpDescH + 36;
need(mpH + 8);
doc.moveDown(0.3);
const mpY = doc.y;
doc.rect(L, mpY, CW, mpH).fill(C.goldBg);
doc.rect(L, mpY, CW, 1).fill(C.gold);
doc.rect(L, mpY, 3,  mpH).fill(C.gold);
doc.fillColor(C.muted).fontSize(7).font("Helvetica-Bold").text("11.6 — NOVO · v2.1", L + 10, mpY + 8, { lineBreak: false });
doc.fillColor(C.gold).fontSize(10).font("Helvetica-Bold")
  .text("Proprietary Content Security Moat — Masterprint", L + 10, mpY + 20);
doc.fillColor(C.navy).fontSize(8).font("Helvetica")
  .text("Toda saída da plataforma — PDFs, guias, roteiros, estratégias e materiais exportados — carrega rastreabilidade forense nativa. Fingerprint único por usuário + cadeia de custódia completa + cruzamento econômico via CPF/Asaas/device/IP + exportação de dossiê jurídico. Nenhuma plataforma de SaaS de marketing no Brasil oferece isso. O Masterprint cria uma barreira de proteção de IP sem precedentes no setor.",
  L + 10, mpY + 36, { width: CW - 18, lineGap: 2 });
doc.y = mpY + mpH + 8;

putFooter();

// ══════════════════════════════════════════════════════════════════════════════
//  P13 — INVESTOR CONCLUSION
// ══════════════════════════════════════════════════════════════════════════════
startPage("12  INVESTOR CONCLUSION");

sectionHeading("12", "Investor Conclusion");
para("NexOS AI é uma tese de infraestrutura. Não é uma tese de ferramenta.");
doc.moveDown(0.4);
para("O mercado não precisa de mais uma IA para escrever texto. O mercado precisa de uma camada que execute crescimento. NexOS entrega:");
callout("planejamento · produção · direção · criativos · vídeos · tráfego · funil · segmentação · aquecimento · venda · remarketing · auditoria · aprendizado · escala");
para("O primeiro grande case é o próprio NexOS: uma plataforma que se lança, se vende, documenta sua própria execução e transforma esse histórico em prova pública.");

subHead("Por que a v2.1 é uma tese mais sólida:");
doc.moveDown(0.2);

[
  ["Ecossistema de produtos em funil",  "Da isca gratuita ao guia técnico. Múltiplas portas de entrada, múltiplas fontes de receita sem aumentar o custo de aquisição."],
  ["Modelo pay-per-execution",          "R$497/lançamento (2.º+) alinha a receita do NexOS ao resultado real do cliente — não é taxa arbitrária, é participação na execução."],
  ["Masterprint Anti-Piracy",           "Proteção forense de IP nativa — diferencial técnico sem precedente no setor de SaaS de marketing no Brasil (Moat 11.6)."],
  ["64 agentes especializados",         "7 departamentos completos — de mentalidade a vendas. Não é um chatbot; é uma equipe de especialistas de IA convocada no momento certo."],
  ["Trilhas 6 / 8 / 10 dígitos",        "Produto calibrado por meta de receita — não por tamanho de empresa. Qualquer pessoa pode usar, com qualquer objetivo."],
  ["Academy como produto autônomo",     "Metodologia vendida separadamente por R$3.900 — expansão de LTV sem custo marginal adicional de entrega."],
].forEach(([title, desc]) => {
  doc.fontSize(7.5).font("Helvetica");
  const descH = doc.heightOfString(desc, { width: CW - 22 });
  const bH    = descH + 28;
  need(bH + 5);
  const iy = doc.y;
  doc.rect(L, iy, CW, bH).fill(C.tint);
  doc.rect(L, iy, 2,  bH).fill(C.lt);
  doc.fillColor(C.mid).fontSize(8.5).font("Helvetica-Bold").text(title, L + 10, iy + 7, { lineBreak: false });
  doc.fillColor(C.slate).fontSize(7.5).font("Helvetica").text(desc, L + 10, iy + 19, { width: CW - 22, lineGap: 2 });
  doc.y = iy + bH + 5;
});

doc.moveDown(0.6);
need(65);
const cY = doc.y;
doc.rect(L, cY, CW, 60).fill(C.navy);
doc.fillColor(C.white).fontSize(9).font("Helvetica-BoldOblique")
  .text('"Quanto vale uma ferramenta de marketing?" — essa não é a pergunta definitiva para investidores.', L + 14, cY + 9, { width: CW - 26, lineGap: 2 });
doc.fillColor("#94a3b8").fontSize(9).font("Helvetica-Bold")
  .text("A pergunta correta é: quanto vale a infraestrutura que torna crescimento empresarial executável, auditável, escalável e acessível para qualquer pessoa ou empresa?", L + 14, cY + 26, { width: CW - 26, lineGap: 2 });
doc.y = cY + 70;

doc.moveDown(0.5);
para("A resposta é: vale o tamanho da camada econômica que ela passa a controlar.");
doc.moveDown(0.8);
need(30);
doc.fillColor(C.navy).fontSize(16).font("Helvetica-Bold")
  .text("E essa camada é global.", L, doc.y, { width: CW, align: "center" });
doc.moveDown(1);
doc.fillColor(C.muted).fontSize(6.5).font("Helvetica")
  .text("NexOS AI  ·  NXS-2026-001  ·  Prospect Paper v2.1  ·  Junho 2026  ·  STRICTLY PRIVATE & CONFIDENTIAL", L, doc.y, { width: CW, align: "center" });

putFooter();

// ─── DONE ────────────────────────────────────────────────────────────────────
doc.end();
console.log(`✅  ${OUT}  (${pageNum} páginas)`);
