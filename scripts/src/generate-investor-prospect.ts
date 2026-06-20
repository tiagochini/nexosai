import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

const OUT_PATH = path.resolve("NexOS_AI_Investor_Prospect_v2.pdf");
const doc = new PDFDocument({
  size: "A4",
  margin: 50,
  info: {
    Title: "NexOS AI — Investor & Early Adopter Prospect Paper v2.0",
    Author: "NexOS AI",
    Subject: "Growth Execution Infrastructure — Business Plan · White Paper · Investment Thesis",
    Keywords: "NexOS AI, investor, prospect, growth execution, AI agents",
  },
});
doc.pipe(fs.createWriteStream(OUT_PATH));

const C = {
  bg: "#0a0e1a",
  accent: "#6c63ff",
  accentBlue: "#00d4ff",
  accentGold: "#f5c842",
  red: "#ff4444",
  orange: "#ff8c00",
  yellow: "#ffd700",
  green: "#00cc66",
  white: "#ffffff",
  gray: "#8892a4",
  lightGray: "#c8d0dc",
  cardBg: "#111827",
  cardBg2: "#0d1421",
  border: "#1e2a3a",
};

const W = 595.28;
const MARGIN = 50;
const CONTENT_W = W - MARGIN * 2;

function pageBackground() {
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(C.bg);
}

function topBar(color = C.accent) {
  doc.rect(0, 0, doc.page.width, 5).fill(color);
}

function hr(y?: number, color = C.border) {
  const yPos = y ?? doc.y;
  doc.moveTo(MARGIN, yPos).lineTo(doc.page.width - MARGIN, yPos).strokeColor(color).lineWidth(0.4).stroke();
  doc.y = yPos + 8;
}

function sectionTitle(num: string, text: string) {
  doc.moveDown(0.8);
  const y = doc.y;
  doc.rect(MARGIN, y, CONTENT_W, 28).fill(C.accent + "18");
  doc.rect(MARGIN, y, 3, 28).fill(C.accent);
  doc.fillColor(C.accent).fontSize(8).font("Helvetica-Bold").text(num, MARGIN + 10, y + 8, { lineBreak: false });
  doc.fillColor(C.white).fontSize(11).font("Helvetica-Bold").text(text, MARGIN + 30, y + 8, { lineBreak: false });
  doc.y = y + 36;
  doc.fillColor(C.white);
}

function subTitle(text: string) {
  doc.moveDown(0.35);
  doc.fillColor(C.accentBlue).fontSize(9).font("Helvetica-Bold").text(text);
  doc.fillColor(C.white);
  doc.moveDown(0.1);
}

function body(text: string, indent = 0) {
  doc.fillColor(C.lightGray).fontSize(8.5).font("Helvetica")
    .text(text, MARGIN + indent, doc.y, { width: CONTENT_W - indent });
}

function tableRow(cols: string[], widths: number[], isHeader = false, tag?: "green" | "blue" | "red" | "orange" | "yellow" | "gray") {
  const startX = MARGIN;
  const rowH = isHeader ? 18 : 15;
  const y = doc.y;
  const totalW = widths.reduce((a, b) => a + b, 0);

  let bg = isHeader ? C.accent + "30" : (doc.y % 30 < 15 ? C.cardBg : C.cardBg2);
  if (tag === "green") bg = C.green + "12";
  if (tag === "red") bg = C.red + "12";
  if (tag === "orange") bg = C.orange + "12";
  if (tag === "yellow") bg = C.yellow + "10";
  if (tag === "blue") bg = C.accentBlue + "12";

  doc.rect(startX, y, totalW, rowH).fill(bg);

  let x = startX;
  cols.forEach((col, i) => {
    const color = isHeader ? C.accent : C.lightGray;
    doc.fillColor(color).fontSize(7.5)
      .font(isHeader ? "Helvetica-Bold" : "Helvetica")
      .text(col, x + 5, y + (isHeader ? 5 : 4), { width: widths[i] - 10, lineBreak: false, ellipsis: true });
    x += widths[i];
  });

  doc.moveTo(startX, y + rowH).lineTo(startX + totalW, y + rowH)
    .strokeColor(C.border).lineWidth(0.2).stroke();
  doc.y = y + rowH;
}

function infoCard(label: string, value: string, sub: string, cx: number, cy: number, cw: number, ch: number, accent = C.accent) {
  doc.rect(cx, cy, cw, ch).fill(C.cardBg);
  doc.rect(cx, cy, cw, 2).fill(accent);
  doc.fillColor(C.gray).fontSize(6.5).font("Helvetica-Bold").text(label, cx + 10, cy + 8, { lineBreak: false });
  doc.fillColor(C.white).fontSize(11).font("Helvetica-Bold").text(value, cx + 10, cy + 20, { lineBreak: false });
  if (sub) doc.fillColor(accent).fontSize(6.5).font("Helvetica").text(sub, cx + 10, cy + 36, { lineBreak: false });
}

function bigNumber(n: string, label: string, cx: number, cy: number, cw: number, accent = C.accent) {
  doc.rect(cx, cy, cw, 52).fill(C.cardBg);
  doc.rect(cx, cy, cw, 2).fill(accent);
  doc.fillColor(accent).fontSize(20).font("Helvetica-Bold").text(n, cx, cy + 8, { width: cw, align: "center" });
  doc.fillColor(C.gray).fontSize(6.5).font("Helvetica").text(label, cx, cy + 36, { width: cw, align: "center" });
}

function quoteBlock(text: string) {
  doc.moveDown(0.5);
  const y = doc.y;
  const h = 36;
  doc.rect(MARGIN, y, CONTENT_W, h).fill(C.accent + "10");
  doc.rect(MARGIN, y, 3, h).fill(C.accentGold);
  doc.fillColor(C.accentGold).fontSize(8.5).font("Helvetica-BoldOblique")
    .text(`"${text}"`, MARGIN + 14, y + 10, { width: CONTENT_W - 20 });
  doc.y = y + h + 8;
}

function badge(text: string, color: string) {
  const w = text.length * 5.5 + 14;
  const y = doc.y;
  doc.rect(MARGIN, y, w, 14).fill(color + "30");
  doc.rect(MARGIN, y, w, 14).strokeColor(color).lineWidth(0.4).stroke();
  doc.fillColor(color).fontSize(7).font("Helvetica-Bold").text(text, MARGIN + 7, y + 3, { lineBreak: false });
  doc.y = y + 20;
}

function newPage() {
  doc.addPage();
  pageBackground();
  topBar();
}

