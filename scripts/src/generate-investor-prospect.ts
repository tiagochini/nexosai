import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

const OUT_PATH = path.resolve("NexOS_AI_Investor_Prospect_v2.pdf");
const doc = new PDFDocument({
  size: "A4",
  margin: 56,
  info: {
    Title: "NexOS AI — Investor & Early Adopter Prospect Paper v2.0",
    Author: "NexOS AI",
    Subject: "Growth Execution Infrastructure — Business Plan · White Paper · Investment Thesis",
    Keywords: "NexOS AI, investor, prospect, growth execution, AI agents",
  },
});
doc.pipe(fs.createWriteStream(OUT_PATH));

// ─── PALETTE — White page · Deep navy content ───────────────────────────────
const C = {
  page:      "#ffffff",
  navy:      "#0d1f3c",   // primary headlines, heavy text
  navyMid:   "#1e3a5f",   // subheads, strong body
  navyLight: "#2d5282",   // table headers, secondary accents
  slate:     "#4a5568",   // body copy
  slateLight:"#718096",   // captions, footnotes
  rule:      "#cbd5e0",   // horizontal rules, table borders
  tint:      "#f0f4f8",   // card backgrounds, alternating rows
  tintDark:  "#e2e8f0",   // stronger tint, header rows
  gold:      "#b7791f",   // financial callouts only
  goldLight: "#fef3c7",   // gold tint background
  white:     "#ffffff",
};

const W     = 595.28;
const H     = 841.89;
const ML    = 56;
const MR    = 56;
const CW    = W - ML - MR;       // 483.28

// ─── PRIMITIVES ──────────────────────────────────────────────────────────────

function pageBg() {
  doc.rect(0, 0, W, H).fill(C.page);
}

function rule(y?: number, weight = 0.5, color = C.rule) {
  const yy = y ?? doc.y;
  doc.moveTo(ML, yy).lineTo(W - MR, yy).strokeColor(color).lineWidth(weight).stroke();
  doc.y = yy + 7;
}

function thinRule(y?: number) { rule(y, 0.3, C.rule); }

function h1(text: string) {
  doc.moveDown(0.6);
  doc.fillColor(C.navy).fontSize(20).font("Helvetica-Bold").text(text, ML, doc.y);
  doc.moveDown(0.25);
  rule(undefined, 1, C.navy);
}

function h2(numStr: string, text: string) {
  doc.moveDown(0.8);
  const y = doc.y;
  doc.fillColor(C.navyLight).fontSize(7.5).font("Helvetica-Bold")
    .text(numStr, ML, y, { lineBreak: false });
  doc.fillColor(C.navy).fontSize(11.5).font("Helvetica-Bold")
    .text(text, ML + 24, y);
  doc.moveDown(0.2);
  rule(undefined, 0.7, C.navyLight);
}

function h3(text: string) {
  doc.moveDown(0.45);
  doc.fillColor(C.navyMid).fontSize(9).font("Helvetica-Bold").text(text, ML);
  doc.moveDown(0.12);
}

function body(text: string, indent = 0, lineGap = 1.5) {
  doc.fillColor(C.slate).fontSize(8.5).font("Helvetica")
    .text(text, ML + indent, doc.y, { width: CW - indent, lineGap });
}

function caption(text: string) {
  doc.fillColor(C.slateLight).fontSize(7).font("Helvetica").text(text, ML, doc.y, { width: CW, lineGap: 1 });
}

function highlight(text: string) {
  doc.moveDown(0.4);
  const y = doc.y;
  const h = 32;
  doc.rect(ML, y, CW, h).fill(C.tint);
  doc.rect(ML, y, 3, h).fill(C.navyLight);
  doc.fillColor(C.navyMid).fontSize(8.5).font("Helvetica-BoldOblique")
    .text(text, ML + 12, y + (h - 10) / 2, { width: CW - 16, lineGap: 1.5 });
  doc.y = y + h + 8;
}

function goldBlock(label: string, text: string) {
  doc.moveDown(0.4);
  const y = doc.y;
  const h = 36;
  doc.rect(ML, y, CW, h).fill(C.goldLight);
  doc.rect(ML, y, 3, h).fill(C.gold);
  doc.fillColor(C.gold).fontSize(7).font("Helvetica-Bold").text(label, ML + 12, y + 5, { lineBreak: false });
  doc.fillColor(C.navyMid).fontSize(8.5).font("Helvetica-Bold")
    .text(text, ML + 12, y + 16, { width: CW - 20, lineGap: 1.5 });
  doc.y = y + h + 8;
}

// ─── TABLE ───────────────────────────────────────────────────────────────────

function tableHeader(cols: string[], widths: number[]) {
  const y = doc.y;
  const totalW = widths.reduce((a, b) => a + b, 0);
  doc.rect(ML, y, totalW, 17).fill(C.tintDark);
  let x = ML;
  cols.forEach((c, i) => {
    doc.fillColor(C.navyMid).fontSize(7.5).font("Helvetica-Bold")
      .text(c, x + 5, y + 5, { width: widths[i] - 10, lineBreak: false, ellipsis: true });
    x += widths[i];
  });
  doc.moveTo(ML, y + 17).lineTo(ML + totalW, y + 17).strokeColor(C.rule).lineWidth(0.4).stroke();
  doc.y = y + 17;
}

function tableRow(cols: string[], widths: number[], shade = false, accent?: "gold") {
  const y = doc.y;
  const rowH = 14;
  const totalW = widths.reduce((a, b) => a + b, 0);
  const bg = accent === "gold" ? C.goldLight : (shade ? C.tint : C.white);
  doc.rect(ML, y, totalW, rowH).fill(bg);
  let x = ML;
  cols.forEach((c, i) => {
    const color = accent === "gold" ? C.gold : C.slate;
    doc.fillColor(color).fontSize(7.5).font("Helvetica")
      .text(c, x + 5, y + 3, { width: widths[i] - 10, lineBreak: false, ellipsis: true });
    x += widths[i];
  });
  doc.moveTo(ML, y + rowH).lineTo(ML + totalW, y + rowH).strokeColor(C.rule).lineWidth(0.2).stroke();
  doc.y = y + rowH;
}

// ─── KPI CARD STRIP ──────────────────────────────────────────────────────────

function kpiStrip(items: { label: string; value: string; sub?: string }[]) {
  const cardW = CW / items.length - 4;
  const y = doc.y;
  items.forEach((item, i) => {
    const cx = ML + i * (cardW + (4 * items.length) / items.length);
    doc.rect(cx, y, cardW, 50).fill(C.tint);
    doc.rect(cx, y, cardW, 2).fill(C.navyLight);
    doc.fillColor(C.slateLight).fontSize(6.5).font("Helvetica-Bold")
      .text(item.label, cx + 8, y + 8, { width: cardW - 16, lineBreak: false });
    doc.fillColor(C.navy).fontSize(14).font("Helvetica-Bold")
      .text(item.value, cx + 8, y + 20, { width: cardW - 16, lineBreak: false });
    if (item.sub) {
      doc.fillColor(C.slateLight).fontSize(6).font("Helvetica")
        .text(item.sub, cx + 8, y + 38, { width: cardW - 16, lineBreak: false });
    }
  });
  doc.y = y + 60;
}

