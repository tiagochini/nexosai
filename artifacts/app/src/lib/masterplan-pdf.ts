import jsPDF from "jspdf";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PdfUserIdentity {
  name: string;
  email: string;
  userId: string;
  workspaceName: string;
  workspaceId: string;
}

export interface MasterplanPdfData {
  campaignId: string;
  campaignTitle: string;
  track?: string;
  executiveSummary: string;
  bigDomino: string;
  positioning: Record<string, unknown>;
  market: Record<string, unknown>;
  audience: Record<string, unknown>;
  architecture: Record<string, unknown>;
  metrics: Record<string, unknown>;
  risks: Record<string, unknown>;
  triggerMap: Record<string, unknown>;
  strategistNotes: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function arr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim() !== "");
}
function num(v: unknown): number | null {
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function generateFingerprint(userId: string, campaignId: string): string {
  const raw = `${userId}::${campaignId}::${Date.now()}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  const hex = h.toString(16).toUpperCase().padStart(8, "0");
  return `NXS-${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

function formatDateBR(d: Date): string {
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
  }) + " (BRT)";
}

// ─── Page constants ───────────────────────────────────────────────────────────

const W = 210;    // A4 width mm
const H = 297;    // A4 height mm
const ML = 20;    // margin left
const MR = 20;    // margin right
const MT = 22;    // margin top
const MB = 22;    // margin bottom
const CW = W - ML - MR;   // content width = 170

// ─── Drawing helpers ──────────────────────────────────────────────────────────

type Doc = jsPDF;

function setColor(doc: Doc, r: number, g: number, b: number) {
  doc.setTextColor(r, g, b);
}

function hline(doc: Doc, y: number, x1 = ML, x2 = W - MR, r = 200, g = 200, b = 200) {
  doc.setDrawColor(r, g, b);
  doc.setLineWidth(0.2);
  doc.line(x1, y, x2, y);
}

function sectionTitle(doc: Doc, text: string, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  setColor(doc, 120, 80, 200);
  doc.text(text.toUpperCase(), ML, y);
  hline(doc, y + 1.5, ML, W - MR, 200, 180, 240);
  return y + 5;
}

function bodyText(doc: Doc, text: string, y: number, maxW = CW, size = 8.5): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(size);
  setColor(doc, 40, 40, 40);
  const lines = doc.splitTextToSize(text, maxW);
  doc.text(lines, ML, y);
  return y + lines.length * (size * 0.38) + 1.5;
}

function labeledText(doc: Doc, label: string, value: string, y: number): number {
  if (!value) return y;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  setColor(doc, 140, 100, 210);
  doc.text(label.toUpperCase() + ":", ML, y);
  const labelW = doc.getTextWidth(label.toUpperCase() + ":") + 2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setColor(doc, 40, 40, 40);
  const lines = doc.splitTextToSize(value, CW - labelW);
  doc.text(lines, ML + labelW, y);
  return y + Math.max(lines.length, 1) * 3.5 + 1;
}

function bulletList(doc: Doc, items: string[], y: number, color: [number, number, number] = [80, 80, 80]): number {
  items.forEach(item => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setColor(doc, ...color);
    doc.text("▸", ML, y);
    doc.setFont("helvetica", "normal");
    setColor(doc, 40, 40, 40);
    const lines = doc.splitTextToSize(item, CW - 5);
    doc.text(lines, ML + 4.5, y);
    y += lines.length * 3.5 + 1;
  });
  return y;
}

function numberedList(doc: Doc, items: string[], y: number, color: [number, number, number] = [100, 60, 180]): number {
  items.forEach((item, i) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    setColor(doc, ...color);
    doc.text(`${String(i + 1).padStart(2, "0")}`, ML, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    setColor(doc, 40, 40, 40);
    const lines = doc.splitTextToSize(item, CW - 8);
    doc.text(lines, ML + 7, y);
    y += lines.length * 3.5 + 1;
  });
  return y;
}

// ─── Watermark (applied to every page) ───────────────────────────────────────