function pageFooter(pageNum: number, total: number) {
  const footerY = doc.page.height - 30;
  doc.moveTo(MARGIN, footerY - 4).lineTo(doc.page.width - MARGIN, footerY - 4)
    .strokeColor(C.border).lineWidth(0.3).stroke();
  doc.fillColor(C.gray).fontSize(6.5).font("Helvetica")
    .text("NXS-2026-001 · NexOS AI Prospect Paper v2.0", MARGIN, footerY, { lineBreak: false });
  doc.fillColor(C.gray).fontSize(6.5).font("Helvetica")
    .text(`Página ${pageNum} de ${total}`, doc.page.width - MARGIN - 60, footerY, { lineBreak: false });
  doc.fillColor(C.border).fontSize(6).font("Helvetica")
    .text("STRICTLY PRIVATE & CONFIDENTIAL", doc.page.width / 2 - 50, footerY, { lineBreak: false });
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 1 — COVER
// ─────────────────────────────────────────────────────────────────────────────
pageBackground();
doc.rect(0, 0, doc.page.width, 7).fill(C.accent);

doc.fillColor(C.gray).fontSize(8).font("Helvetica-Bold")
  .text("STRICTLY PRIVATE & CONFIDENTIAL", MARGIN, 18, { lineBreak: false });
doc.fillColor(C.gray).fontSize(8).font("Helvetica")
  .text("NXS / 2026", doc.page.width - MARGIN - 50, 18, { lineBreak: false });

doc.moveDown(2.5);
doc.fillColor(C.gray).fontSize(9).font("Helvetica-Bold").text("GROWTH EXECUTION INFRASTRUCTURE", MARGIN, 65);
doc.moveDown(0.5);

doc.rect(MARGIN, 85, 5, 80).fill(C.accent);
doc.fillColor(C.white).fontSize(48).font("Helvetica-Bold").text("NEXOS", MARGIN + 18, 88, { continued: true });
doc.fillColor(C.accentBlue).fontSize(48).font("Helvetica-Bold").text(" AI", { continued: false });
doc.fillColor(C.gray).fontSize(11).font("Helvetica").text("Investor & Early Adopter Prospect Paper", MARGIN + 18, 143);

doc.moveDown(0.4);
doc.rect(MARGIN + 18, 165, CONTENT_W - 18, 0.8).fill(C.accent);
doc.moveDown(0.4);
doc.fillColor(C.gray).fontSize(8).font("Helvetica")
  .text("Business plan · white paper · investment thesis · economic model & strategic valuation framework", MARGIN + 18, 172);

doc.moveDown(3);
doc.fillColor(C.gray).fontSize(8).font("Helvetica-Bold").text("PREPARADO PARA INVESTIDORES E EARLY ADOPTERS", MARGIN + 18, 210);

doc.moveDown(3.5);
const metaY = 245;
const cardW = CONTENT_W / 3 - 5;
[
  { l: "DOCUMENTO", v: "NXS-2026-001", s: "v2.0 — Atualizado" },
  { l: "DATA", v: "Junho 2026", s: "Edição Investidores" },
  { l: "VERSÃO", v: "v2.0", s: "Lançamento + Anti-pirataria" },
].forEach((m, i) => {
  infoCard(m.l, m.v, m.s, MARGIN + i * (cardW + 7.5), metaY, cardW, 50);
});

doc.y = metaY + 68;

const statW = CONTENT_W / 4 - 4;
const statY = doc.y;
[
  { n: "64", label: "Agentes de IA", accent: C.accent },
  { n: "5", label: "Produtos no Ecossistema", accent: C.accentBlue },
  { n: "3", label: "Trilhas de Receita", accent: C.accentGold },
  { n: "1M", label: "Missão Ano 1 (clientes)", accent: C.green },
].forEach((s, i) => {
  bigNumber(s.n, s.label, MARGIN + i * (statW + 5), statY, statW, s.accent);
});
doc.y = statY + 72;

const toc = [
  ["—", "Sumário Executivo", "3"],
  ["01", "Executive Investment Thesis", "4"],
  ["02", "Market Context", "5"],
  ["03", "The Structural Market Problem", "6"],
  ["04", "Product Definition & Ecosystem", "7"],
  ["05", "Core Product Capabilities", "8–10"],
  ["06", "Economic Model (v2.0 — Atualizado)", "11"],
  ["07", "Year 1 Growth Mission", "12"],
  ["08", "Revenue Projection — 1M Customers", "13"],
  ["09", "Valuation Framework", "14"],
  ["10", "Path to Trillion-Dollar Valuation", "15"],
  ["11", "Why NexOS Commands Infrastructure Multiples", "16"],
  ["12", "Strategic Moat (+ Masterprint Security)", "17"],
  ["13", "Investor Conclusion", "18"],
];
toc.forEach(([num, title, page]) => {
  const iy = doc.y;
  doc.fillColor(C.accent).fontSize(7.5).font("Helvetica-Bold").text(num, MARGIN + 5, iy, { lineBreak: false });
  doc.fillColor(C.lightGray).fontSize(7.5).font("Helvetica").text(title, MARGIN + 28, iy, { lineBreak: false });
  doc.fillColor(C.gray).fontSize(7.5).text(page, doc.page.width - MARGIN - 25, iy, { lineBreak: false });
  doc.moveTo(MARGIN + 28, iy + 10).lineTo(doc.page.width - MARGIN - 30, iy + 10)
    .strokeColor(C.border).lineWidth(0.2).stroke();
  doc.y = iy + 13;
});

doc.fillColor(C.gray).fontSize(7).font("Helvetica")
  .text("Junho de 2026 · Documento NXS-2026-001 · v2.0", MARGIN, doc.page.height - 45, { align: "center" });
pageFooter(1, 18);

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 2 — AVISO LEGAL
// ─────────────────────────────────────────────────────────────────────────────
newPage();
doc.fillColor(C.gray).fontSize(8).font("Helvetica-Bold")
  .text("NEXOS AI · GROWTH EXECUTION INFRASTRUCTURE", MARGIN, 14, { lineBreak: false });
doc.fillColor(C.gray).fontSize(8).font("Helvetica")
  .text("STRICTLY PRIVATE & CONFIDENTIAL", doc.page.width - MARGIN - 130, 14, { lineBreak: false });
doc.moveDown(2);

sectionTitle("—", "AVISO LEGAL");
subTitle("Confidencialidade & Declarações Prospectivas");
body(
  "Este documento é fornecido em caráter estritamente confidencial, exclusivamente para fins de avaliação por investidores qualificados e early adopters convidados da NexOS AI. Sua reprodução, distribuição ou divulgação, total ou parcial, a terceiros não autorizados é vedada sem consentimento prévio por escrito.",
);
doc.moveDown(0.5);
body(
  "As informações aqui apresentadas — incluindo projeções de receita, cenários de valuation, premissas de crescimento de base de clientes e estimativas de mercado — têm natureza prospectiva e ilustrativa. Elas refletem premissas internas da NexOS AI sobre execução, adoção e dinâmica de mercado, e não constituem garantia de resultados futuros, recomendação de investimento ou oferta de venda de valores mobiliários.",
);
doc.moveDown(0.5);
body(
  "Dados de mercado de terceiros citados neste documento (publicidade digital, MarTech, creator economy, automação de processos) foram obtidos de fontes públicas consideradas confiáveis. A NexOS AI não assume responsabilidade pela precisão de projeções de terceiros.",
);
doc.moveDown(0.5);
body(
  "Resultados reais podem diferir materialmente das projeções aqui descritas em função de fatores como dinâmica competitiva, capacidade de execução, regulação, condições macroeconômicas e adoção de mercado. Este documento não deve ser a única base para qualquer decisão de investimento.",
);
doc.moveDown(0.5);
body(
  "Ao prosseguir com a leitura, o destinatário concorda em tratar o conteúdo deste documento como informação confidencial, nos termos de eventual acordo de confidencialidade (NDA) firmado com a NexOS AI.",
);

doc.moveDown(1.2);
sectionTitle("—", "SUMÁRIO EXECUTIVO");
subTitle("Uma tese de infraestrutura, não de ferramenta");
body(
  "NexOS AI transforma intenção empresarial em execução comercial completa — da ideia ao produto, da campanha à venda, do lead ao remarketing — substituindo a fragmentação do mercado de growth por uma operação integrada, auditável e automatizada por IA.",
);
doc.moveDown(0.5);
body(
  "O mercado endereçável combina publicidade digital, MarTech, creator economy e automação de processos — juntos, mercados multibilionários em expansão acelerada. A tese central é direta: se toda empresa precisa vender, crescer, aparecer, converter ou influenciar, então toda empresa precisa de uma infraestrutura de crescimento. NexOS AI é essa infraestrutura.",
);

doc.moveDown(0.8);
const s2W = CONTENT_W / 2 - 5;
const s2Y = doc.y;
[
  { l: "POTENCIAL ECONÔMICO ANUALIZADO (ANO 1)", v: "R$ 15,99B", s: "Aquisição + run-rate de créditos", a: C.accent },
  { l: "MISSÃO DE CRESCIMENTO — PRIMEIROS 12 MESES", v: "1.000.000", s: "Clientes ativos", a: C.accentBlue },
].forEach((c, i) => {
  infoCard(c.l, c.v, c.s, MARGIN + i * (s2W + 10), s2Y, s2W, 55, c.a);
});
doc.y = s2Y + 65;

[
  { l: "ARR ANUALIZADO DE CRÉDITOS (1M CLIENTES)", v: "R$ 12B", s: "Consumo médio R$1.000/mês/cliente", a: C.green },
  { l: "FAIXA DE VALUATION — EXPANSÃO GLOBAL", v: "US$ 3T–6T", s: "Cenário 50–100M clientes", a: C.accentGold },
].forEach((c, i) => {
  infoCard(c.l, c.v, c.s, MARGIN + i * (s2W + 10), doc.y, s2W, 55, c.a);
});
doc.y += 65;

quoteBlock("A pergunta correta não é 'quanto vale uma ferramenta de marketing?'. A pergunta é: quanto vale a infraestrutura que torna o crescimento empresarial executável, auditável, escalável e acessível para qualquer pessoa ou empresa?");

pageFooter(2, 18);

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 3 — INVESTMENT THESIS + MARKET CONTEXT
// ─────────────────────────────────────────────────────────────────────────────
newPage();
doc.fillColor(C.gray).fontSize(8).font("Helvetica-Bold")
  .text("NEXOS AI · GROWTH EXECUTION INFRASTRUCTURE", MARGIN, 14, { lineBreak: false });
doc.fillColor(C.gray).fontSize(8).font("Helvetica")
  .text("STRICTLY PRIVATE & CONFIDENTIAL", doc.page.width - MARGIN - 130, 14, { lineBreak: false });
doc.moveDown(2);

sectionTitle("01", "Executive Investment Thesis");
body(
  "NexOS AI não é uma ferramenta de marketing. NexOS AI é uma infraestrutura operacional de crescimento. A plataforma transforma intenção empresarial em execução comercial completa:",
);
doc.moveDown(0.4);
doc.rect(MARGIN, doc.y, CONTENT_W, 18).fill(C.cardBg);
doc.fillColor(C.accentBlue).fontSize(7.5).font("Helvetica-Oblique")
  .text(
    "  ideia → produto → oferta → campanha → criativos → vídeos → anúncios → audiência → leads → aquecimento → carrinho → vendas → remarketing → aprendizado → próxima campanha",
    MARGIN + 6, doc.y + 5, { width: CONTENT_W - 12 },
  );
doc.moveDown(1.2);

body("O valor do NexOS não está em gerar textos, imagens ou páginas. O valor está em executar crescimento.");
doc.moveDown(0.5);
body(
  "O mercado atual é fragmentado. Empresas precisam contratar ou coordenar copywriters, designers, editores, estrategistas, gestores de tráfego, analistas, agências, ferramentas de CRM, SEO, automação, funis e vídeo. O NexOS substitui essa fragmentação por uma operação integrada, auditável e automatizada.",
);
doc.moveDown(0.5);
quoteBlock("Se toda empresa precisa vender, crescer, aparecer, converter ou influenciar, então toda empresa precisa de uma infraestrutura de crescimento. NexOS AI é essa infraestrutura.");

sectionTitle("02", "Market Context");
body("O NexOS atua na interseção de mercados gigantescos — aquisição de atenção e tráfego já é uma das maiores linhas de gasto empresarial do mundo, enquanto empresas migram aceleradamente para infraestrutura tecnológica de marketing, personalização e automação.");
doc.moveDown(0.6);

tableRow(["Mercado", "Tamanho atual", "Projeção"], [200, 140, 155], true);
tableRow(["Advertising (global)", "—", "~US$ 1,26T (2026)"], [200, 140, 155]);
tableRow(["Digital Advertising", "US$ 567,9B (2025)", "US$ 1,69T (2033)"], [200, 140, 155]);
tableRow(["MarTech", "US$ 551,9B (2025)", "US$ 2,38T (2033)"], [200, 140, 155]);
tableRow(["Creator Economy", "—", "~US$ 480B (2027)"], [200, 140, 155]);
tableRow(["Intelligent Process Automation", "US$ 14,55B (2024)", "US$ 44,74B (2030)"], [200, 140, 155]);

doc.moveDown(0.6);
body("O NexOS não pertence apenas a um desses mercados. Ele captura valor em todos:");
doc.moveDown(0.3);

const categories = [
  "MarTech", "Digital Advertising", "Creator Economy", "AI Agents", "Business Automation",
  "Sales Enablement", "Video Production", "Funnel Infrastructure", "Campaign Execution", "Regional Growth & Affiliate",
];
const colW2 = CONTENT_W / 2;
categories.forEach((c, i) => {
  const col = i % 2;
  const row = Math.floor(i / 2);
  if (col === 0 && i > 0) doc.y += 12;
  const x = MARGIN + col * (colW2 + 5);
  const y = doc.y;
  doc.rect(x, y, colW2 - 5, 12).fill(C.cardBg);
  doc.fillColor(C.accent).fontSize(7.5).font("Helvetica-Bold").text("—", x + 6, y + 2, { lineBreak: false });
  doc.fillColor(C.lightGray).fontSize(7.5).font("Helvetica").text(c, x + 18, y + 2, { lineBreak: false });
  if (col === 0) { doc.y = y; } else { doc.y = y + 12; }
});
doc.y += 14;

pageFooter(3, 18);

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 4 — STRUCTURAL PROBLEM + PRODUCT DEFINITION
// ─────────────────────────────────────────────────────────────────────────────
newPage();
doc.fillColor(C.gray).fontSize(8).font("Helvetica-Bold")
  .text("NEXOS AI · GROWTH EXECUTION INFRASTRUCTURE", MARGIN, 14, { lineBreak: false });
doc.fillColor(C.gray).fontSize(8).font("Helvetica")
  .text("STRICTLY PRIVATE & CONFIDENTIAL", doc.page.width - MARGIN - 130, 14, { lineBreak: false });
doc.moveDown(2);

sectionTitle("03", "The Structural Market Problem");
body("O problema global não é falta de ferramentas. O problema é que as ferramentas não executam a cadeia inteira.");
doc.moveDown(0.5);

[
  { t: "SEO", d: "Gera tráfego, mas não cria produto, não cria oferta, não grava vídeos, não monta lançamento, não abre carrinho e não faz remarketing." },
  { t: "CRM", d: "Organiza contatos, mas não cria os contatos, não aquece audiência, não cria desejo e não fecha vendas." },
  { t: "Landing builders", d: "Criam páginas, mas não sabem qual oferta converte, qual público deve ser atingido, qual narrativa deve ser usada ou qual timing de lançamento deve ser aplicado." },
  { t: "AI content tools", d: "Criam textos, imagens e vídeos, mas ainda dependem de alguém para decidir estratégia, campanha, público, distribuição, aprovação, agenda e execução." },
  { t: "Agências", d: "Executam, mas são caras, lentas, humanas, limitadas por agenda, capacidade operacional, reuniões, retrabalho e custo proporcional." },
].forEach((item) => {
  const y = doc.y;
  doc.rect(MARGIN, y, CONTENT_W, 30).fill(C.cardBg);
  doc.rect(MARGIN, y, 2, 30).fill(C.red);
  doc.fillColor(C.white).fontSize(8).font("Helvetica-Bold").text(item.t, MARGIN + 10, y + 5, { lineBreak: false });
  doc.fillColor(C.lightGray).fontSize(7.5).font("Helvetica").text(item.d, MARGIN + 10, y + 17, { width: CONTENT_W - 20 });
  doc.y = y + 33;
});

quoteBlock("NexOS elimina a fragmentação. O NexOS não pergunta apenas 'o que você quer criar?' — O que você quer conquistar? E executa a operação.");

sectionTitle("04", "Product Definition & Ecosystem (v2.0)");
body("NexOS AI opera como um AI-Powered Growth Execution Operating System — e se posiciona no mercado através de um ecossistema de 5 produtos estratégicos em funil ascendente:");
doc.moveDown(0.6);

tableRow(["Produto", "Preço Regular", "Preço Lançamento", "Modelo de Acesso"], [160, 100, 105, 130], true);
tableRow(["🎯  Isca — Os 7 Erros Fatais", "Grátis", "Grátis", "PDF via WhatsApp + grupo"], [160, 100, 105, 130], false, "green");
tableRow(["⚡  Tripwire — Primeiros R$10K", "R$ 290", "R$ 97", "Mini-guia digital"], [160, 100, 105, 130], false, "blue");
tableRow(["🚀  NexOS AI Solo", "R$ 15.990", "R$ 3.990", "Vitalício — sem mensalidade"], [160, 100, 105, 130], false, "blue");
tableRow(["🏢  NexOS AI Agency", "R$ 14.000", "R$ 9.990", "10 camp. + white-label vitalício"], [160, 100, 105, 130], false, "blue");
tableRow(["🎓  NexOS Academy", "R$ 3.900", "R$ 2.500", "Metodologia — incluso no NexOS AI"], [160, 100, 105, 130], false, "yellow");
tableRow(["📡  NexOS Connect (API Guide)", "R$ 297", "R$ 197", "Guia técnico de integrações"], [160, 100, 105, 130], false, "gray");

doc.moveDown(0.5);
body("Taxa por lançamento: O primeiro lançamento é GRATUITO. A partir do 2º lançamento executado na plataforma, o modelo prevê uma taxa de R$497 por lançamento — alinhando a receita do NexOS ao crescimento real do cliente (pay per execution).", 0);

pageFooter(4, 18);

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 5 — CORE CAPABILITIES 5.1–5.5
// ─────────────────────────────────────────────────────────────────────────────
newPage();
doc.fillColor(C.gray).fontSize(8).font("Helvetica-Bold")
  .text("NEXOS AI · GROWTH EXECUTION INFRASTRUCTURE", MARGIN, 14, { lineBreak: false });
doc.fillColor(C.gray).fontSize(8).font("Helvetica")
  .text("STRICTLY PRIVATE & CONFIDENTIAL", doc.page.width - MARGIN - 130, 14, { lineBreak: false });
doc.moveDown(2);

sectionTitle("05", "Core Product Capabilities");

subTitle("5.1 — NexOS Command Agent (Diretor Geral de IA)");
body("O NexOS opera com um Diretor Geral de IA que orquestra 64 agentes especializados em 7 departamentos. O usuário não escolhe agentes — o sistema convoca cada agente no momento correto da execução.");
doc.moveDown(0.4);

const agentCols = [
  ["Estratégia & Planejamento", "Strategy · Command · Profile Builder · Market Intel · Offer · Pricing Psychologist"],
  ["Conteúdo & Copy", "Copywriter · Creative Director · VSL · CPL · Social Media · Ad Copy · Landing Page · Hook Factory"],
  ["Audiência & Tráfego", "Targeting · Media Buyer · Organic Traffic · A/B Test Designer · Compliance"],
  ["Vídeo & Criativos", "Video Director · Creative Concept · Ad Critic · Stories Sequence · Video Hook"],
  ["Analytics & Otimização", "Analytics · Optimization · Launch Debriefing · Scarcity Engineer"],
  ["Automação & Vendas", "Sales Warmer · Sales Closer · Sales Desire · Sales Objection · Sales Consultant · Affiliate · Reengagement"],
  ["Mentalidade & Crescimento", "Mental Frequency Coach · Identity Architect · Obstinacy Trainer · Creator Growth"],
];

agentCols.forEach(([dept, agents]) => {
  const y = doc.y;
  doc.rect(MARGIN, y, CONTENT_W, 26).fill(C.cardBg);
  doc.rect(MARGIN, y, 3, 26).fill(C.accent);
  doc.fillColor(C.white).fontSize(7.5).font("Helvetica-Bold").text(dept, MARGIN + 10, y + 4, { lineBreak: false });
  doc.fillColor(C.gray).fontSize(6.5).font("Helvetica").text(agents, MARGIN + 10, y + 15, { width: CONTENT_W - 20 });
  doc.y = y + 29;
});

doc.moveDown(0.4);
subTitle("5.2 — Live Production Display");
body("O frontend exibe a produção acontecendo em tempo real — o usuário vê estratégia sendo escrita, campanha sendo estruturada, criativos sendo criados, vídeos sendo planejados, públicos sendo definidos, agenda sendo programada, anúncios sendo preparados e decisões sendo registradas. Tudo vira log auditável — isso cria percepção de valor, confiança e prova operacional.");

doc.moveDown(0.5);
subTitle("5.3 — Video Production Engine");
tableRow(["Modo", "O que o NexOS executa"], [100, 395], true);
tableRow(["Com aparição", "Roteiro, cenário, enquadramento, iluminação, tom, gravação contínua orientada, remoção de erros, corte automático, legendas, B-roll, trilha e geração de versões."], [100, 395]);
tableRow(["Sem aparição", "Avatar digital, voz clonada, apresentador sintético, motion graphics, vídeos IA e narração automatizada."], [100, 395]);
tableRow(["Modelo híbrido", "Imagem real, avatar parcial, voz clonada, cenas complementares e edição por IA."], [100, 395]);

doc.moveDown(0.5);
subTitle("5.4 — Campaign Type Engine");
body("O NexOS identifica o tipo de campanha — lançamento, branding, autoridade regional, vendas contínuas, remarketing, upsell, crescimento de audiência, creator monetization, campanha política, profissional ou institucional. O usuário escolhe o objetivo; a IA escolhe a arquitetura.");

doc.moveDown(0.5);
subTitle("5.5 — Launch Engine (Trilhas de Receita)");
doc.rect(MARGIN, doc.y, CONTENT_W, 18).fill(C.cardBg);
doc.fillColor(C.accentBlue).fontSize(7.5).font("Helvetica-Oblique")
  .text("  captação → aquecimento → autoridade → desejo → oferta → escassez → abertura de carrinho → fechamento → remarketing → prova social → próximo ciclo",
    MARGIN + 6, doc.y + 5, { width: CONTENT_W - 12 });
doc.moveDown(1.4);

tableRow(["Trilha", "Meta de Receita em 7 dias", "Agentes Ativos"], [120, 160, 215], true);
tableRow(["6 Dígitos", "R$ 100K – R$ 999K", "Strategy + Launch + Copy + Traffic (completo)"], [120, 160, 215], false, "green");
tableRow(["8 Dígitos", "R$ 10M – R$ 99M", "Full stack: todos os agentes + tracking avançado"], [120, 160, 215], false, "yellow");
tableRow(["10 Dígitos", "R$ 100M+", "Infraestrutura completa + agency track + white-label"], [120, 160, 215], false, "orange");

pageFooter(5, 18);

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 6 — CORE CAPABILITIES 5.6–5.9 + MASTERPRINT
// ─────────────────────────────────────────────────────────────────────────────
newPage();
doc.fillColor(C.gray).fontSize(8).font("Helvetica-Bold")
  .text("NEXOS AI · GROWTH EXECUTION INFRASTRUCTURE", MARGIN, 14, { lineBreak: false });
doc.fillColor(C.gray).fontSize(8).font("Helvetica")
  .text("STRICTLY PRIVATE & CONFIDENTIAL", doc.page.width - MARGIN - 130, 14, { lineBreak: false });
doc.moveDown(2);

sectionTitle("05", "Core Product Capabilities — continuação");

subTitle("5.6 — Self-Proof Engine");
body("O maior case inicial do NexOS é ele próprio. O NexOS se lança, documenta seu próprio lançamento e grava suas próprias telas.");
quoteBlock("Você chegou até aqui através de uma campanha criada e executada pelo próprio NexOS. Esse é o maior mecanismo de prova social: o lead não assiste uma promessa; ele vive a demonstração.");

subTitle("5.7 — Paid Traffic & Algorithm Intelligence");
body("A gestão de tráfego pago no NexOS não se limita a criar e publicar anúncios. Os agentes especializados exploram a gestão do algoritmo de cada plataforma — atuando em profundidade sobre sinais de entrega, otimização de lance, janelas de aprendizado, segmentação dinâmica e comportamento de leilão. Essa camada de inteligência algorítmica é o que permite ao NexOS extrair o máximo desempenho de cada plataforma de anúncios.");

doc.moveDown(0.5);
subTitle("5.8 — Adaptive Interface (Fundador & Arquiteto)");
body("A interface do NexOS oferece dois modos de operação: Fundador (simples, guiado, emocional — foco no resultado) e Arquiteto (técnico, granular, detalhado — foco no controle da operação). A adoção é forte em ambos os públicos. Um switch permite alternar a qualquer momento.");

doc.moveDown(0.5);
subTitle("5.9 — Landing Page, Domain & Hosting Engine");
body("O NexOS cria a landing page completa de cada campanha, sem que o usuário precise desenvolver ou configurar nada manualmente. A plataforma auxilia na aquisição e hospedagem do domínio, e realiza a publicação da página com integração nativa.");

doc.moveDown(0.7);

doc.rect(MARGIN, doc.y, CONTENT_W, 22).fill(C.accent + "20");
doc.rect(MARGIN, doc.y, CONTENT_W, 2).fill(C.accentGold);
const mpTitleY = doc.y + 7;
doc.fillColor(C.accentGold).fontSize(10).font("Helvetica-Bold").text("5.10 — Masterprint Anti-Piracy System", MARGIN + 8, mpTitleY, { lineBreak: false });
doc.fillColor(C.gray).fontSize(7).font("Helvetica-Bold").text("NOVO · v2.0", doc.page.width - MARGIN - 55, mpTitleY, { lineBreak: false });
doc.y += 30;

body("O NexOS protege toda propriedade intelectual gerada na plataforma com rastreamento forense de documentos. Cada PDF, guia, roteiro, estratégia ou material exportado recebe um fingerprint único e invisível — permitindo identificação do vazador em caso de distribuição não autorizada.");
doc.moveDown(0.5);

tableRow(["Componente", "Descrição"], [160, 335], true);
tableRow(["Fingerprint único", "Código NXS-XXXX-XXXX embutido por download — invisível ao usuário final"], [160, 335], false, "yellow");
tableRow(["Cadeia de custódia", "Registro completo: userId + email + nome + IP + user-agent + workspace + timestamp"], [160, 335], false, "green");
tableRow(["Admin lookup", "Código → identificação imediata do titular original do arquivo"], [160, 335], false, "blue");
tableRow(["Cross-referência econômica", "CPF Asaas + device fingerprint + padrão de IP → identifica mesmo com cadastro fraudulento"], [160, 335], false, "orange");
tableRow(["Dossiê jurídico", "Exportação estruturada para notificação legal (LGPD Art. 42 + Marco Civil)"], [160, 335], false, "red");
tableRow(["Alertas automáticos", "Sistema detecta download em múltiplos IPs distintos e notifica o admin em tempo real"], [160, 335], false, "orange");

doc.moveDown(0.5);
body("Esse sistema representa um diferencial competitivo significativo: nenhuma plataforma de SaaS de marketing no Brasil oferece rastreabilidade forense nativa de documentos gerados. O Masterprint cria uma barreira de proteção de IP sem precedentes no setor.", 0);

pageFooter(6, 18);

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 7 — ECONOMIC MODEL (v2.0 UPDATED)
// ─────────────────────────────────────────────────────────────────────────────
newPage();
doc.fillColor(C.gray).fontSize(8).font("Helvetica-Bold")
  .text("NEXOS AI · GROWTH EXECUTION INFRASTRUCTURE", MARGIN, 14, { lineBreak: false });
doc.fillColor(C.gray).fontSize(8).font("Helvetica")
  .text("STRICTLY PRIVATE & CONFIDENTIAL", doc.page.width - MARGIN - 130, 14, { lineBreak: false });
doc.moveDown(2);

sectionTitle("06", "Economic Model — v2.0 (Atualizado)");

badge("MODELO ECONÔMICO ATUALIZADO — v2.0 · JUNHO 2026", C.accentGold);

body("O modelo econômico é baseado em aquisição única + consumo por uso — mais próximo de infraestrutura operacional do que de assinatura fixa. Sem mensalidade. Sem recorrência forçada. O cliente consome mais quando opera mais, alinhando a receita do NexOS ao crescimento real do cliente.");
doc.moveDown(0.6);

subTitle("Aquisição — Ticket Único Vitalício");
tableRow(["Plano", "Preço Regular (âncora)", "Preço Lançamento", "Campanhas incluídas", "Créditos incluídos"], [90, 110, 100, 100, 95], true);
tableRow(["Solo", "R$ 15.990", "R$ 3.990", "3 campanhas", "900 créditos (~2 lançamentos)"], [90, 110, 100, 100, 95], false, "blue");
tableRow(["Agency", "R$ 14.000", "R$ 9.990", "10 campanhas", "2.000 créditos (~5 lançamentos)"], [90, 110, 100, 100, 95], false, "orange");

doc.moveDown(0.5);
subTitle("Taxa por Execução de Lançamento");
const launchY = doc.y;
doc.rect(MARGIN, launchY, CONTENT_W, 32).fill(C.cardBg);
doc.rect(MARGIN, launchY, 3, 32).fill(C.accentGold);
doc.fillColor(C.accentGold).fontSize(9).font("Helvetica-Bold").text("Primeiro lançamento: GRATUITO", MARGIN + 10, launchY + 6);
doc.fillColor(C.lightGray).fontSize(8).font("Helvetica").text("A partir do 2º lançamento executado na plataforma → R$ 497 por lançamento (pay per execution)", MARGIN + 10, launchY + 20, { lineBreak: false });
doc.y = launchY + 40;

doc.moveDown(0.4);
subTitle("Créditos de IA — Consumo por uso (preços atualizados v2.0)");
tableRow(["Pacote", "Créditos", "Preço", "Equivalente aproximado", "Custo por crédito"], [70, 60, 70, 200, 95], true);
tableRow(["Boost", "500 cr", "R$ 85", "~1 lançamento pequeno com folga", "R$ 0,17/cr"], [70, 60, 70, 200, 95], false, "green");
tableRow(["Starter", "1.500 cr", "R$ 239", "~3–4 lançamentos completos", "R$ 0,16/cr"], [70, 60, 70, 200, 95], false, "blue");
tableRow(["Pro", "3.500 cr", "R$ 529", "~8–9 lançamentos completos", "R$ 0,15/cr"], [70, 60, 70, 200, 95], false, "blue");
tableRow(["Elite", "7.000 cr", "R$ 979", "~17–18 lançamentos — agências e alto volume", "R$ 0,14/cr"], [70, 60, 70, 200, 95], false, "orange");

doc.moveDown(0.5);
subTitle("Receita pelo Ecossistema Completo de Produtos");
tableRow(["Produto", "Preço", "Função econômica", "Frequência esperada"], [120, 80, 170, 125], true);
tableRow(["Isca — Os 7 Erros Fatais", "Grátis", "Captura de lead qualificado", "Topo de funil"], [120, 80, 170, 125], false, "green");
tableRow(["Tripwire — Primeiros R$10K", "R$ 97", "Primeira transação + qualificação financeira", "Entrada no funil"], [120, 80, 170, 125], false, "blue");
tableRow(["NexOS AI (Solo/Agency)", "R$ 3.990/9.990", "Aquisição principal — ticket único vitalício", "Uma vez"], [120, 80, 170, 125], false, "blue");
tableRow(["NexOS Academy", "R$ 2.500", "Metodologia — bônus incluso no NexOS AI", "Junto ou separado"], [120, 80, 170, 125], false, "yellow");
tableRow(["Taxa de lançamento", "R$ 497", "Pay-per-execution (2º lançamento+)", "Por uso"], [120, 80, 170, 125], false, "orange");
tableRow(["Créditos de IA", "R$ 85 a R$ 979", "Consumo recorrente por uso", "Contínuo"], [120, 80, 170, 125], false, "orange");
tableRow(["NexOS Connect (API Guide)", "R$ 197", "Guia técnico de integrações — standalone", "Produto entry-level técnico"], [120, 80, 170, 125], false, "gray");

doc.moveDown(0.5);
subTitle("NexOS Academy — Produto Autônomo");
body("A NexOS Academy (R$ 3.900 regular / R$ 2.500 lançamento) é um produto de formação em metodologia de lançamentos, vendida de forma independente ou como bônus incluído para compradores do NexOS AI. Representa uma linha de receita adicional sem custos marginais de entrega significativos.", 0);

pageFooter(7, 18);

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 8 — YEAR 1 GROWTH MISSION
// ─────────────────────────────────────────────────────────────────────────────
newPage();
doc.fillColor(C.gray).fontSize(8).font("Helvetica-Bold")
  .text("NEXOS AI · GROWTH EXECUTION INFRASTRUCTURE", MARGIN, 14, { lineBreak: false });
doc.fillColor(C.gray).fontSize(8).font("Helvetica")
  .text("STRICTLY PRIVATE & CONFIDENTIAL", doc.page.width - MARGIN - 130, 14, { lineBreak: false });
doc.moveDown(2);

sectionTitle("07", "Year 1 Growth Mission");

doc.moveDown(0.3);
const missionY = doc.y;
doc.rect(MARGIN, missionY, CONTENT_W, 65).fill(C.cardBg);
doc.rect(MARGIN, missionY, CONTENT_W, 2).fill(C.accent);
doc.fillColor(C.accent).fontSize(38).font("Helvetica-Bold").text("1.000.000", MARGIN, missionY + 12, { width: CONTENT_W, align: "center" });
doc.fillColor(C.gray).fontSize(9).font("Helvetica").text("CLIENTES EM 12 MESES — MISSÃO INTERNA", MARGIN, missionY + 52, { width: CONTENT_W, align: "center" });
doc.y = missionY + 75;

body("Estratégia: 52 semanas, 52 regiões estratégicas do Brasil, 52 públicos prioritários e 52 ciclos de lançamento — combinando campanhas próprias acumulativas, afiliados regionais, prova social crescente e reinjeção de capital.");
doc.moveDown(0.5);

subTitle("Funil de Aquisição — Do Lead ao Cliente");
tableRow(["Estágio", "Produto", "Objetivo"], [100, 150, 245], true);
tableRow(["Topo de funil", "Isca gratuita (Os 7 Erros Fatais)", "Volume massivo de leads qualificados"], [100, 150, 245], false, "green");
tableRow(["Qualificação financeira", "Tripwire R$97", "Filtrar leads prontos para comprar"], [100, 150, 245], false, "blue");
tableRow(["Conversão principal", "NexOS AI R$3.990 / R$9.990", "Aquisição vitalícia — receita central"], [100, 150, 245], false, "blue");
tableRow(["Upsell metodologia", "NexOS Academy R$2.500", "Profundidade + LTV por cliente"], [100, 150, 245], false, "yellow");
tableRow(["Consumo recorrente", "Créditos de IA", "Receita contínua por uso operacional"], [100, 150, 245], false, "orange");

doc.moveDown(0.6);

const diffY = doc.y;
doc.rect(MARGIN, diffY, CONTENT_W, 50).fill(C.accent + "15");
doc.rect(MARGIN, diffY, 3, 50).fill(C.accentBlue);
doc.fillColor(C.accentBlue).fontSize(8.5).font("Helvetica-Bold").text("O DIFERENCIAL OPERACIONAL", MARGIN + 10, diffY + 8);
doc.fillColor(C.lightGray).fontSize(8).font("Helvetica").text(
  "O NexOS executa essa estratégia com sua própria tecnologia — sem expansão proporcional de time, sem aumentar operação humana na mesma velocidade, sem contratar uma agência por região e sem depender de 52 equipes. Somente o NexOS consegue executar essa amplitude com baixo atrito operacional porque o produto é a própria máquina de execução.",
  MARGIN + 10, diffY + 22, { width: CONTENT_W - 20 },
);
doc.y = diffY + 60;

doc.moveDown(0.5);
subTitle("Multiplicadores de crescimento — Aceleração por Afiliados");
body("O modelo de afiliados do NexOS cria uma força de vendas distribuída e auto-financiada. Cada cliente NexOS que indica outro cliente recebe comissão sobre a aquisição — transformando a base instalada em canal de distribuição, sem custo adicional de CAC proporcionalmente crescente.");
doc.moveDown(0.5);
tableRow(["Multiplicador", "Mecanismo", "Impacto no crescimento"], [130, 200, 165], true);
tableRow(["Auto-lançamento", "NexOS se lança com NexOS — case público", "Prova de produto como marketing"], [130, 200, 165], false, "green");
tableRow(["Afiliados regionais", "Comissão por indicação validada", "Força de vendas sem custo fixo"], [130, 200, 165], false, "blue");
tableRow(["Prova social acumulativa", "Casos de sucesso documentados na plataforma", "Reduz custo de conversão"], [130, 200, 165], false, "yellow");
tableRow(["Reinjeção de capital", "Receita de semanas anteriores financia próxima", "Crescimento composto semanal"], [130, 200, 165], false, "orange");

pageFooter(8, 18);

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 9 — REVENUE PROJECTION
// ─────────────────────────────────────────────────────────────────────────────
newPage();
doc.fillColor(C.gray).fontSize(8).font("Helvetica-Bold")
  .text("NEXOS AI · GROWTH EXECUTION INFRASTRUCTURE", MARGIN, 14, { lineBreak: false });
doc.fillColor(C.gray).fontSize(8).font("Helvetica")
  .text("STRICTLY PRIVATE & CONFIDENTIAL", doc.page.width - MARGIN - 130, 14, { lineBreak: false });
doc.moveDown(2);

sectionTitle("08", "Revenue Projection — 1 Million Customers");

subTitle("8.1 — Receita de aquisição (ticket único)");
tableRow(["Clientes", "Ticket médio (lançamento)", "Receita total de aquisição"], [130, 180, 185], true);
tableRow(["1.000.000", "R$ 3.990 (Solo)", "R$ 3,99 bilhões"], [130, 180, 185], false, "blue");
tableRow(["1.000.000", "R$ 9.990 (Agency — 20% do mix)", "R$ 9,99 bilhões (cenário blended)"], [130, 180, 185], false, "orange");

doc.moveDown(0.5);
subTitle("8.2 — Receita por taxa de lançamento (pay-per-execution)");
body("A partir do 2º lançamento, cada execução na plataforma gera R$497. Com uma base de 1M de clientes e média de 4 lançamentos/ano por cliente (descontando o primeiro gratuito):");
doc.moveDown(0.3);
tableRow(["Clientes ativos", "Lançamentos/ano (pagos)", "Receita por taxa de execução"], [150, 160, 185], true);
tableRow(["1.000.000", "3 lançamentos pagos × R$497", "R$ 1,49 bilhão/ano"], [150, 160, 185], false, "yellow");

doc.moveDown(0.5);
subTitle("8.3 — Receita recorrente por créditos de IA");
tableRow(["Clientes ativos", "Consumo médio/mês", "Receita mensal", "ARR"], [120, 110, 130, 135], true);
tableRow(["1.000.000", "R$ 1.000", "R$ 1 bilhão", "R$ 12 bilhões"], [120, 110, 130, 135], false, "green");

doc.moveDown(0.5);
subTitle("8.4 — Receita do Ecossistema de Produtos (uplift adicional)");
tableRow(["Produto", "Penetração estimada", "Receita adicional"], [180, 140, 175], true);
tableRow(["Tripwire R$97 (conversão)", "5% da base de leads", "Variável — top of funnel"], [180, 140, 175]);
tableRow(["NexOS Academy R$2.500", "40% dos clientes NexOS AI", "R$ 1B (sobre 1M de clientes)"], [180, 140, 175], false, "yellow");
tableRow(["NexOS Connect R$197", "15% da base ativa", "R$ 29,55M"], [180, 140, 175], false, "gray");

doc.moveDown(0.5);
subTitle("8.5 — Potencial econômico anualizado consolidado");
const revY = doc.y;
doc.rect(MARGIN, revY, CONTENT_W, 80).fill(C.cardBg);
doc.rect(MARGIN, revY, CONTENT_W, 2).fill(C.accent);
[
  { l: "Receita de aquisição (Solo)", v: "R$ 3,99B", c: C.accentBlue },
  { l: "Taxa de lançamento (3 paid × 1M clientes)", v: "R$ 1,49B", c: C.accentGold },
  { l: "Run-rate anualizado de créditos", v: "R$ 12B", c: C.green },
  { l: "NexOS Academy (40% penetração)", v: "+ R$ 1B", c: C.yellow },
].forEach((r, i) => {
  const rx = MARGIN + 10;
  const ry = revY + 8 + i * 17;
  doc.fillColor(r.c).fontSize(8).font("Helvetica-Bold").text("—", rx, ry, { lineBreak: false });
  doc.fillColor(C.lightGray).fontSize(8).font("Helvetica").text(r.l, rx + 12, ry, { lineBreak: false });
  doc.fillColor(r.c).fontSize(8).font("Helvetica-Bold").text(r.v, doc.page.width - MARGIN - 60, ry, { lineBreak: false });
});
doc.y = revY + 90;

doc.rect(MARGIN, doc.y, CONTENT_W, 24).fill(C.accent + "25");
doc.fillColor(C.white).fontSize(10).font("Helvetica-Bold").text("POTENCIAL ECONÔMICO ANUALIZADO (ANO 1):", MARGIN + 10, doc.y + 7, { lineBreak: false });
doc.fillColor(C.accentGold).fontSize(14).font("Helvetica-Bold").text("R$ 18,48B+", doc.page.width - MARGIN - 80, doc.y - 3, { lineBreak: false });
doc.y += 34;

body("Nota: Se os clientes entram progressivamente ao longo do ano, a receita de créditos e taxas de lançamento realizadas no primeiro ano pode variar conforme o mês de entrada. Os números acima refletem o run-rate anualizado ao atingir 1M de clientes ativos.");

pageFooter(9, 18);

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 10 — VALUATION FRAMEWORK
// ─────────────────────────────────────────────────────────────────────────────
newPage();
doc.fillColor(C.gray).fontSize(8).font("Helvetica-Bold")
  .text("NEXOS AI · GROWTH EXECUTION INFRASTRUCTURE", MARGIN, 14, { lineBreak: false });
doc.fillColor(C.gray).fontSize(8).font("Helvetica")
  .text("STRICTLY PRIVATE & CONFIDENTIAL", doc.page.width - MARGIN - 130, 14, { lineBreak: false });
doc.moveDown(2);

sectionTitle("09", "Valuation Framework");
body("Valuation depende de como o mercado classifica o NexOS.");
doc.moveDown(0.6);

subTitle("9.1 — Como SaaS tradicional");
body("O BVP Nasdaq Emerging Cloud Index mostra múltiplo médio de receita de aproximadamente 6,3x. Aplicando múltiplos conservadores ao run-rate de R$12B em créditos:");
doc.moveDown(0.3);
tableRow(["Classificação", "Múltiplo", "Valuation (base créditos)"], [180, 100, 215], true);
tableRow(["SaaS conservador", "6x receita", "R$ 72B"], [180, 100, 215], false, "blue");
tableRow(["SaaS agressivo", "10x receita", "R$ 120B"], [180, 100, 215], false, "blue");

doc.moveDown(0.5);
subTitle("9.2 — Como AI-native high-growth platform");
body("Para uma plataforma AI-native com crescimento extremo, consumo recorrente, retenção e dominância de categoria, a faixa de múltiplos passa a refletir escassez, categoria e mercado capturado:");
doc.moveDown(0.3);
tableRow(["Múltiplo", "Base ARR", "Valuation"], [100, 180, 215], true);
tableRow(["15x receita", "R$ 12B ARR", "R$ 180B"], [100, 180, 215], false, "blue");
tableRow(["20x receita", "R$ 12B ARR", "R$ 240B"], [100, 180, 215], false, "yellow");
tableRow(["25x receita", "R$ 12B ARR", "R$ 300B"], [100, 180, 215], false, "yellow");
tableRow(["40x receita", "R$ 12B ARR", "R$ 480B"], [100, 180, 215], false, "orange");

doc.moveDown(0.5);
subTitle("9.3 — Como Growth Infrastructure");
body("Se o mercado classifica NexOS como infraestrutura de crescimento empresarial, a avaliação passa a ser feita em função da dependência econômica criada — a plataforma deixa de vender software e passa a capturar parte do orçamento de marketing, agências, tráfego, vídeo, design, copywriting, automação, sales enablement e creator monetization:");
doc.moveDown(0.3);
tableRow(["Cenário estratégico", "Valuation"], [250, 245], true);
tableRow(["R$ 12B ARR × 50x", "R$ 600B"], [250, 245], false, "green");
tableRow(["R$ 12B ARR × 75x", "R$ 900B"], [250, 245], false, "yellow");
tableRow(["R$ 12B ARR × 100x", "R$ 1,2T"], [250, 245], false, "orange");

doc.moveDown(0.5);

const infraY = doc.y;
doc.rect(MARGIN, infraY, CONTENT_W, 24).fill(C.accent + "15");
doc.rect(MARGIN, infraY, 3, 24).fill(C.accentGold);
doc.fillColor(C.accentGold).fontSize(8).font("Helvetica-Bold")
  .text("Esse valuation exige que o mercado veja o NexOS como camada operacional indispensável, não como software de marketing.", MARGIN + 10, infraY + 8, { width: CONTENT_W - 20 });
doc.y = infraY + 34;

subTitle("9.4 — Base de receita expandida (ecossistema completo)");
body("Com a inclusão das taxas de lançamento (R$1,49B) e receita da Academy (R$1B), a base de ARR para aplicação de múltiplos sobe para ~R$14,5B — expandindo todos os cenários de valuation acima em ~20%.");
doc.moveDown(0.3);
tableRow(["Múltiplo", "Base expandida (R$14,5B ARR)", "Valuation expandido"], [120, 220, 155], true);
tableRow(["25x", "R$ 14,5B ARR", "R$ 362B"], [120, 220, 155], false, "yellow");
tableRow(["50x", "R$ 14,5B ARR", "R$ 725B"], [120, 220, 155], false, "orange");
tableRow(["100x", "R$ 14,5B ARR", "R$ 1,45T"], [120, 220, 155], false, "red");

pageFooter(10, 18);

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 11 — PATH TO TRILLION
// ─────────────────────────────────────────────────────────────────────────────
newPage();
doc.fillColor(C.gray).fontSize(8).font("Helvetica-Bold")
  .text("NEXOS AI · GROWTH EXECUTION INFRASTRUCTURE", MARGIN, 14, { lineBreak: false });
doc.fillColor(C.gray).fontSize(8).font("Helvetica")
  .text("STRICTLY PRIVATE & CONFIDENTIAL", doc.page.width - MARGIN - 130, 14, { lineBreak: false });
doc.moveDown(2);

sectionTitle("10", "Path to Trillion-Dollar Valuation");
body("A tese de trilhões não vem de 1 milhão de clientes isoladamente — 1 milhão de clientes é a prova de categoria. A tese de trilhões vem quando o mercado projeta que o NexOS será infraestrutura global.");
doc.moveDown(0.6);

subTitle("10.1 — Cenário de expansão global (50M clientes)");
body("PREMISSA: 50 milhões de clientes ativos globais · R$1.000/mês de consumo médio · Receita ≈ R$600B/ano ≈ US$120B ARR (câmbio ilustrativo R$5/USD)");
doc.moveDown(0.3);
tableRow(["Múltiplo sobre ARR", "Valuation"], [250, 245], true);
tableRow(["US$ 120B ARR × 25x", "US$ 3T"], [250, 245], false, "yellow");
tableRow(["US$ 120B ARR × 40x", "US$ 4,8T"], [250, 245], false, "orange");

doc.moveDown(0.5);
subTitle("10.2 — Cenário de 100 milhões de clientes globais");
body("100M × R$1.000 × 12 = R$1,2T/ano ≈ US$240B ARR");
doc.moveDown(0.3);
tableRow(["Múltiplo sobre ARR", "Valuation"], [250, 245], true);
tableRow(["US$ 240B ARR × 20x", "US$ 4,8T"], [250, 245], false, "orange");
tableRow(["US$ 240B ARR × 25x", "US$ 6T"], [250, 245], false, "red");

doc.moveDown(0.6);
quoteBlock("Nesse cenário, a marca de US$5T deixa de ser uma afirmação emocional e passa a ser uma consequência matemática de base global massiva, consumo recorrente, infraestrutura indispensável e múltiplos de plataforma dominante.");

sectionTitle("11", "Why NexOS Can Command Infrastructure Multiples");
body("Microsoft tornou-se indispensável porque o computador pessoal precisava de um sistema operacional e de produtividade. AWS tornou-se indispensável porque empresas precisavam de computação escalável. Stripe tornou-se indispensável porque negócios digitais precisavam processar pagamentos.");
doc.moveDown(0.5);
body("NexOS torna-se indispensável porque todo agente econômico precisa crescer.");
doc.moveDown(0.5);
body("Todo mundo vende, influencia, trabalha para quem vende, depende de clientes, depende de audiência, depende de autoridade, depende de conversão. O NexOS transforma isso em operação.");
doc.moveDown(0.5);
body("O mercado não adotará NexOS apenas porque ele é inteligente. O mercado adotará porque fazer sem NexOS será mais lento, mais caro, mais confuso e menos eficiente.");
doc.moveDown(0.5);
quoteBlock("Assim como qualquer pessoa pode escrever sem Word, qualquer empresa pode tentar crescer sem NexOS. Mas quando a alternativa é mais lenta, mais cara e mais frágil, o padrão muda.");

pageFooter(11, 18);

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 12 — STRATEGIC MOAT (+ MASTERPRINT)
// ─────────────────────────────────────────────────────────────────────────────
newPage();
doc.fillColor(C.gray).fontSize(8).font("Helvetica-Bold")
  .text("NEXOS AI · GROWTH EXECUTION INFRASTRUCTURE", MARGIN, 14, { lineBreak: false });
doc.fillColor(C.gray).fontSize(8).font("Helvetica")
  .text("STRICTLY PRIVATE & CONFIDENTIAL", doc.page.width - MARGIN - 130, 14, { lineBreak: false });
doc.moveDown(2);

sectionTitle("12", "Strategic Moat");
doc.moveDown(0.3);

const moats = [
  {
    n: "12.1",
    t: "Data Moat",
    d: "Cada campanha gera dados proprietários: criativos vencedores, públicos vencedores, objeções, timing, regiões, CPL, CPA, ROAS, conversão e retenção.",
    c: C.accent,
  },
  {
    n: "12.2",
    t: "Execution Moat",
    d: "Ferramentas geram ativos. NexOS executa. Execução cria dependência. Quanto mais o cliente executa, mais difícil é migrar.",
    c: C.accentBlue,
  },
  {
    n: "12.3",
    t: "Workflow Moat",
    d: "Quanto mais o cliente usa, mais o NexOS entende: produto, marca, público, campanhas, resultado, tom, oferta e histórico. Esse contexto acumulado é intransferível.",
    c: C.green,
  },
  {
    n: "12.4",
    t: "Proof Moat",
    d: "O auto-lançamento documentado vira case central. O lead não assiste uma promessa — ele vive a demonstração. Isso cria um loop de prova social que se auto-alimenta.",
    c: C.accentGold,
  },
  {
    n: "12.5",
    t: "Category Moat",
    d: "NexOS cria uma categoria: Growth Execution Infrastructure. Quem cria a categoria tende a capturar percepção de liderança permanente nela.",
    c: C.orange,
  },
];

moats.forEach((m) => {
  const moatY = doc.y;
  const h = 44;
  doc.rect(MARGIN, moatY, CONTENT_W / 2 - 3, h).fill(C.cardBg);
  doc.rect(MARGIN, moatY, 3, h).fill(m.c);
  doc.fillColor(C.gray).fontSize(7).font("Helvetica-Bold").text(m.n, MARGIN + 8, moatY + 6, { lineBreak: false });
  doc.fillColor(m.c).fontSize(8.5).font("Helvetica-Bold").text(m.t, MARGIN + 8, moatY + 16);
  doc.fillColor(C.lightGray).fontSize(7.5).font("Helvetica").text(m.d, MARGIN + 8, doc.y + 2, { width: CONTENT_W / 2 - 20 });
  doc.y = moatY + h + 6;
});

doc.moveDown(0.4);

const mpMoatY = doc.y;
doc.rect(MARGIN, mpMoatY, CONTENT_W, 60).fill(C.accentGold + "12");
doc.rect(MARGIN, mpMoatY, CONTENT_W, 2).fill(C.accentGold);
doc.rect(MARGIN, mpMoatY, 3, 60).fill(C.accentGold);
doc.fillColor(C.gray).fontSize(7).font("Helvetica-Bold").text("12.6 — NOVO · v2.0", MARGIN + 8, mpMoatY + 6, { lineBreak: false });
doc.fillColor(C.accentGold).fontSize(10).font("Helvetica-Bold").text("Proprietary Content Security Moat (Masterprint)", MARGIN + 8, mpMoatY + 18);
doc.fillColor(C.lightGray).fontSize(8).font("Helvetica").text(
  "Toda saída da plataforma — PDFs, guias, roteiros, estratégias, materiais exportados — carrega rastreabilidade forense nativa. Fingerprint único por usuário + registro completo de cadeia de custódia + cruzamento econômico via Asaas (CPF + device + IP) + exportação de dossiê jurídico. Nenhuma plataforma de SaaS de marketing no Brasil oferece isso. O Masterprint cria uma barreira de proteção de IP sem precedentes no setor.",
  MARGIN + 8, doc.y + 2, { width: CONTENT_W - 20 },
);
doc.y = mpMoatY + 70;

pageFooter(12, 18);

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 13 — INVESTOR CONCLUSION
// ─────────────────────────────────────────────────────────────────────────────
newPage();
doc.fillColor(C.gray).fontSize(8).font("Helvetica-Bold")
  .text("NEXOS AI · GROWTH EXECUTION INFRASTRUCTURE", MARGIN, 14, { lineBreak: false });
doc.fillColor(C.gray).fontSize(8).font("Helvetica")
  .text("STRICTLY PRIVATE & CONFIDENTIAL", doc.page.width - MARGIN - 130, 14, { lineBreak: false });
doc.moveDown(2);

sectionTitle("13", "Investor Conclusion");

body("NexOS AI é uma tese de infraestrutura. Não é uma tese de ferramenta.");
doc.moveDown(0.5);
body("O mercado não precisa de mais uma IA para escrever texto. O mercado precisa de uma camada que execute crescimento. NexOS entrega:");
doc.moveDown(0.4);

doc.rect(MARGIN, doc.y, CONTENT_W, 18).fill(C.cardBg);
doc.fillColor(C.accentBlue).fontSize(7.5).font("Helvetica-Oblique")
  .text("  planejamento · produção · direção · criativos · vídeos · tráfego · funil · segmentação · aquecimento · venda · remarketing · auditoria · aprendizado · escala",
    MARGIN + 6, doc.y + 5, { width: CONTENT_W - 12 });
doc.moveDown(1.4);

body("O primeiro grande case é o próprio NexOS: uma plataforma que se lança, se vende, documenta sua própria execução e transforma esse histórico em prova pública.");
doc.moveDown(0.5);

subTitle("O que tornou o NexOS uma tese mais sólida na v2.0:");
const v2Items = [
  ["Ecossistema de 5 produtos", "Funil completo — da isca grátis ao guia técnico. Múltiplas portas de entrada, múltiplas fontes de receita."],
  ["Modelo pay-per-execution", "R$497/lançamento (2º+) alinha receita ao sucesso do cliente — não é taxa arbitrária, é participação no resultado."],
  ["Masterprint Anti-Piracy", "Proteção forense de IP nativa — diferencial técnico sem precedente no setor de SaaS de marketing no Brasil."],
  ["64 agentes especializados", "7 departamentos completos — de mentalidade a vendas. Não é um chatbot; é uma equipe de especialistas de IA."],
  ["Trilhas de receita 6/8/10 dígitos", "Produto calibrado por meta de receita — não por tamanho de empresa. Qualquer pessoa pode usar, com qualquer objetivo."],
  ["Academy como produto autônomo", "R$3.900 de metodologia vendida separadamente — expansão de LTV sem custo marginal adicional."],
];

v2Items.forEach(([title, desc]) => {
  const iy = doc.y;
  doc.rect(MARGIN, iy, CONTENT_W, 26).fill(C.cardBg);
  doc.rect(MARGIN, iy, 3, 26).fill(C.accent);
  doc.fillColor(C.accent).fontSize(8).font("Helvetica-Bold").text(title, MARGIN + 10, iy + 5, { lineBreak: false });
  doc.fillColor(C.lightGray).fontSize(7.5).font("Helvetica").text(desc, MARGIN + 10, iy + 16, { width: CONTENT_W - 20 });
  doc.y = iy + 29;
});

doc.moveDown(0.8);

const concY = doc.y;
doc.rect(MARGIN, concY, CONTENT_W, 50).fill(C.accent + "15");
doc.rect(MARGIN, concY, CONTENT_W, 2).fill(C.accent);
doc.fillColor(C.white).fontSize(9).font("Helvetica-BoldOblique")
  .text('"Quanto vale uma ferramenta de marketing?" — essa não é a pergunta definitiva para investidores.', MARGIN + 15, concY + 8, { width: CONTENT_W - 25 });
doc.fillColor(C.accentBlue).fontSize(9).font("Helvetica-Bold")
  .text("A pergunta correta é: quanto vale a infraestrutura que torna crescimento empresarial executável, auditável, escalável e acessível para qualquer pessoa ou empresa?", MARGIN + 15, concY + 26, { width: CONTENT_W - 25 });
doc.y = concY + 60;

doc.moveDown(0.5);
body("A resposta é: vale o tamanho da camada econômica que ela passa a controlar.");
doc.moveDown(1);

doc.fillColor(C.accent).fontSize(16).font("Helvetica-Bold").text("E essa camada é global.", MARGIN, doc.y, { width: CONTENT_W, align: "center" });
doc.moveDown(1.5);

doc.fillColor(C.gray).fontSize(7).font("Helvetica").text("NexOS AI · NXS-2026-001 · Prospect Paper v2.0 · Junho 2026 · STRICTLY PRIVATE & CONFIDENTIAL", MARGIN, doc.y, { width: CONTENT_W, align: "center" });

pageFooter(13, 18);

// ─────────────────────────────────────────────────────────────────────────────
// Finalize
// ─────────────────────────────────────────────────────────────────────────────
doc.end();
console.log(`✅ PDF gerado em: ${OUT_PATH}`);
