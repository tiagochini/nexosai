import { jsPDF } from "jspdf";

interface LessonPDFOptions {
  moduleTitle: string;
  chapterTitle: string;
  lessonTitle: string;
  lessonContent: string;
  studentName: string;
  studentEmail: string;
  lessonNumber?: number;
}

const PURPLE = [88, 28, 220] as [number, number, number];
const DARK = [14, 12, 28] as [number, number, number];
const WHITE = [255, 255, 255] as [number, number, number];
const LIGHT_GRAY = [160, 155, 175] as [number, number, number];
const ACCENT = [168, 255, 210] as [number, number, number];
const RED_WARN = [200, 60, 60] as [number, number, number];

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function wrapText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxY: number, addPageFn: () => number): number {
  const lines = doc.splitTextToSize(text, maxWidth) as string[];
  for (const line of lines) {
    if (y + lineHeight > maxY) {
      y = addPageFn();
    }
    doc.text(line, x, y);
    y += lineHeight;
  }
  return y;
}

export function generateLessonPDF(opts: LessonPDFOptions): void {
  const { moduleTitle, chapterTitle, lessonTitle, lessonContent, studentName, studentEmail, lessonNumber } = opts;

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const W = 210;
  const H = 297;
  const marginX = 18;
  const contentWidth = W - marginX * 2;
  const now = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const watermarkText = `${studentName} · ${studentEmail} · ${now} · NexOS Academy`;

  function addPageBg() {
    doc.setFillColor(...DARK);
    doc.rect(0, 0, W, H, "F");
  }

  function addWatermarkDiagonal() {
    doc.saveGraphicsState();
    doc.setGState(new (doc as any).GState({ opacity: 0.07 }));
    doc.setFontSize(8);
    doc.setTextColor(...RED_WARN);
    for (let y = 30; y < H; y += 30) {
      for (let x = -30; x < W + 60; x += 70) {
        doc.text(watermarkText, x, y, { angle: 35 });
      }
    }
    doc.restoreGraphicsState();
  }

  function addFooter(pageNum: number) {
    doc.setFontSize(6.5);
    doc.setTextColor(...LIGHT_GRAY);
    const footerY = H - 8;
    doc.text("NexOS Academy · Material protegido — uso exclusivo do licenciado", marginX, footerY);
    doc.text(`Pág. ${pageNum}`, W - marginX, footerY, { align: "right" });
    doc.setFontSize(6);
    doc.setTextColor(120, 115, 140);
    doc.text(`Licenciado para: ${studentName} · ${studentEmail}`, marginX, footerY + 4);
  }

  let currentPage = 1;

  function addPage(): number {
    doc.addPage();
    currentPage++;
    addPageBg();
    addWatermarkDiagonal();
    addFooter(currentPage);
    return 20;
  }

  // --- Page 1: Cover ---
  addPageBg();
  addWatermarkDiagonal();

  // Purple header bar
  doc.setFillColor(...PURPLE);
  doc.rect(0, 0, W, 18, "F");

  doc.setFontSize(9);
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.text("NEXOS ACADEMY", marginX, 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("Metodologia de Lançamento com IA", W - marginX, 11, { align: "right" });

  // Module + chapter breadcrumb
  let y = 30;
  doc.setFontSize(8);
  doc.setTextColor(...LIGHT_GRAY);
  doc.text(`${moduleTitle} → ${chapterTitle}`, marginX, y);
  y += 5;

  if (lessonNumber) {
    doc.setFontSize(8);
    doc.setTextColor(...ACCENT);
    doc.text(`Aula ${lessonNumber}`, marginX, y);
    y += 5;
  }

  // Lesson title
  doc.setFontSize(20);
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  const titleLines = doc.splitTextToSize(lessonTitle, contentWidth) as string[];
  titleLines.forEach(line => {
    doc.text(line, marginX, y);
    y += 9;
  });
  y += 4;

  // Divider
  doc.setDrawColor(...PURPLE);
  doc.setLineWidth(0.5);
  doc.line(marginX, y, W - marginX, y);
  y += 8;

  // License box
  doc.setFillColor(30, 20, 60);
  doc.roundedRect(marginX, y, contentWidth, 22, 3, 3, "F");
  doc.setFillColor(...PURPLE);
  doc.roundedRect(marginX, y, 3, 22, 1, 1, "F");
  doc.setFontSize(8);
  doc.setTextColor(...LIGHT_GRAY);
  doc.text("Licenciado para:", marginX + 7, y + 7);
  doc.setFontSize(10);
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.text(studentName, marginX + 7, y + 14);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...LIGHT_GRAY);
  doc.text(studentEmail, marginX + 7, y + 19);
  y += 30;

  // Anti-piracy warning
  doc.setFillColor(60, 15, 15);
  doc.roundedRect(marginX, y, contentWidth, 18, 2, 2, "F");
  doc.setFontSize(7.5);
  doc.setTextColor(...RED_WARN);
  doc.setFont("helvetica", "bold");
  doc.text("🛡 SISTEMA ANTIPIRATARIA ATIVADO", marginX + 5, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 140, 140);
  doc.text("Este PDF contém marcas d'água invisíveis e visíveis com seus dados. Qualquer cópia ou", marginX + 5, y + 11);
  doc.text("compartilhamento não autorizado viola a Lei 9.610/98 e permite rastrear a origem.", marginX + 5, y + 15);
  y += 26;

  // Date + meta
  doc.setFontSize(8);
  doc.setTextColor(...LIGHT_GRAY);
  doc.text(`Emitido em: ${now}`, marginX, y);

  addFooter(1);

  // --- Page 2+: Content ---
  y = addPage();

  // Content header
  doc.setFontSize(11);
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.text("Conteúdo da Aula", marginX, y);
  y += 6;

  doc.setDrawColor(50, 40, 80);
  doc.setLineWidth(0.3);
  doc.line(marginX, y, W - marginX, y);
  y += 8;

  // Content body
  const cleanContent = stripHtml(lessonContent);
  const paragraphs = cleanContent.split(/\n+/);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(210, 205, 225);

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    const isBullet = trimmed.startsWith("•");
    const indent = isBullet ? marginX + 4 : marginX;
    const width = isBullet ? contentWidth - 4 : contentWidth;

    if (isBullet) {
      doc.setTextColor(...ACCENT);
      doc.text("•", marginX, y);
      doc.setTextColor(210, 205, 225);
    }

    const lines = doc.splitTextToSize(trimmed.replace(/^•\s*/, ""), width) as string[];
    for (const line of lines) {
      if (y + 5.5 > H - 18) {
        y = addPage();
      }
      doc.text(line, indent, y);
      y += 5.5;
    }
    y += 2;
  }

  // --- Final page: Reflection ---
  y = addPage();

  doc.setFillColor(20, 14, 50);
  doc.roundedRect(marginX, y, contentWidth, 40, 3, 3, "F");
  doc.setFontSize(10);
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.text("Espaço de Reflexão", marginX + 6, y + 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...LIGHT_GRAY);
  doc.text("O que aprendi nesta aula:", marginX + 6, y + 16);
  doc.text("Ação que vou tomar:", marginX + 6, y + 24);
  doc.text("Insight principal:", marginX + 6, y + 32);

  // Save
  const filename = `nexos-${lessonTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}-${studentName.split(" ")[0].toLowerCase()}.pdf`;
  doc.save(filename);
}