// ─── PAGE HEADER / FOOTER ────────────────────────────────────────────────────

function pageHeader(section: string) {
  doc.fillColor(C.slateLight).fontSize(7).font("Helvetica")
    .text("NEXOS AI  ·  GROWTH EXECUTION INFRASTRUCTURE", ML, 20, { lineBreak: false });
  doc.fillColor(C.slateLight).fontSize(7).font("Helvetica")
    .text(section, W - MR - 140, 20, { lineBreak: false, align: "right", width: 140 });
  doc.moveTo(ML, 32).lineTo(W - MR, 32).strokeColor(C.rule).lineWidth(0.3).stroke();
  doc.y = 46;
}

function pageFooter(n: number, total: number) {
  const fy = H - 30;
  doc.moveTo(ML, fy - 5).lineTo(W - MR, fy - 5).strokeColor(C.rule).lineWidth(0.3).stroke();
  doc.fillColor(C.slateLight).fontSize(6.5).font("Helvetica")
    .text("NXS-2026-001  ·  Prospect Paper v2.0  ·  STRICTLY PRIVATE & CONFIDENTIAL", ML, fy);
  doc.fillColor(C.slateLight).fontSize(6.5).font("Helvetica")
    .text(`${n} / ${total}`, W - MR - 20, fy, { lineBreak: false });
}