function applyWatermark(doc: Doc, user: PdfUserIdentity, fingerprint: string, pageNum: number, totalPages: number) {
  const wText = `LICENCIADO PARA ${user.name.toUpperCase()} · ${user.email} · ${fingerprint}`;

  // Diagonal watermark — light gray, 45°
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  setColor(doc, 210, 200, 220);
  doc.text(wText, W / 2, H / 2, { angle: 45, align: "center" });

  // Second diagonal (opposite direction for fuller coverage)
  setColor(doc, 220, 215, 225);
  doc.setFontSize(7.5);
  doc.text(wText, W / 2, H / 3, { angle: 45, align: "center" });
  doc.text(wText, W / 2, (2 * H) / 3, { angle: 45, align: "center" });

  // Header bar
  doc.setFillColor(248, 246, 252);
  doc.rect(0, 0, W, 12, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  setColor(doc, 120, 80, 200);
  doc.text("NEXOS AI — MASTERPLAN CONFIDENCIAL", ML, 7.5);
  doc.setFont("helvetica", "normal");
  setColor(doc, 160, 140, 180);
  doc.text(`${fingerprint}`, W - MR, 7.5, { align: "right" });

  // Footer bar
  doc.setFillColor(248, 246, 252);
  doc.rect(0, H - 12, W, 12, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  setColor(doc, 130, 110, 160);
  doc.text(
    `© NexOS AI · Propriedade exclusiva de ${user.name} · ${user.email} · Conta ${user.userId}`,
    ML, H - 6.5
  );
  doc.text(`Pág. ${pageNum} / ${totalPages}`, W - MR, H - 6.5, { align: "right" });
}

// ─── Page break helper ────────────────────────────────────────────────────────

function checkBreak(doc: Doc, y: number, needed = 15): number {
  if (y + needed > H - MB - 10) {
    doc.addPage();
    return MT + 5;
  }
  return y;
}

// ─── Section renderers ────────────────────────────────────────────────────────

function renderSection(doc: Doc, n: string, title: string, y: number): number {
  y = checkBreak(doc, y, 18);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  setColor(doc, 160, 140, 180);
  doc.text(n, ML, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  setColor(doc, 30, 20, 50);
  doc.text(title, ML + 7, y);
  hline(doc, y + 2, ML, W - MR, 180, 160, 210);
  return y + 7;
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

export function generateMasterplanPDF(
  data: MasterplanPdfData,
  user: PdfUserIdentity
): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const fingerprint = generateFingerprint(user.userId, data.campaignId);
  const now = formatDateBR(new Date());

  // ── PAGE 1: COVER ──────────────────────────────────────────────────────────

  // Background tint
  doc.setFillColor(252, 250, 255);
  doc.rect(0, 0, W, H, "F");

  // Top accent bar
  doc.setFillColor(91, 33, 182);
  doc.rect(0, 0, W, 18, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  setColor(doc, 255, 255, 255);
  doc.text("NEXOS AI", ML, 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  setColor(doc, 220, 200, 255);
  doc.text("SISTEMA DE LANÇAMENTO AUTÔNOMO", ML, 13.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  setColor(doc, 220, 200, 255);
  doc.text(fingerprint, W - MR, 10, { align: "right" });

  // Campaign title block
  let y = 35;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  setColor(doc, 130, 100, 190);
  doc.text("MASTERPLAN DE LANÇAMENTO", ML, y);
  y += 7;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  setColor(doc, 20, 10, 40);
  const titleLines = doc.splitTextToSize(data.campaignTitle || "Masterplan Estratégico", CW);
  doc.text(titleLines, ML, y);
  y += titleLines.length * 7 + 4;

  if (data.track) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setColor(doc, 100, 70, 160);
    doc.text(`Track: ${data.track}  ·  Gerado em: ${now}`, ML, y);
    y += 8;
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setColor(doc, 130, 110, 170);
    doc.text(`Gerado em: ${now}`, ML, y);
    y += 8;
  }

  hline(doc, y, ML, W - MR, 150, 120, 200);
  y += 10;

  // User identity box
  doc.setDrawColor(120, 80, 200);
  doc.setLineWidth(0.6);
  doc.rect(ML, y, CW, 55, "S");

  // Left accent bar on box
  doc.setFillColor(91, 33, 182);
  doc.rect(ML, y, 2, 55, "F");

  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  setColor(doc, 91, 33, 182);
  doc.text("DOCUMENTO GERADO EXCLUSIVAMENTE PARA:", ML + 5, y);
  y += 6;

  const rows: [string, string][] = [
    ["Nome",       user.name || "—"],
    ["Email",      user.email || "—"],
    ["ID da Conta", user.userId || "—"],
    ["Workspace",  user.workspaceName || "—"],
    ["ID Workspace", user.workspaceId || "—"],
    ["Fingerprint", fingerprint],
    ["Gerado em",  now],
  ];

  rows.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    setColor(doc, 100, 70, 150);
    doc.text(`${label}:`, ML + 5, y);
    const lw = doc.getTextWidth(`${label}:`) + 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setColor(doc, 20, 10, 40);
    const vlines = doc.splitTextToSize(value, CW - 10 - lw);
    doc.text(vlines, ML + 5 + lw, y);
    y += vlines.length * 3.8 + 0.8;
  });

  y += 8;

  // Anti-piracy notice on cover
  doc.setFillColor(255, 245, 250);
  doc.setDrawColor(200, 150, 180);
  doc.setLineWidth(0.3);
  doc.rect(ML, y, CW, 34, "FD");

  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  setColor(doc, 160, 40, 80);
  doc.text("⚠  AVISO DE PROPRIEDADE E ANTIPIRATARIA", ML + 4, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  setColor(doc, 80, 40, 60);
  const notice = `Este documento é de uso exclusivo e intransferível de ${user.name} (${user.email}). ` +
    `Os dados de identificação desta conta (nome, email, ID de conta e workspace) estão embutidos ` +
    `visivelmente e invisivelmente em todas as páginas deste PDF como marca d'água digital. ` +
    `Qualquer reprodução, distribuição ou compartilhamento não autorizado é proibido e rastreável. ` +
    `O fingerprint ${fingerprint} identifica esta cópia de forma única.`;
  const noticeLines = doc.splitTextToSize(notice, CW - 8);
  doc.text(noticeLines, ML + 4, y);

  // ── PAGE 2: ANTI-PIRACY FULL NOTICE ───────────────────────────────────────

  doc.addPage();
  y = MT + 5;

  // Header decoration
  doc.setFillColor(91, 33, 182);
  doc.rect(ML, y, 3, 22, "F");

  y += 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  setColor(doc, 30, 10, 60);
  doc.text("SISTEMA DE PROTEÇÃO ANTIPIRATARIA", ML + 6, y);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  setColor(doc, 120, 80, 200);
  doc.text("NEXOS AI — DOCUMENTO LICENCIADO E RASTREÁVEL", ML + 6, y);
  y += 15;

  hline(doc, y, ML, W - MR, 150, 120, 200);
  y += 8;

  const antiSections: [string, string][] = [
    ["O QUE ESTÁ EMBUTIDO NESTE DOCUMENTO",
      `Este PDF contém, em todas as suas páginas:\n` +
      `• Nome completo: ${user.name}\n` +
      `• Email da conta: ${user.email}\n` +
      `• ID único de conta: ${user.userId}\n` +
      `• Workspace: ${user.workspaceName} (${user.workspaceId})\n` +
      `• Fingerprint do documento: ${fingerprint}\n` +
      `• Data e hora de geração: ${now}\n\n` +
      `Esses dados estão presentes como marca d'água visível em todas as páginas e nos metadados do arquivo.`
    ],
    ["POR QUE FAZEMOS ISSO",
      `O NexOS AI investe em inteligência artificial e metodologias proprietárias para ` +
      `gerar planos estratégicos únicos e personalizados. Este sistema de identificação ` +
      `garante que cada documento possa ser rastreado até sua origem em caso de ` +
      `distribuição não autorizada, protegendo tanto a propriedade intelectual da ` +
      `NexOS AI quanto a exclusividade do seu plano estratégico.`
    ],
    ["USO PERMITIDO",
      `Este documento é licenciado exclusivamente para uso interno do titular da conta ` +
      `identificada. É permitido imprimir para uso pessoal e compartilhar internamente ` +
      `com membros da equipe direta do mesmo workspace. É proibido: distribuir ` +
      `publicamente, publicar em grupos ou redes sociais, vender, ceder ou ` +
      `compartilhar com terceiros fora do workspace licenciado.`
    ],
    ["ASSINATURA DIGITAL DE CONSENTIMENTO",
      `Ao solicitar o download deste documento, o titular da conta ${user.email} ` +
      `declarou ciência e concordância com o sistema de identificação embutido, ` +
      `conforme os Termos de Uso do NexOS AI. Esta ação foi registrada com timestamp ` +
      `${now} e fingerprint ${fingerprint}.`
    ],
  ];

  antiSections.forEach(([title, content]) => {
    y = checkBreak(doc, y, 25);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setColor(doc, 91, 33, 182);
    doc.text(title, ML, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setColor(doc, 40, 30, 60);
    const lines = doc.splitTextToSize(content, CW);
    doc.text(lines, ML, y);
    y += lines.length * 3.8 + 6;
  });

  // Identity box on page 2
  y = checkBreak(doc, y, 40);
  hline(doc, y, ML, W - MR, 150, 120, 200);
  y += 6;
  doc.setFillColor(248, 245, 255);
  doc.setDrawColor(150, 120, 210);
  doc.setLineWidth(0.3);
  doc.rect(ML, y, CW, 24, "FD");
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  setColor(doc, 91, 33, 182);
  doc.text("IDENTIFICAÇÃO DESTA CÓPIA:", ML + 4, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  setColor(doc, 30, 20, 50);
  doc.text(`Titular: ${user.name}  ·  ${user.email}`, ML + 4, y); y += 4;
  doc.text(`Workspace: ${user.workspaceName}  ·  ID: ${user.workspaceId}`, ML + 4, y); y += 4;
  doc.setFont("helvetica", "bold");
  setColor(doc, 91, 33, 182);
  doc.text(`Fingerprint: ${fingerprint}`, ML + 4, y); y += 4;

  // ── PAGES 3+: MODULES ─────────────────────────────────────────────────────

  doc.addPage();
  y = MT + 5;

  // ── M01 — DIAGNÓSTICO EXECUTIVO
  if (data.executiveSummary) {
    y = renderSection(doc, "01", "DIAGNÓSTICO EXECUTIVO", y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    setColor(doc, 100, 70, 160);
    doc.text("1.1 — Análise de Viabilidade e PMF", ML, y); y += 4;
    y = bodyText(doc, data.executiveSummary, y);
    y += 6;
  }

  // ── M02 — BIG DOMINO
  if (data.bigDomino) {
    y = checkBreak(doc, y, 30);
    y = renderSection(doc, "02", "BIG DOMINO — A CRENÇA CENTRAL", y);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    setColor(doc, 140, 100, 190);
    doc.text("A UMA crença que, implantada no avatar, colapsa todas as objeções de uma vez:", ML, y); y += 5;

    // Quote box
    doc.setFillColor(248, 244, 255);
    doc.setDrawColor(120, 80, 200);
    doc.setLineWidth(0.8);
    doc.line(ML, y, ML, y + 2 + Math.ceil(data.bigDomino.length / 80) * 5.5);
    doc.setLineWidth(0.2);
    doc.setFont("helvetica", "bolditalic");
    doc.setFontSize(10);
    setColor(doc, 30, 15, 55);
    const bdLines = doc.splitTextToSize(`"${data.bigDomino}"`, CW - 6);
    doc.text(bdLines, ML + 5, y);
    y += bdLines.length * 4.5 + 8;
  }

  // ── M03 — POSICIONAMENTO
  const pos = data.positioning;
  if (Object.keys(pos).length > 0) {
    y = checkBreak(doc, y, 20);
    y = renderSection(doc, "03", "POSICIONAMENTO DA OFERTA", y);

    if (str(pos["uniqueValueProposition"])) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      setColor(doc, 100, 70, 160);
      doc.text("3.1 — Proposta Única de Valor", ML, y); y += 4;
      doc.setFont("helvetica", "bolditalic");
      doc.setFontSize(9);
      setColor(doc, 30, 15, 55);
      const uvpLines = doc.splitTextToSize(str(pos["uniqueValueProposition"]), CW);
      doc.text(uvpLines, ML, y);
      y += uvpLines.length * 3.8 + 5;
    }
    if (str(pos["primaryDifferentiator"])) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      setColor(doc, 100, 70, 160);
      doc.text("3.2 — Mecanismo Único", ML, y); y += 4;
      y = bodyText(doc, str(pos["primaryDifferentiator"]), y);
      y += 3;
    }
    y = checkBreak(doc, y, 12);
    if (str(pos["positioning"])) { y = labeledText(doc, "Posicionamento", str(pos["positioning"]), y); }
    if (str(pos["priceJustification"])) { y = labeledText(doc, "Justificativa de Preço", str(pos["priceJustification"]), y); }
    if (arr(pos["competitiveAdvantages"]).length) {
      y += 2;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      setColor(doc, 100, 70, 160);
      doc.text("3.4 — Vantagens Competitivas", ML, y); y += 4;
      y = numberedList(doc, arr(pos["competitiveAdvantages"]), y, [40, 120, 80]);
    }
    y += 4;
  }

  // ── M04 — DIAGNÓSTICO DE MERCADO
  const mkt = data.market;
  if (Object.keys(mkt).length > 0) {
    y = checkBreak(doc, y, 20);
    y = renderSection(doc, "04", "DIAGNÓSTICO DE MERCADO", y);

    if (str(mkt["marketMaturity"])) {
      y = labeledText(doc, "Maturidade do Mercado", str(mkt["marketMaturity"]).toUpperCase(), y);
    }
    if (str(mkt["competitiveLandscape"])) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      setColor(doc, 100, 70, 160);
      doc.text("4.1 — Cenário Competitivo", ML, y); y += 4;
      y = bodyText(doc, str(mkt["competitiveLandscape"]), y);
      y += 3;
    }

    const opps = arr(mkt["opportunities"]);
    const threats = arr(mkt["threats"]);
    const barriers = arr(mkt["entryBarriers"]);

    if (opps.length || threats.length || barriers.length) {
      y = checkBreak(doc, y, 15);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      setColor(doc, 100, 70, 160);
      doc.text("4.2 — Oportunidades · Ameaças · Barreiras", ML, y); y += 4;

      if (opps.length) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        setColor(doc, 30, 120, 80);
        doc.text("OPORTUNIDADES", ML, y); y += 3;
        y = bulletList(doc, opps, y, [40, 140, 90]);
        y += 2;
      }
      if (threats.length) {
        y = checkBreak(doc, y, 10);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        setColor(doc, 160, 40, 50);
        doc.text("AMEAÇAS", ML, y); y += 3;
        y = bulletList(doc, threats, y, [180, 60, 70]);
        y += 2;
      }
      if (barriers.length) {
        y = checkBreak(doc, y, 10);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        setColor(doc, 160, 110, 30);
        doc.text("BARREIRAS DE ENTRADA", ML, y); y += 3;
        y = bulletList(doc, barriers, y, [160, 120, 40]);
        y += 2;
      }
    }
    y += 4;
  }

  // ── M05 — AUDIÊNCIA
  const aud = data.audience;
  if (Object.keys(aud).length > 0) {
    y = checkBreak(doc, y, 20);
    y = renderSection(doc, "05", "ARQUÉTIPO DE AUDIÊNCIA", y);

    if (str(aud["primaryAvatar"])) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      setColor(doc, 100, 70, 160);
      doc.text("5.1 — Avatar Principal", ML, y); y += 4;
      y = bodyText(doc, str(aud["primaryAvatar"]), y);
      y += 3;
    }
    if (str(aud["psychographicProfile"])) {
      y = checkBreak(doc, y, 12);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      setColor(doc, 100, 70, 160);
      doc.text("5.2 — Perfil Psicográfico", ML, y); y += 4;
      y = bodyText(doc, str(aud["psychographicProfile"]), y);
      y += 3;
    }
    if (str(aud["sophisticationStrategy"])) {
      y = checkBreak(doc, y, 12);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      setColor(doc, 100, 70, 160);
      doc.text("5.3 — Estratégia de Sofisticação", ML, y); y += 4;
      y = bodyText(doc, str(aud["sophisticationStrategy"]), y);
      y += 3;
    }
    const triggers = arr(aud["buyingTriggers"]);
    const objections = arr(aud["objections"]);
    if (triggers.length || objections.length) {
      y = checkBreak(doc, y, 15);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      setColor(doc, 100, 70, 160);
      doc.text("5.4 — Gatilhos e Objeções", ML, y); y += 4;
      if (triggers.length) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        setColor(doc, 160, 110, 30);
        doc.text("GATILHOS DE COMPRA", ML, y); y += 3;
        y = numberedList(doc, triggers, y, [160, 120, 40]);
        y += 2;
      }
      if (objections.length) {
        y = checkBreak(doc, y, 10);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        setColor(doc, 160, 40, 50);
        doc.text("OBJEÇÕES REAIS", ML, y); y += 3;
        y = numberedList(doc, objections, y, [160, 60, 70]);
        y += 2;
      }
    }
    y += 4;
  }

  // ── M06 — ARQUITETURA DA CAMPANHA
  const arch = data.architecture;
  if (Object.keys(arch).length > 0) {
    y = checkBreak(doc, y, 20);
    y = renderSection(doc, "06", "ARQUITETURA DA CAMPANHA", y);

    if (str(arch["coreNarrative"])) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      setColor(doc, 100, 70, 160);
      doc.text("6.1 — Narrativa Central", ML, y); y += 4;
      doc.setFont("helvetica", "bolditalic");
      doc.setFontSize(9);
      setColor(doc, 40, 20, 70);
      const cnLines = doc.splitTextToSize(str(arch["coreNarrative"]), CW);
      doc.text(cnLines, ML, y);
      y += cnLines.length * 3.8 + 4;
    }
    if (str(arch["emotionalHook"])) {
      y = checkBreak(doc, y, 10);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      setColor(doc, 100, 70, 160);
      doc.text("6.2 — Gancho Emocional", ML, y); y += 4;
      y = bodyText(doc, str(arch["emotionalHook"]), y);
      y += 3;
    }
    const keyMsgs = arr(arch["keyMessages"]);
    if (keyMsgs.length) {
      y = checkBreak(doc, y, 12);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      setColor(doc, 100, 70, 160);
      doc.text("6.3 — Mensagens-Chave", ML, y); y += 4;
      y = numberedList(doc, keyMsgs, y, [40, 120, 80]);
      y += 3;
    }
    const pillars = arr(arch["contentPillars"]);
    if (pillars.length) {
      y = checkBreak(doc, y, 12);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      setColor(doc, 100, 70, 160);
      doc.text("6.4 — Pilares de Conteúdo", ML, y); y += 4;
      y = bulletList(doc, pillars, y);
      y += 3;
    }
    if (str(arch["platformDistributionStrategy"])) {
      y = checkBreak(doc, y, 12);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      setColor(doc, 100, 70, 160);
      doc.text("6.5 — Distribuição por Plataforma", ML, y); y += 4;
      y = bodyText(doc, str(arch["platformDistributionStrategy"]), y);
      y += 3;
    }
    if (str(arch["callToActionStrategy"])) {
      y = checkBreak(doc, y, 10);
      y = labeledText(doc, "Estratégia de CTA", str(arch["callToActionStrategy"]), y);
    }
    y += 4;
  }

  // ── M07 — ENGENHARIA DE GATILHOS
  const tm = data.triggerMap;
  const tSeq = arr(tm["triggerStackSequence"]);
  const domTrigger = str(tm["dominantTrigger"]);
  const domJustif = str(tm["dominantTriggerJustification"]);
  const transf = str(tm["transformationBridge"]);
  const antiReq = arr(tm["antiRequisiteAngles"]);
  const socialBP = str(tm["socialProofBlueprint"]);

  if (domTrigger || tSeq.length || transf) {
    y = checkBreak(doc, y, 20);
    y = renderSection(doc, "07", "ENGENHARIA DE GATILHOS", y);

    if (domTrigger) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      setColor(doc, 100, 70, 160);
      doc.text("7.1 — Gatilho Dominante", ML, y); y += 4;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      setColor(doc, 160, 40, 50);
      doc.text(domTrigger.toUpperCase(), ML, y); y += 5;
      if (domJustif) {
        y = bodyText(doc, domJustif, y);
        y += 2;
      }
    }
    if (tSeq.length) {
      y = checkBreak(doc, y, 15);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      setColor(doc, 100, 70, 160);
      doc.text("7.2 — Sequência de Ativação Dia a Dia", ML, y); y += 4;
      y = numberedList(doc, tSeq, y, [100, 60, 170]);
      y += 3;
    }
    if (transf) {
      y = checkBreak(doc, y, 10);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      setColor(doc, 100, 70, 160);
      doc.text("7.3 — Ponte de Transformação", ML, y); y += 4;
      y = bodyText(doc, transf, y);
      y += 3;
    }
    if (antiReq.length) {
      y = checkBreak(doc, y, 12);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      setColor(doc, 100, 70, 160);
      doc.text("7.4 — Ângulos Anti-Requisito", ML, y); y += 4;
      y = numberedList(doc, antiReq, y, [160, 110, 30]);
      y += 3;
    }
    if (socialBP) {
      y = checkBreak(doc, y, 10);
      y = labeledText(doc, "Blueprint de Prova Social", socialBP, y);
    }
    y += 4;
  }

  // ── M08 — MÉTRICAS
  const met = data.metrics;
  if (Object.keys(met).length > 0) {
    y = checkBreak(doc, y, 25);
    y = renderSection(doc, "08", "MÉTRICAS DE PERFORMANCE", y);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    setColor(doc, 100, 70, 160);
    doc.text("8.1 — Unit Economics", ML, y); y += 4;

    const revenueTarget = num(met["revenueTarget"]);
    const conversionRate = num(met["conversionRateTarget"]);
    const kpis: [string, string][] = [
      ["KPI Principal", str(met["primaryKPI"])],
      ["Meta de Receita", revenueTarget ? `R$ ${revenueTarget.toLocaleString("pt-BR")}` : ""],
      ["Taxa de Conversão Alvo", conversionRate ? `${(conversionRate * 100).toFixed(1)}%` : ""],
      ["Horizonte de Lançamento", str(met["launchWindow"])],
    ];

    // KPI grid (2 columns)
    let kpiX = ML;
    let kpiY = y;
    kpis.forEach(([label, value], i) => {
      if (!value) return;
      doc.setFillColor(248, 245, 255);
      doc.setDrawColor(200, 180, 230);
      doc.setLineWidth(0.2);
      doc.rect(kpiX, kpiY, CW / 2 - 1, 12, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      setColor(doc, 130, 90, 180);
      doc.text(label.toUpperCase(), kpiX + 3, kpiY + 4);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      setColor(doc, 30, 15, 60);
      doc.text(value, kpiX + 3, kpiY + 9);

      if (i % 2 === 0) { kpiX = ML + CW / 2 + 1; }
      else { kpiX = ML; kpiY += 14; }
    });
    y = kpiY + 16;

    const assumptions = arr(met["criticalAssumptions"]);
    if (assumptions.length) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      setColor(doc, 100, 70, 160);
      doc.text("8.2 — Premissas Críticas", ML, y); y += 4;
      y = numberedList(doc, assumptions, y, [160, 110, 30]);
    }
    y += 4;
  }

  // ── M09 — ANÁLISE DE RISCOS
  const rsk = data.risks;
  if (Object.keys(rsk).length > 0) {
    y = checkBreak(doc, y, 20);
    y = renderSection(doc, "09", "ANÁLISE DE RISCOS", y);

    if (str(rsk["level"])) {
      const level = str(rsk["level"]);
      const rColor: [number, number, number] = level === "low" ? [30, 120, 80] : level === "high" ? [160, 40, 50] : [160, 110, 30];
      const rLabel = level === "low" ? "RISCO BAIXO" : level === "high" ? "RISCO ALTO" : "RISCO MÉDIO";
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      setColor(doc, ...rColor);
      doc.text(rLabel, ML, y); y += 6;
    }

    const mainRisks = arr(rsk["mainRisks"]);
    const mitigations = arr(rsk["mitigations"]);
    const maxPairs = Math.max(mainRisks.length, mitigations.length);

    if (maxPairs > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      setColor(doc, 160, 40, 50);
      doc.text("RISCO", ML, y);
      setColor(doc, 30, 120, 80);
      doc.text("MITIGAÇÃO", ML + CW / 2 + 2, y);
      y += 3;
      hline(doc, y, ML, W - MR, 200, 180, 210);
      y += 3;

      for (let i = 0; i < maxPairs; i++) {
        y = checkBreak(doc, y, 10);
        const risk = mainRisks[i] ?? "";
        const mitigation = mitigations[i] ?? "";
        const halfW = CW / 2 - 3;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        setColor(doc, 160, 60, 70);
        const rLines = risk ? doc.splitTextToSize(`▸ ${risk}`, halfW) : [];
        doc.text(rLines, ML, y);

        setColor(doc, 40, 140, 90);
        const mLines = mitigation ? doc.splitTextToSize(`▸ ${mitigation}`, halfW) : [];
        doc.text(mLines, ML + CW / 2 + 2, y);

        y += Math.max(rLines.length, mLines.length, 1) * 3.8 + 2;
        hline(doc, y - 1, ML, W - MR, 230, 225, 235);
      }
    }
    y += 4;
  }

  // ── M10 — NOTA DO ESTRATEGISTA
  if (data.strategistNotes) {
    y = checkBreak(doc, y, 20);
    y = renderSection(doc, "10", "NOTA DO ESTRATEGISTA", y);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    setColor(doc, 100, 70, 160);
    doc.text("10.1 — Diretrizes de Execução", ML, y); y += 4;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    setColor(doc, 50, 35, 75);
    const snLines = doc.splitTextToSize(data.strategistNotes, CW);
    doc.text(snLines, ML, y);
    y += snLines.length * 3.8 + 4;
  }

  // ── APPLY WATERMARK TO ALL PAGES ──────────────────────────────────────────

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    applyWatermark(doc, user, fingerprint, p, totalPages);
  }

  // ── PDF METADATA ──────────────────────────────────────────────────────────

  doc.setProperties({
    title: `NexOS AI Masterplan — ${data.campaignTitle}`,
    author: user.name,
    creator: "NexOS AI",
    subject: `Masterplan estratégico licenciado para ${user.email}`,
    keywords: `nexos-ai,masterplan,${fingerprint},${user.userId},${user.email}`,
  });

  // ── SAVE ──────────────────────────────────────────────────────────────────

  const safeName = data.campaignTitle.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase().slice(0, 30);
  doc.save(`nexos-masterplan-${safeName}-${fingerprint}.pdf`);
}