function newPage(section = "STRICTLY PRIVATE & CONFIDENTIAL") {
  doc.addPage();
  pageBg();
  pageHeader(section);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 1 — COVER
// ═══════════════════════════════════════════════════════════════════════════════
pageBg();

// Top navy bar
doc.rect(0, 0, W, 180).fill(C.navy);

// Confidentiality strip
doc.fillColor("#ffffff40").fontSize(7).font("Helvetica-Bold")
  .text("STRICTLY PRIVATE & CONFIDENTIAL", ML, 16, { lineBreak: false });
doc.fillColor("#ffffff40").fontSize(7).font("Helvetica")
  .text("NXS / 2026", W - MR - 40, 16, { lineBreak: false });

// Logo
doc.fillColor(C.white).fontSize(44).font("Helvetica-Bold").text("NEXOS AI", ML, 42);
doc.fillColor("#94a3b8").fontSize(10).font("Helvetica-Bold")
  .text("GROWTH EXECUTION INFRASTRUCTURE", ML, 96);

// Divider
doc.moveTo(ML, 118).lineTo(W - MR, 118).strokeColor("#ffffff30").lineWidth(0.6).stroke();

// Subtitle
doc.fillColor(C.white).fontSize(14).font("Helvetica-Bold")
  .text("Investor & Early Adopter Prospect Paper", ML, 128);
doc.fillColor("#94a3b8").fontSize(8).font("Helvetica")
  .text("Business plan  ·  White paper  ·  Investment thesis  ·  Economic model & strategic valuation framework", ML, 148);

// White section — meta
doc.rect(0, 180, W, 120).fill(C.tint);

const metaItems = [
  { l: "DOCUMENTO", v: "NXS-2026-001", s: "Junho de 2026" },
  { l: "VERSÃO", v: "v 2.0", s: "Atualizado — Ecossistema + Masterprint" },
  { l: "CLASSIFICAÇÃO", v: "Confidencial", s: "Investidores & Early Adopters convidados" },
];
const mW = CW / 3 - 8;
metaItems.forEach((m, i) => {
  const cx = ML + i * (mW + 12);
  const cy = 188;
  doc.rect(cx, cy, mW, 48).fill(C.white);
  doc.rect(cx, cy, mW, 2).fill(C.navyLight);
  doc.fillColor(C.slateLight).fontSize(6.5).font("Helvetica-Bold").text(m.l, cx + 8, cy + 8);
  doc.fillColor(C.navy).fontSize(11).font("Helvetica-Bold").text(m.v, cx + 8, cy + 20);
  doc.fillColor(C.slateLight).fontSize(6).font("Helvetica").text(m.s, cx + 8, cy + 35);
});

doc.y = 310;

// KPI strip
kpiStrip([
  { label: "AGENTES DE IA", value: "64", sub: "7 departamentos especializados" },
  { label: "PRODUTOS NO ECOSSISTEMA", value: "5", sub: "Do lead gratuito ao guia técnico" },
  { label: "TRILHAS DE RECEITA", value: "3", sub: "6 · 8 · 10 dígitos" },
  { label: "MISSÃO ANO 1", value: "1.000.000", sub: "Clientes ativos" },
]);

doc.y = 382;

// TOC
doc.fillColor(C.slateLight).fontSize(7).font("Helvetica-Bold").text("ÍNDICE", ML, doc.y);
doc.moveDown(0.4);

const toc = [
  ["—", "Sumário Executivo", "2"],
  ["01", "Executive Investment Thesis", "3"],
  ["02", "Market Context", "3"],
  ["03", "The Structural Market Problem", "4"],
  ["04", "Product Definition & Ecosystem", "4"],
  ["05", "Core Product Capabilities (64 agentes · Masterprint)", "5–6"],
  ["06", "Economic Model v2.0 — Atualizado", "7"],
  ["07", "Year 1 Growth Mission", "8"],
  ["08", "Revenue Projection — 1M Customers", "9"],
  ["09", "Valuation Framework", "10"],
  ["10", "Path to Trillion-Dollar Valuation", "11"],
  ["11", "Why NexOS Commands Infrastructure Multiples", "11"],
  ["12", "Strategic Moat (+ 12.6 Masterprint Security)", "12"],
  ["13", "Investor Conclusion", "13"],
];

toc.forEach(([num, title, pg]) => {
  const ty = doc.y;
  doc.fillColor(C.navyLight).fontSize(7).font("Helvetica-Bold").text(num, ML, ty, { lineBreak: false });
  doc.fillColor(C.slate).fontSize(7).font("Helvetica").text(title, ML + 22, ty, { lineBreak: false });
  doc.fillColor(C.slateLight).fontSize(7).text(pg, W - MR - 18, ty, { lineBreak: false });
  doc.moveTo(ML + 22, ty + 9.5).lineTo(W - MR - 22, ty + 9.5)
    .strokeColor(C.rule).lineWidth(0.2).stroke();
  doc.y = ty + 12;
});

pageFooter(1, 13);

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 2 — LEGAL NOTICE + EXECUTIVE SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════
newPage("AVISO LEGAL & SUMÁRIO EXECUTIVO");

h2("—", "Aviso Legal");
h3("Confidencialidade & Declarações Prospectivas");
body("Este documento é fornecido em caráter estritamente confidencial, exclusivamente para fins de avaliação por investidores qualificados e early adopters convidados da NexOS AI. Sua reprodução, distribuição ou divulgação, total ou parcial, a terceiros não autorizados é vedada sem consentimento prévio por escrito.");
doc.moveDown(0.4);
body("As informações aqui apresentadas — incluindo projeções de receita, cenários de valuation, premissas de crescimento e estimativas de mercado — têm natureza prospectiva e ilustrativa. Elas refletem premissas internas da NexOS AI sobre execução, adoção e dinâmica de mercado, e não constituem garantia de resultados futuros, recomendação de investimento ou oferta de venda de valores mobiliários.");
doc.moveDown(0.4);
body("Resultados reais podem diferir materialmente em função de dinâmica competitiva, capacidade de execução, regulação, condições macroeconômicas e adoção de mercado. Ao prosseguir com a leitura, o destinatário concorda em tratar o conteúdo como informação confidencial, nos termos de eventual NDA firmado com a NexOS AI.");

doc.moveDown(0.6);
h2("—", "Sumário Executivo");
h3("Uma tese de infraestrutura, não de ferramenta");
body("NexOS AI transforma intenção empresarial em execução comercial completa — da ideia ao produto, da campanha à venda, do lead ao remarketing — substituindo a fragmentação do mercado de growth por uma operação integrada, auditável e automatizada por IA.");
doc.moveDown(0.4);
body("O mercado endereçável combina publicidade digital, MarTech, creator economy e automação de processos — juntos, mercados multibilionários em expansão acelerada. A tese central: se toda empresa precisa vender, crescer, aparecer, converter ou influenciar, então toda empresa precisa de uma infraestrutura de crescimento. NexOS AI é essa infraestrutura.");

doc.moveDown(0.6);
kpiStrip([
  { label: "POTENCIAL ECONÔMICO ANUALIZADO — ANO 1", value: "R$ 18,48B+", sub: "Aquisição + taxas + run-rate créditos + Academy" },
  { label: "ARR ANUALIZADO DE CRÉDITOS (1M CLIENTES)", value: "R$ 12B", sub: "Consumo médio R$1.000/mês/cliente" },
  { label: "FAIXA DE VALUATION — EXPANSÃO GLOBAL", value: "US$ 3T – 6T", sub: "Cenário 50–100M clientes ativos" },
]);

highlight("A pergunta correta não é 'quanto vale uma ferramenta de marketing?'. A pergunta é: quanto vale a infraestrutura que torna o crescimento empresarial executável, auditável, escalável e acessível para qualquer pessoa ou empresa?");

pageFooter(2, 13);

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 3 — INVESTMENT THESIS + MARKET CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════
newPage("01–02  INVESTMENT THESIS  ·  MARKET CONTEXT");

h2("01", "Executive Investment Thesis");
body("NexOS AI não é uma ferramenta de marketing. NexOS AI é uma infraestrutura operacional de crescimento. A plataforma transforma intenção empresarial em execução comercial completa:");
doc.moveDown(0.35);
highlight("ideia → produto → oferta → campanha → criativos → vídeos → anúncios → audiência → leads → aquecimento → carrinho → vendas → remarketing → aprendizado → próxima campanha");
body("O valor do NexOS não está em gerar textos, imagens ou páginas. O valor está em executar crescimento.");
doc.moveDown(0.4);
body("O mercado atual é fragmentado. Empresas precisam coordenar copywriters, designers, editores, estrategistas, gestores de tráfego, analistas, agências, ferramentas de CRM, SEO, automação, funis e vídeo. O NexOS substitui essa fragmentação por uma operação integrada, auditável e automatizada.");
doc.moveDown(0.35);
goldBlock("TESE CENTRAL", "Se toda empresa precisa vender, crescer, aparecer, converter ou influenciar, então toda empresa precisa de uma infraestrutura de crescimento. NexOS AI é essa infraestrutura.");

h2("02", "Market Context");
body("O NexOS atua na interseção de mercados gigantescos. Aquisição de atenção já é uma das maiores linhas de gasto empresarial do mundo, enquanto empresas migram aceleradamente para infraestrutura de marketing, personalização e automação.");
doc.moveDown(0.4);

tableHeader(["Mercado", "Tamanho atual", "Projeção"], [210, 130, 143]);
tableRow(["Advertising (global)", "—", "~US$ 1,26T (2026)"], [210, 130, 143], false);
tableRow(["Digital Advertising", "US$ 567,9B (2025)", "US$ 1,69T (2033)"], [210, 130, 143], true);
tableRow(["MarTech", "US$ 551,9B (2025)", "US$ 2,38T (2033)"], [210, 130, 143], false);
tableRow(["Creator Economy", "—", "~US$ 480B (2027)"], [210, 130, 143], true);
tableRow(["Intelligent Process Automation", "US$ 14,55B (2024)", "US$ 44,74B (2030)"], [210, 130, 143], false);

doc.moveDown(0.4);
caption("Fontes: estimativas de mercado consolidadas — Advertising, MarTech, Creator Economy (Goldman Sachs) e Automação de Processos.");
doc.moveDown(0.3);
body("O NexOS não pertence apenas a um desses mercados. Ele captura valor em todos: MarTech · Digital Advertising · Creator Economy · AI Agents · Business Automation · Sales Enablement · Video Production · Funnel Infrastructure · Campaign Execution · Regional Growth & Affiliate Distribution.");

pageFooter(3, 13);

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 4 — STRUCTURAL PROBLEM + PRODUCT ECOSYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
newPage("03–04  STRUCTURAL PROBLEM  ·  PRODUCT ECOSYSTEM");

h2("03", "The Structural Market Problem");
body("O problema global não é falta de ferramentas. O problema é que as ferramentas não executam a cadeia inteira.");
doc.moveDown(0.4);

const problems = [
  { t: "SEO", d: "Gera tráfego, mas não cria produto, não cria oferta, não grava vídeos, não monta lançamento, não abre carrinho e não faz remarketing." },
  { t: "CRM", d: "Organiza contatos, mas não cria os contatos, não aquece audiência, não cria desejo e não fecha vendas." },
  { t: "Landing builders", d: "Criam páginas, mas não sabem qual oferta converte, qual público atingir, qual narrativa usar ou qual timing de lançamento aplicar." },
  { t: "AI content tools", d: "Criam textos, imagens e vídeos, mas dependem de alguém para decidir estratégia, campanha, público, distribuição, aprovação, agenda e execução." },
  { t: "Agências", d: "Executam, mas são caras, lentas, limitadas por agenda, capacidade operacional, reuniões, retrabalho e custo proporcional." },
];

problems.forEach((p) => {
  const y = doc.y;
  doc.rect(ML, y, CW, 26).fill(C.tint);
  doc.rect(ML, y, 2, 26).fill(C.navyLight);
  doc.fillColor(C.navy).fontSize(8).font("Helvetica-Bold").text(p.t, ML + 10, y + 4, { lineBreak: false });
  doc.fillColor(C.slate).fontSize(7.5).font("Helvetica").text(p.d, ML + 10, y + 15, { width: CW - 20 });
  doc.y = y + 29;
});

goldBlock("NEXOS", "NexOS elimina a fragmentação. O NexOS não pergunta apenas 'o que você quer criar?' — O que você quer conquistar? E executa a operação.");

h2("04", "Product Definition & Ecosystem — v2.0");
body("NexOS AI opera como um AI-Powered Growth Execution Operating System e se posiciona no mercado através de um ecossistema de 5 produtos em funil ascendente:");
doc.moveDown(0.4);

tableHeader(["Produto", "Preço Regular", "Preço Lançamento", "Modelo de Acesso"], [165, 90, 100, 128]);
tableRow(["Isca — Os 7 Erros Fatais que Matam Lançamentos", "Gratuito", "Gratuito", "PDF via WhatsApp + grupo"], [165, 90, 100, 128], false);
tableRow(["Tripwire — Primeiros R$10K em 30 Dias", "R$ 290", "R$ 97", "Mini-guia digital"], [165, 90, 100, 128], true);
tableRow(["NexOS AI Solo", "R$ 15.990", "R$ 3.990", "Vitalício · sem mensalidade"], [165, 90, 100, 128], false);
tableRow(["NexOS AI Agency", "R$ 14.000", "R$ 9.990", "10 campanhas · white-label vitalício"], [165, 90, 100, 128], true);
tableRow(["NexOS Academy", "R$ 3.900", "R$ 2.500", "Metodologia · incluso no NexOS AI"], [165, 90, 100, 128], false);
tableRow(["NexOS Connect — Guia de APIs", "R$ 297", "R$ 197", "Guia técnico de integrações"], [165, 90, 100, 128], true);

doc.moveDown(0.3);
body("Taxa por execução: o primeiro lançamento é gratuito. A partir do 2.º lançamento executado na plataforma, o modelo prevê R$ 497 por lançamento — alinhando a receita do NexOS ao crescimento real do cliente (pay per execution).");

pageFooter(4, 13);

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 5 — CORE CAPABILITIES 5.1–5.9
// ═══════════════════════════════════════════════════════════════════════════════
newPage("05  CORE PRODUCT CAPABILITIES");

h2("05", "Core Product Capabilities");

h3("5.1 — NexOS Command Agent — Diretor Geral de IA (64 agentes · 7 departamentos)");
body("O NexOS opera com um Diretor Geral de IA que orquestra 64 agentes especializados. O usuário não escolhe agentes — o sistema convoca cada agente no momento correto.");
doc.moveDown(0.35);

tableHeader(["Departamento", "Agentes"], [175, 308]);
[
  ["Estratégia & Planejamento", "Strategy · Command · Profile Builder · Market Intel · Offer · Pricing Psychologist"],
  ["Conteúdo & Copy", "Copywriter · Creative Director · VSL · CPL · Social Media · Ad Copy · Landing Page · Hook Factory"],
  ["Audiência & Tráfego", "Targeting · Media Buyer · Organic Traffic · A/B Test Designer · Compliance"],
  ["Vídeo & Criativos", "Video Director · Creative Concept · Ad Critic · Stories Sequence · Video Hook"],
  ["Analytics & Otimização", "Analytics · Optimization · Launch Debriefing · Scarcity Engineer"],
  ["Automação & Vendas", "Sales Warmer · Sales Closer · Sales Desire · Sales Objection · Sales Consultant · Affiliate · Reengagement"],
  ["Mentalidade & Crescimento", "Mental Frequency Coach · Identity Architect · Obstinacy Trainer · Creator Growth"],
].forEach(([d, a], i) => tableRow([d, a], [175, 308], i % 2 === 1));

doc.moveDown(0.5);
h3("5.2 — Live Production Display");
body("Frontend exibe produção em tempo real — o usuário vê estratégia sendo escrita, criativos sendo criados, vídeos sendo planejados, públicos sendo definidos e decisões sendo registradas. Tudo vira log auditável: cria percepção de valor, confiança e prova operacional.");

doc.moveDown(0.4);
h3("5.3 — Video Production Engine");
tableHeader(["Modo", "O que o NexOS executa"], [100, 383]);
tableRow(["Com aparição", "Roteiro, cenário, enquadramento, iluminação, tom, gravação orientada, corte automático, legendas, B-roll, trilha, versões."], [100, 383], false);
tableRow(["Sem aparição", "Avatar digital, voz clonada, apresentador sintético, motion graphics, vídeos IA, narração automatizada."], [100, 383], true);
tableRow(["Modelo híbrido", "Imagem real, avatar parcial, voz clonada, cenas complementares, edição por IA."], [100, 383], false);

doc.moveDown(0.4);
h3("5.4 — Campaign Type Engine");
body("Identifica tipo de campanha — lançamento, branding, autoridade regional, vendas contínuas, remarketing, upsell, crescimento de audiência, creator monetization. O usuário escolhe o objetivo; a IA escolhe a arquitetura.");

doc.moveDown(0.4);
h3("5.5 — Launch Engine · Trilhas de Receita");
highlight("captação → aquecimento → autoridade → desejo → oferta → escassez → abertura de carrinho → fechamento → remarketing → prova social → próximo ciclo");
tableHeader(["Trilha", "Meta em 7 dias", "Agentes ativos"], [100, 130, 253]);
tableRow(["6 Dígitos", "R$ 100K – R$ 999K", "Strategy + Launch + Copy + Traffic (stack completo)"], [100, 130, 253], false);
tableRow(["8 Dígitos", "R$ 10M – R$ 99M", "Full stack: todos os agentes + tracking avançado"], [100, 130, 253], true);
tableRow(["10 Dígitos", "R$ 100M+", "Infraestrutura completa + agency track + white-label"], [100, 130, 253], false);

doc.moveDown(0.4);
h3("5.6 — Self-Proof Engine");
body("O maior case do NexOS é ele próprio. O NexOS se lança, documenta seu próprio lançamento e grava suas próprias telas. O lead não assiste uma promessa — ele vive a demonstração. Esse é o maior mecanismo de prova social.");

doc.moveDown(0.4);
h3("5.7–5.8 — Paid Traffic & Algorithm Intelligence · Adaptive Interface");
body("Tráfego pago: agentes atuam em profundidade sobre sinais de entrega, otimização de lance, janelas de aprendizado, segmentação dinâmica e comportamento de leilão. Interface: dois modos — Fundador (simples, guiado) e Arquiteto (técnico, granular). Switch a qualquer momento.");

pageFooter(5, 13);

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 6 — MASTERPRINT ANTI-PIRACY SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
newPage("05.10  MASTERPRINT ANTI-PIRACY SYSTEM");

h2("05.10", "Masterprint Anti-Piracy System — NOVO · v2.0");

doc.moveDown(0.2);
doc.rect(ML, doc.y, CW, 22).fill(C.tintDark);
doc.rect(ML, doc.y, 3, 22).fill(C.gold);
doc.fillColor(C.navy).fontSize(9).font("Helvetica-Bold")
  .text("Proteção forense nativa de propriedade intelectual gerada na plataforma", ML + 12, doc.y + 7, { lineBreak: false });
doc.y += 30;

body("O NexOS protege toda propriedade intelectual gerada na plataforma com rastreamento forense de documentos. Cada PDF, guia, roteiro, estratégia ou material exportado recebe um fingerprint único e invisível — permitindo identificação do vazador em caso de distribuição não autorizada.");
doc.moveDown(0.4);

tableHeader(["Componente", "Descrição"], [155, 328]);
tableRow(["Fingerprint único", "Código NXS-XXXX-XXXX embutido por download — invisível ao usuário final, único por titular"], [155, 328], false);
tableRow(["Cadeia de custódia", "Registro completo: userId · email · nome · IP · user-agent · workspace · campanha · timestamp"], [155, 328], true);
tableRow(["Admin lookup", "Código extraído de arquivo vazado → identificação imediata do titular original"], [155, 328], false);
tableRow(["Cross-referência econômica", "CPF Asaas + device fingerprint + padrão de IP → identifica culpado mesmo com cadastro fraudulento"], [155, 328], true);
tableRow(["Dossiê jurídico", "Exportação estruturada para notificação legal — LGPD Art. 42 + Marco Civil da Internet"], [155, 328], false);
tableRow(["Alertas automáticos", "Sistema detecta mesmo documento em múltiplos IPs distintos e notifica o admin em tempo real"], [155, 328], true);

doc.moveDown(0.5);
goldBlock("DIFERENCIAL COMPETITIVO", "Nenhuma plataforma de SaaS de marketing no Brasil oferece rastreabilidade forense nativa de documentos gerados. O Masterprint cria uma barreira de proteção de IP sem precedentes no setor.");

doc.moveDown(0.3);
h3("5.9 — Landing Page, Domain & Hosting Engine");
body("O NexOS cria a landing page completa de cada campanha sem que o usuário precise desenvolver ou configurar nada manualmente. A plataforma auxilia na aquisição e hospedagem do domínio com integração nativa.");

doc.moveDown(0.5);
rule(undefined, 0.5, C.rule);

doc.moveDown(0.3);
doc.fillColor(C.slateLight).fontSize(7.5).font("Helvetica-Bold").text("RESUMO DE CAPACIDADES — v2.0", ML);
doc.moveDown(0.3);

tableHeader(["Capability", "Status"], [340, 143]);
tableRow(["64 agentes de IA em 7 departamentos", "Ativo"], [340, 143], false);
tableRow(["Live Production Display (Socket.io real-time)", "Ativo"], [340, 143], true);
tableRow(["Video Production Engine (3 modos)", "Ativo"], [340, 143], false);
tableRow(["Launch Engine — trilhas 6/8/10 dígitos", "Ativo"], [340, 143], true);
tableRow(["Self-Proof Engine (auto-documentação)", "Ativo"], [340, 143], false);
tableRow(["Paid Traffic & Algorithm Intelligence", "Ativo"], [340, 143], true);
tableRow(["Adaptive Interface (Fundador / Arquiteto)", "Ativo"], [340, 143], false);
tableRow(["Masterprint Anti-Piracy System", "Ativo — NOVO v2.0"], [340, 143], true, "gold");
tableRow(["NexOS Connect — API Guide (produto standalone)", "Em desenvolvimento"], [340, 143], false);

pageFooter(6, 13);

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 7 — ECONOMIC MODEL v2.0
// ═══════════════════════════════════════════════════════════════════════════════
newPage("06  ECONOMIC MODEL  —  v2.0");

h2("06", "Economic Model — v2.0 (Atualizado)");
body("O modelo econômico é baseado em aquisição única + consumo por uso — mais próximo de infraestrutura operacional do que de assinatura fixa. Sem mensalidade. Sem recorrência forçada. O cliente consome mais quando opera mais, alinhando a receita do NexOS ao crescimento real do cliente.");

doc.moveDown(0.5);
h3("Aquisição — Ticket Único Vitalício");
tableHeader(["Plano", "Preço Regular (âncora)", "Preço Lançamento", "Campanhas", "Créditos incluídos"], [80, 120, 100, 90, 93]);
tableRow(["Solo", "R$ 15.990", "R$ 3.990", "3 campanhas", "900 cr (~2 lançamentos)"], [80, 120, 100, 90, 93], false);
tableRow(["Agency", "R$ 14.000", "R$ 9.990", "10 campanhas", "2.000 cr (~5 lançamentos)"], [80, 120, 100, 90, 93], true);

doc.moveDown(0.5);
h3("Taxa por Execução de Lançamento — Pay per Execution");

const payY = doc.y;
doc.rect(ML, payY, CW, 36).fill(C.tint);
doc.rect(ML, payY, 3, 36).fill(C.gold);
doc.fillColor(C.navyMid).fontSize(9).font("Helvetica-Bold").text("Primeiro lançamento: GRATUITO", ML + 12, payY + 6);
doc.fillColor(C.slate).fontSize(8).font("Helvetica")
  .text("A partir do 2.º lançamento executado na plataforma → R$ 497 por lançamento. Modelo pay-per-execution: a receita do NexOS só cresce quando o cliente executa.", ML + 12, payY + 20, { width: CW - 20 });
doc.y = payY + 44;

doc.moveDown(0.4);
h3("Créditos de IA — Consumo por Uso (preços atualizados v2.0)");
tableHeader(["Pacote", "Créditos", "Preço", "Equivalente", "Custo/crédito"], [70, 65, 75, 200, 73]);
tableRow(["Boost",   "500 cr",   "R$ 85",  "~1 lançamento pequeno",         "R$ 0,17/cr"], [70, 65, 75, 200, 73], false);
tableRow(["Starter", "1.500 cr", "R$ 239", "~3–4 lançamentos completos",    "R$ 0,16/cr"], [70, 65, 75, 200, 73], true);
tableRow(["Pro",     "3.500 cr", "R$ 529", "~8–9 lançamentos completos",    "R$ 0,15/cr"], [70, 65, 75, 200, 73], false);
tableRow(["Elite",   "7.000 cr", "R$ 979", "~17–18 lançamentos · agências", "R$ 0,14/cr"], [70, 65, 75, 200, 73], true);

doc.moveDown(0.5);
h3("Receita pelo Ecossistema Completo");
tableHeader(["Produto", "Preço", "Função econômica", "Recorrência"], [135, 75, 175, 98]);
tableRow(["Isca — Os 7 Erros Fatais",     "Grátis",       "Captura de lead qualificado",               "Topo de funil"], [135, 75, 175, 98], false);
tableRow(["Tripwire — Primeiros R$10K",   "R$ 97",        "Primeira transação · qualificação financeira", "Entrada no funil"], [135, 75, 175, 98], true);
tableRow(["NexOS AI (Solo / Agency)",     "R$3.990–9.990","Aquisição principal — ticket único vitalício",  "Uma vez"], [135, 75, 175, 98], false);
tableRow(["NexOS Academy",                "R$ 2.500",     "Metodologia — bônus incluso no NexOS AI",    "Junto ou separado"], [135, 75, 175, 98], true);
tableRow(["Taxa de lançamento",           "R$ 497",       "Pay-per-execution (2.º lançamento+)",        "Por uso"], [135, 75, 175, 98], false);
tableRow(["Créditos de IA",               "R$85–R$979",   "Consumo recorrente por uso operacional",     "Contínuo"], [135, 75, 175, 98], true);
tableRow(["NexOS Connect — API Guide",    "R$ 197",       "Guia técnico de integrações — standalone",   "Produto entry-level técnico"], [135, 75, 175, 98], false);

pageFooter(7, 13);

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 8 — YEAR 1 GROWTH MISSION
// ═══════════════════════════════════════════════════════════════════════════════
newPage("07  YEAR 1 GROWTH MISSION");

h2("07", "Year 1 Growth Mission");

const mY = doc.y;
doc.rect(ML, mY, CW, 52).fill(C.navy);
doc.fillColor(C.white).fontSize(36).font("Helvetica-Bold").text("1.000.000", ML, mY + 8, { width: CW, align: "center" });
doc.fillColor("#94a3b8").fontSize(8.5).font("Helvetica").text("CLIENTES ATIVOS EM 12 MESES — MISSÃO INTERNA", ML, mY + 40, { width: CW, align: "center" });
doc.y = mY + 62;

doc.moveDown(0.4);
body("Estratégia: 52 semanas, 52 regiões estratégicas do Brasil, 52 públicos prioritários e 52 ciclos de lançamento — combinando campanhas próprias acumulativas, afiliados regionais, prova social crescente e reinjeção de capital.");
doc.moveDown(0.5);

h3("Funil de Aquisição — Do Lead ao Cliente");
tableHeader(["Estágio", "Produto", "Objetivo"], [110, 170, 203]);
tableRow(["Topo de funil",           "Isca gratuita — Os 7 Erros Fatais",    "Volume massivo de leads qualificados"],    [110, 170, 203], false);
tableRow(["Qualificação financeira", "Tripwire R$97",                         "Filtrar leads prontos para comprar"],      [110, 170, 203], true);
tableRow(["Conversão principal",     "NexOS AI R$3.990 / R$9.990",           "Aquisição vitalícia — receita central"],   [110, 170, 203], false);
tableRow(["Upsell metodologia",      "NexOS Academy R$2.500",                "Profundidade + LTV por cliente"],          [110, 170, 203], true);
tableRow(["Consumo recorrente",      "Créditos de IA + taxas de lançamento", "Receita contínua por uso operacional"],    [110, 170, 203], false);

doc.moveDown(0.5);

const diffY = doc.y;
doc.rect(ML, diffY, CW, 42).fill(C.tint);
doc.rect(ML, diffY, 3, 42).fill(C.navyLight);
doc.fillColor(C.navyMid).fontSize(8.5).font("Helvetica-Bold").text("DIFERENCIAL OPERACIONAL", ML + 10, diffY + 7);
doc.fillColor(C.slate).fontSize(8).font("Helvetica").text(
  "O NexOS executa essa estratégia com sua própria tecnologia — sem expansão proporcional de time, sem contratar uma agência por região, sem depender de 52 equipes. Somente o NexOS consegue executar essa amplitude com baixo atrito operacional porque o produto é a própria máquina de execução.",
  ML + 10, diffY + 20, { width: CW - 20 },
);
doc.y = diffY + 52;

doc.moveDown(0.5);
h3("Multiplicadores de Crescimento");
tableHeader(["Multiplicador", "Mecanismo", "Impacto no crescimento"], [140, 190, 153]);
tableRow(["Auto-lançamento",         "NexOS se lança com NexOS — case público",        "Prova de produto como marketing"],       [140, 190, 153], false);
tableRow(["Afiliados regionais",     "Comissão por indicação validada",                 "Força de vendas sem custo fixo"],        [140, 190, 153], true);
tableRow(["Prova social acumulativa","Casos de sucesso documentados na plataforma",      "Reduz custo de conversão de novos leads"],[140, 190, 153], false);
tableRow(["Reinjeção de capital",    "Receita de semanas anteriores financia a próxima", "Crescimento composto semanal"],          [140, 190, 153], true);

pageFooter(8, 13);

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 9 — REVENUE PROJECTION
// ═══════════════════════════════════════════════════════════════════════════════
newPage("08  REVENUE PROJECTION — 1 MILLION CUSTOMERS");

h2("08", "Revenue Projection — 1 Million Customers");

h3("8.1 — Receita de aquisição (ticket único)");
tableHeader(["Clientes", "Ticket médio (lançamento)", "Receita total de aquisição"], [130, 180, 173]);
tableRow(["1.000.000", "R$ 3.990 (Solo — cenário base)", "R$ 3,99 bilhões"], [130, 180, 173], false);
tableRow(["1.000.000", "R$ 9.990 (Agency — blended 20% mix)", "Até R$ 9,99 bilhões"], [130, 180, 173], true);

doc.moveDown(0.4);
h3("8.2 — Receita por taxa de lançamento (pay-per-execution)");
body("A partir do 2.º lançamento, cada execução gera R$497. Com 1M de clientes e média de 4 lançamentos/ano por cliente (descontando o primeiro gratuito):");
doc.moveDown(0.3);
tableHeader(["Clientes ativos", "Lançamentos/ano (pagos)", "Receita por taxa de execução"], [150, 160, 173]);
tableRow(["1.000.000", "3 lançamentos pagos × R$ 497", "R$ 1,49 bilhão/ano"], [150, 160, 173], false);

doc.moveDown(0.4);
h3("8.3 — Receita recorrente por créditos de IA");
tableHeader(["Clientes ativos", "Consumo médio/mês", "Receita mensal", "ARR"], [120, 110, 120, 133]);
tableRow(["1.000.000", "R$ 1.000", "R$ 1 bilhão", "R$ 12 bilhões"], [120, 110, 120, 133], false);

doc.moveDown(0.4);
h3("8.4 — Receita do Ecossistema (uplift adicional)");
tableHeader(["Produto", "Penetração estimada", "Receita adicional"], [190, 145, 148]);
tableRow(["NexOS Academy R$2.500", "40% dos clientes NexOS AI", "R$ 1B (sobre 1M clientes)"], [190, 145, 148], false);
tableRow(["NexOS Connect R$197",   "15% da base ativa",          "R$ 29,55M"],               [190, 145, 148], true);

doc.moveDown(0.5);
h3("8.5 — Potencial Econômico Anualizado Consolidado");

const rY = doc.y;
doc.rect(ML, rY, CW, 72).fill(C.tint);
doc.rect(ML, rY, 2, 72).fill(C.navyLight);
[
  { l: "Receita de aquisição (Solo — 1M clientes)", v: "R$ 3,99B" },
  { l: "Taxa de lançamento (3 paid × 1M clientes)", v: "R$ 1,49B" },
  { l: "Run-rate anualizado de créditos",           v: "R$ 12B" },
  { l: "NexOS Academy (40% penetração)",            v: "+ R$ 1B" },
].forEach(({ l, v }, i) => {
  const ry = rY + 7 + i * 15;
  doc.fillColor(C.slate).fontSize(8).font("Helvetica").text(l, ML + 10, ry, { lineBreak: false });
  doc.fillColor(C.navyMid).fontSize(8).font("Helvetica-Bold").text(v, W - MR - 55, ry, { lineBreak: false });
});
doc.y = rY + 82;

const totalY = doc.y;
doc.rect(ML, totalY, CW, 24).fill(C.navy);
doc.fillColor(C.white).fontSize(9).font("Helvetica-Bold")
  .text("POTENCIAL ECONÔMICO ANUALIZADO — ANO 1", ML + 10, totalY + 7, { lineBreak: false });
doc.fillColor(C.white).fontSize(13).font("Helvetica-Bold")
  .text("R$ 18,48B+", W - MR - 65, totalY + 5, { lineBreak: false });
doc.y = totalY + 34;

doc.moveDown(0.3);
caption("Nota: valores refletem o run-rate anualizado ao atingir 1M de clientes ativos. Se os clientes entram progressivamente ao longo do ano, os valores realizados no primeiro ano podem variar conforme o mês de entrada de cada coorte.");

pageFooter(9, 13);

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 10 — VALUATION FRAMEWORK
// ═══════════════════════════════════════════════════════════════════════════════
newPage("09  VALUATION FRAMEWORK");

h2("09", "Valuation Framework");
body("Valuation depende de como o mercado classifica o NexOS.");
doc.moveDown(0.4);

h3("9.1 — Como SaaS tradicional");
body("O BVP Nasdaq Emerging Cloud Index mostra múltiplo médio de ~6,3x. Aplicando múltiplos conservadores ao run-rate de R$12B:");
doc.moveDown(0.3);
tableHeader(["Classificação", "Múltiplo", "Valuation"], [220, 100, 163]);
tableRow(["SaaS conservador", "6x receita",  "R$ 72B"],  [220, 100, 163], false);
tableRow(["SaaS agressivo",   "10x receita", "R$ 120B"], [220, 100, 163], true);

doc.moveDown(0.5);
h3("9.2 — Como AI-native high-growth platform");
body("Para uma plataforma AI-native com crescimento extremo, consumo recorrente, retenção e dominância de categoria:");
doc.moveDown(0.3);
tableHeader(["Múltiplo", "Base ARR", "Valuation"], [100, 180, 203]);
tableRow(["15x", "R$ 12B ARR", "R$ 180B"], [100, 180, 203], false);
tableRow(["20x", "R$ 12B ARR", "R$ 240B"], [100, 180, 203], true);
tableRow(["25x", "R$ 12B ARR", "R$ 300B"], [100, 180, 203], false);
tableRow(["40x", "R$ 12B ARR", "R$ 480B"], [100, 180, 203], true);

doc.moveDown(0.5);
h3("9.3 — Como Growth Infrastructure");
body("Se o mercado classifica NexOS como infraestrutura de crescimento empresarial, a avaliação passa a ser feita em função da dependência econômica criada:");
doc.moveDown(0.3);
tableHeader(["Cenário estratégico", "Valuation"], [250, 233]);
tableRow(["R$ 12B ARR × 50x",  "R$ 600B"], [250, 233], false);
tableRow(["R$ 12B ARR × 75x",  "R$ 900B"], [250, 233], true);
tableRow(["R$ 12B ARR × 100x", "R$ 1,2T"], [250, 233], false);

goldBlock("PREMISSA ESTRUTURAL", "Esse valuation exige que o mercado veja o NexOS como camada operacional indispensável, não como software de marketing.");

h3("9.4 — Base expandida (ecossistema completo ~R$ 14,5B ARR)");
body("Com a inclusão de taxas de lançamento (R$1,49B) e receita da Academy (R$1B), a base de ARR para aplicação de múltiplos sobe para ~R$14,5B — expandindo todos os cenários em ~20%.");
doc.moveDown(0.3);
tableHeader(["Múltiplo", "Base expandida", "Valuation expandido"], [100, 220, 163]);
tableRow(["25x",  "R$ 14,5B ARR", "R$ 362B"],  [100, 220, 163], false);
tableRow(["50x",  "R$ 14,5B ARR", "R$ 725B"],  [100, 220, 163], true);
tableRow(["100x", "R$ 14,5B ARR", "R$ 1,45T"], [100, 220, 163], false);

pageFooter(10, 13);

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 11 — PATH TO TRILLION + WHY INFRASTRUCTURE MULTIPLES
// ═══════════════════════════════════════════════════════════════════════════════
newPage("10–11  PATH TO TRILLION  ·  INFRASTRUCTURE MULTIPLES");

h2("10", "Path to Trillion-Dollar Valuation");
body("A tese de trilhões não vem de 1 milhão de clientes isoladamente — 1 milhão de clientes é a prova de categoria. A tese de trilhões vem quando o mercado projeta que o NexOS será infraestrutura global.");
doc.moveDown(0.4);

h3("10.1 — Cenário de expansão global (50M clientes)");
caption("PREMISSA: 50M clientes ativos globais · R$1.000/mês consumo médio · Receita ≈ R$600B/ano ≈ US$120B ARR (câmbio ilustrativo R$5/USD)");
doc.moveDown(0.3);
tableHeader(["Múltiplo sobre ARR", "Valuation"], [250, 233]);
tableRow(["US$ 120B ARR × 25x", "US$ 3T"],   [250, 233], false);
tableRow(["US$ 120B ARR × 40x", "US$ 4,8T"], [250, 233], true);

doc.moveDown(0.5);
h3("10.2 — Cenário de 100 milhões de clientes globais");
caption("100M × R$1.000 × 12 = R$1,2T/ano ≈ US$240B ARR");
doc.moveDown(0.3);
tableHeader(["Múltiplo sobre ARR", "Valuation"], [250, 233]);
tableRow(["US$ 240B ARR × 20x", "US$ 4,8T"], [250, 233], false);
tableRow(["US$ 240B ARR × 25x", "US$ 6T"],   [250, 233], true);

goldBlock("CONCLUSÃO MATEMÁTICA", "Nesse cenário, a marca de US$5T deixa de ser uma afirmação emocional e passa a ser uma consequência matemática de base global massiva, consumo recorrente, infraestrutura indispensável e múltiplos de plataforma dominante.");

h2("11", "Why NexOS Can Command Infrastructure Multiples");
body("Microsoft tornou-se indispensável porque o computador pessoal precisava de um sistema operacional. AWS tornou-se indispensável porque empresas precisavam de computação escalável. Stripe tornou-se indispensável porque negócios digitais precisavam processar pagamentos.");
doc.moveDown(0.4);
body("NexOS torna-se indispensável porque todo agente econômico precisa crescer. Todo mundo vende, influencia, trabalha para quem vende, depende de clientes, depende de audiência, depende de autoridade, depende de conversão. O NexOS transforma isso em operação.");
doc.moveDown(0.4);
body("O mercado não adotará NexOS apenas porque ele é inteligente. O mercado adotará porque fazer sem NexOS será mais lento, mais caro, mais confuso e menos eficiente.");
doc.moveDown(0.35);
highlight("Assim como qualquer pessoa pode escrever sem Word, qualquer empresa pode tentar crescer sem NexOS. Mas quando a alternativa é mais lenta, mais cara e mais frágil, o padrão muda.");

pageFooter(11, 13);

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 12 — STRATEGIC MOAT
// ═══════════════════════════════════════════════════════════════════════════════
newPage("12  STRATEGIC MOAT");

h2("12", "Strategic Moat");
doc.moveDown(0.3);

const moats = [
  { n: "12.1", t: "Data Moat", d: "Cada campanha gera dados proprietários: criativos vencedores, públicos vencedores, objeções, timing, regiões, CPL, CPA, ROAS, conversão e retenção. Esses dados não existem em nenhuma outra plataforma." },
  { n: "12.2", t: "Execution Moat", d: "Ferramentas geram ativos. NexOS executa. Execução cria dependência operacional — quanto mais o cliente executa, mais difícil é migrar sem perder todo o contexto acumulado." },
  { n: "12.3", t: "Workflow Moat", d: "Quanto mais o cliente usa, mais o NexOS entende: produto, marca, público, campanhas, resultado, tom, oferta e histórico. Esse contexto acumulado é intransferível para qualquer ferramenta concorrente." },
  { n: "12.4", t: "Proof Moat", d: "O auto-lançamento documentado vira case central. O lead não assiste uma promessa — ele vive a demonstração. Isso cria um loop de prova social que se auto-alimenta com cada novo lançamento." },
  { n: "12.5", t: "Category Moat", d: "NexOS cria uma categoria: Growth Execution Infrastructure. Quem cria a categoria tende a capturar percepção de liderança permanente nela — independente de quem entre depois." },
];

const halfW = CW / 2 - 6;
moats.forEach((m, i) => {
  const col = i % 2;
  if (col === 0 && i > 0) doc.y += 6;
  const cx = col === 0 ? ML : ML + halfW + 12;
  const cy = doc.y;
  const h = 52;
  doc.rect(cx, cy, halfW, h).fill(C.tint);
  doc.rect(cx, cy, 2, h).fill(C.navyLight);
  doc.fillColor(C.slateLight).fontSize(7).font("Helvetica-Bold").text(m.n, cx + 8, cy + 6, { lineBreak: false });
  doc.fillColor(C.navyMid).fontSize(8.5).font("Helvetica-Bold").text(m.t, cx + 8, cy + 16, { lineBreak: false });
  doc.fillColor(C.slate).fontSize(7.5).font("Helvetica").text(m.d, cx + 8, cy + 28, { width: halfW - 16, lineGap: 1 });
  if (col === 1 || i === moats.length - 1) doc.y = cy + h + 4;
  else { doc.y = cy; }
});

doc.y += 10;

// Masterprint moat — full width, gold border
const mpY = doc.y;
doc.rect(ML, mpY, CW, 60).fill(C.goldLight);
doc.rect(ML, mpY, 3, 60).fill(C.gold);
doc.rect(ML, mpY, CW, 1).fill(C.gold);
doc.fillColor(C.slateLight).fontSize(7).font("Helvetica-Bold").text("12.6 — NOVO · v2.0", ML + 12, mpY + 6, { lineBreak: false });
doc.fillColor(C.gold).fontSize(10).font("Helvetica-Bold")
  .text("Proprietary Content Security Moat — Masterprint Anti-Piracy", ML + 12, mpY + 17);
doc.fillColor(C.navyMid).fontSize(8).font("Helvetica")
  .text(
    "Toda saída da plataforma — PDFs, guias, roteiros, estratégias, materiais exportados — carrega rastreabilidade forense nativa. Fingerprint único por usuário + cadeia de custódia completa + cruzamento econômico via CPF/Asaas/device + exportação de dossiê jurídico. Nenhuma plataforma de SaaS de marketing no Brasil oferece isso. O Masterprint cria uma barreira de proteção de IP sem precedentes no setor.",
    ML + 12, mpY + 33, { width: CW - 20 },
  );
doc.y = mpY + 70;

pageFooter(12, 13);

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 13 — INVESTOR CONCLUSION
// ═══════════════════════════════════════════════════════════════════════════════
newPage("13  INVESTOR CONCLUSION");

h2("13", "Investor Conclusion");

body("NexOS AI é uma tese de infraestrutura. Não é uma tese de ferramenta.");
doc.moveDown(0.4);
body("O mercado não precisa de mais uma IA para escrever texto. O mercado precisa de uma camada que execute crescimento. NexOS entrega:");
doc.moveDown(0.35);
highlight("planejamento · produção · direção · criativos · vídeos · tráfego · funil · segmentação · aquecimento · venda · remarketing · auditoria · aprendizado · escala");

body("O primeiro grande case é o próprio NexOS: uma plataforma que se lança, se vende, documenta sua própria execução e transforma esse histórico em prova pública.");
doc.moveDown(0.5);

h3("Por que a v2.0 é uma tese mais sólida:");

const v2items = [
  ["Ecossistema de 5 produtos",       "Funil completo — da isca grátis ao guia técnico. Múltiplas portas de entrada, múltiplas fontes de receita sem aumentar o custo de aquisição."],
  ["Modelo pay-per-execution",        "R$497/lançamento (2.º+) alinha receita ao sucesso do cliente — não é taxa arbitrária, é participação no resultado da execução."],
  ["Masterprint Anti-Piracy",         "Proteção forense de IP nativa — diferencial técnico sem precedente no setor de SaaS de marketing no Brasil (Moat 12.6)."],
  ["64 agentes especializados",       "7 departamentos completos — de mentalidade a vendas. Não é um chatbot; é uma equipe de especialistas de IA convocada na hora certa."],
  ["Trilhas de receita 6/8/10 dígitos","Produto calibrado por meta — não por tamanho de empresa. Qualquer pessoa pode usar, com qualquer objetivo de receita."],
  ["Academy como produto autônomo",   "R$3.900 de metodologia vendida separadamente — expansão de LTV sem custo marginal adicional de entrega."],
];

v2items.forEach(([title, desc]) => {
  const iy = doc.y;
  doc.rect(ML, iy, CW, 26).fill(C.tint);
  doc.rect(ML, iy, 2, 26).fill(C.navyLight);
  doc.fillColor(C.navyMid).fontSize(8).font("Helvetica-Bold").text(title, ML + 10, iy + 5, { lineBreak: false });
  doc.fillColor(C.slate).fontSize(7.5).font("Helvetica").text(desc, ML + 10, iy + 16, { width: CW - 20 });
  doc.y = iy + 29;
});

doc.moveDown(0.7);

const cY = doc.y;
doc.rect(ML, cY, CW, 56).fill(C.navy);
doc.fillColor(C.white).fontSize(9).font("Helvetica-BoldOblique")
  .text('"Quanto vale uma ferramenta de marketing?" — essa não é a pergunta definitiva para investidores.', ML + 16, cY + 8, { width: CW - 30 });
doc.fillColor("#94a3b8").fontSize(9).font("Helvetica-Bold")
  .text("A pergunta correta é: quanto vale a infraestrutura que torna crescimento empresarial executável, auditável, escalável e acessível para qualquer pessoa ou empresa?", ML + 16, cY + 24, { width: CW - 30 });
doc.y = cY + 66;

doc.moveDown(0.4);
body("A resposta é: vale o tamanho da camada econômica que ela passa a controlar.");
doc.moveDown(0.8);
doc.fillColor(C.navy).fontSize(16).font("Helvetica-Bold").text("E essa camada é global.", ML, doc.y, { width: CW, align: "center" });
doc.moveDown(1.2);
doc.fillColor(C.slateLight).fontSize(7).font("Helvetica")
  .text("NexOS AI  ·  NXS-2026-001  ·  Prospect Paper v2.0  ·  Junho 2026  ·  STRICTLY PRIVATE & CONFIDENTIAL", ML, doc.y, { width: CW, align: "center" });

pageFooter(13, 13);

// ─── FINALIZE ────────────────────────────────────────────────────────────────
doc.end();
console.log(`✅ PDF gerado em: ${OUT_PATH}`);
