import jsPDF from "jspdf";

const PURPLE = [124, 58, 237] as const;
const GREEN = [16, 185, 129] as const;
const DARK = [14, 18, 32] as const;
const DARK2 = [20, 26, 44] as const;
const GRAY = [90, 100, 130] as const;
const WHITE = [255, 255, 255] as const;
const RED = [220, 60, 60] as const;

const W = 210;
const H = 297;

function addWatermark(doc: jsPDF, email: string) {
  doc.saveGraphicsState();
  doc.setGState(new (doc as any).GState({ opacity: 0.07 }));
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...PURPLE);
  const text = `LICENCIADO PARA ${email.toUpperCase()}`;
  for (let y = 30; y < H; y += 32) {
    for (let x = -10; x < W + 30; x += 80) {
      doc.text(text, x, y, { angle: 40 });
    }
  }
  doc.restoreGraphicsState();
}

function addFooter(doc: jsPDF, name: string, email: string, page: number, total: number) {
  doc.setFillColor(10, 14, 26);
  doc.rect(0, H - 14, W, 14, "F");
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY);
  doc.text(
    `Licenciado para ${name} <${email}> · Reprodução proibida — Lei 9.610/98`,
    W / 2, H - 7, { align: "center" }
  );
  doc.text(`${page} / ${total}`, W - 10, H - 7, { align: "right" });
}

function newPage(doc: jsPDF, name: string, email: string, page: number, total: number) {
  doc.addPage();
  addWatermark(doc, email);
  addFooter(doc, name, email, page, total);
}

function sectionHeader(doc: jsPDF, num: string, title: string, sub: string, y: number): number {
  doc.setFillColor(...PURPLE);
  doc.roundedRect(14, y, 20, 12, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...WHITE);
  doc.text(num, 24, y + 8.5, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...WHITE);
  doc.text(title.toUpperCase(), 38, y + 6);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text(sub, 38, y + 11);
  return y + 20;
}

function card(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setFillColor(20, 26, 44);
  doc.setDrawColor(40, 50, 80);
  doc.roundedRect(x, y, w, h, 3, 3, "FD");
}

function bodyText(doc: jsPDF, text: string, x: number, y: number, maxW: number): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(180, 190, 215);
  const lines = doc.splitTextToSize(text, maxW);
  doc.text(lines, x, y);
  return y + lines.length * 5;
}

function boldText(doc: jsPDF, text: string, x: number, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...WHITE);
  doc.text(text, x, y);
  return y + 6;
}

function quoteBlock(doc: jsPDF, text: string, x: number, y: number, w: number): number {
  const lines = doc.splitTextToSize(`"${text}"`, w - 8);
  const h = lines.length * 5 + 10;
  doc.setFillColor(30, 25, 60);
  doc.setDrawColor(...PURPLE);
  doc.setLineWidth(0.5);
  doc.roundedRect(x, y, w, h, 2, 2, "FD");
  doc.setFont("helvetica", "bolditalic");
  doc.setFontSize(8.5);
  doc.setTextColor(180, 160, 255);
  doc.text(lines, x + 4, y + 6);
  return y + h + 4;
}

function greenHighlight(doc: jsPDF, label: string, text: string, x: number, y: number, w: number): number {
  const lines = doc.splitTextToSize(text, w - 8);
  const h = lines.length * 5 + 14;
  doc.setFillColor(10, 40, 30);
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.4);
  doc.roundedRect(x, y, w, h, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...GREEN);
  doc.text(label, x + 4, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(180, 230, 200);
  doc.text(lines, x + 4, y + 12);
  return y + h + 4;
}

function scriptBlock(doc: jsPDF, title: string, text: string, x: number, y: number, w: number, color: number[]): number {
  const titleH = 8;
  doc.setFillColor(color[0], color[1], color[2]);
  doc.roundedRect(x, y, w, titleH, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...WHITE);
  doc.text(title.toUpperCase(), x + 4, y + 5.5);

  const lines = doc.splitTextToSize(text, w - 8);
  const bodyH = lines.length * 4.5 + 8;
  doc.setFillColor(10, 14, 26);
  doc.rect(x, y + titleH, w, bodyH, "F");
  doc.setFont("courier", "normal");
  doc.setFontSize(8);
  doc.setTextColor(220, 220, 240);
  doc.text(lines, x + 4, y + titleH + 6);
  return y + titleH + bodyH + 4;
}

export async function generateMiniGuidePDF(name: string, email: string): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const TOTAL_PAGES = 14;
  let p = 1;

  // ── CAPA ────────────────────────────────────────────────────────────────────
  doc.setFillColor(...DARK);
  doc.rect(0, 0, W, H, "F");
  addWatermark(doc, email);

  // Purple accent top
  doc.setFillColor(...PURPLE);
  doc.rect(0, 0, W, 4, "F");

  // Badge
  doc.setFillColor(40, 20, 80);
  doc.setDrawColor(...PURPLE);
  doc.roundedRect(14, 30, 60, 8, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...PURPLE);
  doc.text("MANUAL DE GUERRA NEXOS", 44, 35.5, { align: "center" });

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(...WHITE);
  doc.text("O Mapa para os", 14, 65);
  doc.setTextColor(...PURPLE);
  doc.text("Primeiros R$ 10.000", 14, 80);
  doc.setTextColor(...WHITE);
  doc.text("em Vendas Online", 14, 95);

  // Subtitle
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(150, 160, 200);
  const sub = doc.splitTextToSize(
    "Você não precisa de um exército. Você precisa de uma sequência. Este guia não é teoria — é o plano operacional para quem quer sair do zero e chegar aos 5 dígitos no Brasil real.",
    W - 28
  );
  doc.text(sub, 14, 108);

  // Badges row
  const badges = ["10 Capítulos Práticos", "Scripts de Copy Prontos", "Estratégia Sem Seguidores"];
  let bx = 14;
  badges.forEach(b => {
    doc.setFillColor(35, 25, 70);
    doc.setDrawColor(80, 50, 160);
    doc.roundedRect(bx, 135, b.length * 2.2 + 8, 8, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(180, 160, 255);
    doc.text(`⚡ ${b}`, bx + 4, 140.5);
    bx += b.length * 2.2 + 13;
  });

  // Divider
  doc.setDrawColor(...PURPLE);
  doc.setLineWidth(0.3);
  doc.line(14, 155, W - 14, 155);

  // Licensed to
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 110, 150);
  doc.text("DOCUMENTO LICENCIADO PARA:", 14, 165);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...WHITE);
  doc.text(name, 14, 173);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...PURPLE);
  doc.text(email, 14, 180);

  // Legal warning
  doc.setFillColor(60, 10, 10);
  doc.setDrawColor(180, 40, 40);
  doc.roundedRect(14, 190, W - 28, 18, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...RED);
  doc.text("⚠️  PROTEÇÃO ANTIPIRATARIA", 16, 196);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(220, 150, 150);
  const warn = doc.splitTextToSize(
    `Este documento contém marca d'água digital vinculada ao adquirente. A distribuição não autorizada configura crime previsto na Lei 9.610/98 e sujeita o infrator a indenização mínima de R$ 10.000 por cópia distribuída.`,
    W - 36
  );
  doc.text(warn, 16, 201.5);

  // Date
  doc.setFontSize(7);
  doc.setTextColor(...GRAY);
  doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, 14, 218);

  doc.setFillColor(...DARK);
  doc.rect(0, H - 14, W, 14, "F");
  doc.setFontSize(7);
  doc.setTextColor(...GRAY);
  doc.text(`Licenciado exclusivamente para ${name} <${email}> · Lei 9.610/98`, W / 2, H - 7, { align: "center" });
  doc.text(`${p} / ${TOTAL_PAGES}`, W - 10, H - 7, { align: "right" });

  // ── CAP 1: O Fim das Desculpas ──────────────────────────────────────────────
  newPage(doc, name, email, ++p, TOTAL_PAGES);
  let y = 18;
  y = sectionHeader(doc, "01", "O Fim das Desculpas", 'Professor Allan: "Onde o amador trava e o profissional fatura"', y);
  y = quoteBlock(doc, "Você não está vendendo porque está tentando ser perfeito. E a perfeição é o disfarce covarde da procrastinação.", 14, y, W - 28);
  y = bodyText(doc, "Existem 3 bloqueios que matam iniciantes antes do Dia 1:", 14, y, W - 28);
  y += 2;
  const bloqueios = [
    ["1. 'Nao tenho autoridade'", "A autoridade nao e dada, e tomada. Se voce resolve um problema, voce e o perito para quem tem aquele problema."],
    ["2. 'O produto nao esta pronto'", "Vender produto pronto e coisa de amador. Profissional vende a promessa e cria com o dinheiro do cliente no bolso."],
    ["3. 'Nao tenho seguidores'", "Seguidor e metrica de ego. Dinheiro no bolso vem de atencao direcionada. 10 pessoas certas valem mais que 10.000 curiosos."],
  ];
  bloqueios.forEach(([t, d]) => {
    const lines = doc.splitTextToSize(d, (W - 28) / 3 - 6);
    const h = lines.length * 4.5 + 12;
    card(doc, 14, y, (W - 28) / 3 - 2, h);
    y += 2;
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...PURPLE);
    doc.text(t, 18, y + 4);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(160, 170, 210);
    doc.text(lines, 18, y + 9);
    // next col
    if (bloqueios.indexOf([t, d]) === 0) y -= 2;
  });

  // Redo properly with 3 columns
  y = 100;
  const colW = (W - 34) / 3;
  bloqueios.forEach(([t, d], i) => {
    const cx = 14 + i * (colW + 3);
    const lines = doc.splitTextToSize(d, colW - 6);
    const h = lines.length * 4.5 + 14;
    card(doc, cx, y, colW, h);
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...PURPLE);
    doc.text(t, cx + 3, y + 5);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(160, 170, 210);
    doc.text(lines, cx + 3, y + 10);
  });
  y += 55;

  y = greenHighlight(doc, "🔥 EXERCÍCIO IMEDIATO:", "Escreva em uma folha: \"Eu não preciso de permissão para vender. Eu só preciso de um problema para resolver.\" Cole no seu monitor.", 14, y, W - 28);

  // ── CAP 2: Validação Flash ──────────────────────────────────────────────────
  newPage(doc, name, email, ++p, TOTAL_PAGES);
  y = 18;
  y = sectionHeader(doc, "02", "Validação Flash (Em 2 Horas)", "Como saber se seu tema põe dinheiro no bolso antes de gastar um centavo", y);
  y = bodyText(doc, "Não pergunte se as pessoas comprariam. DÊ a elas a chance de comprar. A única pesquisa de mercado real é o comprovante de Pix.", 14, y, W - 28);
  y += 4;
  boldText(doc, "O Protocolo de 2 Horas:", 14, y); y += 8;
  const proto = [
    "01. Pesquise no TikTok/Insta: 'Como [seu tema]'. Se tiver vídeos com +50k views, o mercado existe.",
    "02. Leia os comentários. Procure por: 'Eu tenho dificuldade em...', 'Como eu faço pra...'.",
    "03. Crie uma oferta de 'Acompanhamento Único' ou 'Mentoria Experimental' para resolver EXATAMENTE o que eles comentaram.",
  ];
  proto.forEach(s => { y = bodyText(doc, s, 18, y, W - 36); y += 2; });
  y += 4;

  // Case block
  doc.setFillColor(12, 16, 28);
  doc.setDrawColor(50, 40, 90);
  doc.roundedRect(14, y, W - 28, 55, 3, 3, "FD");
  doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(...PURPLE);
  doc.text("EXEMPLO REAL — O CASO DA MARMITA", 18, y + 6);
  const caseText = "Aline sabia cozinhar saudável. Em vez de curso de culinária, ela viu que as pessoas reclamavam de \"falta de tempo para organizar a semana\".\n\nAção: Ela mandou 5 mensagens no WhatsApp para amigas ocupadas: \"Vou fazer um grupo de 3 dias ensinando a organizar 15 marmitas em 2h por R$47. Topa?\".\n\nResultado: 4 pagaram em 15 minutos. Validação concluída com R$188 no bolso.";
  const caseLines = doc.splitTextToSize(caseText, W - 42);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(170, 180, 215);
  doc.text(caseLines, 18, y + 12);

  // ── CAP 3: Audiência Rápida ─────────────────────────────────────────────────
  newPage(doc, name, email, ++p, TOTAL_PAGES);
  y = 18;
  y = sectionHeader(doc, "03", "Audiência Rápida: 100 Leads em 7 Dias", "O metodo da 'Infiltracao Estrategica' para quem tem 0 seguidores", y);
  y = bodyText(doc, "Pare de tentar ser um \"influenciador\". Seja um solucionador de problemas onde o problema já está acontecendo.", 14, y, W - 28);
  y += 6;
  const cols3 = [
    ["1. Grupos de WhatsApp/FB", "Entre em 10 grupos do seu nicho. Não poste link. RESPONDA dúvidas com áudios de 30s. No final diga: \"Tenho um PDF que explica isso com detalhes, quer que eu te mande no privado?\""],
    ["2. A Técnica do Comentário Top", "Vá em posts de grandes players do seu nicho. Responda os comentários de quem está com dúvida. Seja tão útil que a pessoa vai clicar no seu perfil. Tenha um link de WhatsApp na Bio."],
  ];
  cols3.forEach(([t, d], i) => {
    const cx = 14 + i * (91);
    const lines = doc.splitTextToSize(d, 83);
    const h = lines.length * 4.5 + 14;
    card(doc, cx, y, 88, h);
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...PURPLE);
    doc.text(t, cx + 3, y + 5);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(160, 170, 210);
    doc.text(lines, cx + 3, y + 10);
  });
  y += 52;
  y = scriptBlock(doc, "Script de Infiltração (DM)", "Oi [Nome]! Vi sua dúvida lá no grupo do [Nicho] sobre [Problema].\n\nEu passei exatamente por isso mês passado e resolvi usando [Uma pequena dica].\n\nEu montei um checklist rápido com os 3 passos pra resolver isso de vez. Quer que eu te mande o link aqui?", 14, y, W - 28, [...PURPLE]);

  // ── CAP 4: Checklist 7 Dias ─────────────────────────────────────────────────
  newPage(doc, name, email, ++p, TOTAL_PAGES);
  y = 18;
  y = sectionHeader(doc, "04", "O Checklist de Guerra: 7 Dias para o Pix", "A sequência exata. Sem desvios. Sem invenções.", y);
  const dias = [
    ["Dia 1", "A Isca Magnética", "Crie um PDF de 1 página ou vídeo de 5 min resolvendo 1 dor pequena. Chame 10 pessoas no privado e entregue."],
    ["Dia 2", "O Feedback de Ouro", "Pergunte: \"O que você achou mais difícil de aplicar disso?\". Isso vai ser seu curso. Não venda nada hoje."],
    ["Dia 3", "O Post de Antecipação", "Poste: \"Muita gente perguntou... Vou abrir 5 vagas para ajudar pessoalmente.\" Cria escassez antes do preço."],
    ["Dia 4", "A Oferta Irresistível", "Abra o carrinho. Preço \"ridículo para não comprar\": R$97 ou R$197. Fale de resultado, não de ferramenta."],
    ["Dia 5", "O Quebra-Objeções", "Poste respondendo dúvidas. Se ninguém comprou: chame 1 por 1 e pergunte o que travou."],
    ["Dia 6", "A Urgência Real", "Mostre que vagas estão acabando. Poste o print. \"Restam apenas 2 vagas com esse preço.\""],
    ["Dia 7", "Fechamento e Entrega", "Carrinho fecha às 23:59. Última chamada: \"Faltam 3 horas. É agora ou nunca.\""],
  ];
  dias.forEach(([dia, task, desc]) => {
    if (y > 250) { newPage(doc, name, email, ++p, TOTAL_PAGES); y = 18; }
    doc.setFillColor(...PURPLE);
    doc.circle(16.5, y + 2, 1.8, "F");
    doc.setDrawColor(...PURPLE);
    doc.setLineWidth(0.3);
    if (dia !== "Dia 7") doc.line(16.5, y + 4, 16.5, y + 16);
    doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(...PURPLE);
    doc.text(dia.toUpperCase(), 22, y + 2);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...WHITE);
    doc.text(task, 22, y + 7);
    const dlines = doc.splitTextToSize(desc, W - 40);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(160, 170, 210);
    doc.text(dlines, 22, y + 12);
    y += dlines.length * 4.5 + 14;
  });

  // ── CAP 5: Produto Escada ───────────────────────────────────────────────────
  newPage(doc, name, email, ++p, TOTAL_PAGES);
  y = 18;
  y = sectionHeader(doc, "05", "O Produto Escada: De R$1k a R$10k", "Como escalar sem precisar de 1 milhão de clientes", y);
  y = bodyText(doc, "O maior erro é tentar vender um produto de R$10k para quem nunca te deu R$1. A escada resolve isso.", 14, y, W - 28);
  y += 6;

  // Table
  const tableData = [
    ["A Atração", "Workshop/Mini-curso", "R$ 97", "103 vendas (difícil)"],
    ["O Método", "Curso Completo / Mentoria em Grupo", "R$ 497", "20 vendas (IDEAL)"],
    ["A Elite", "Mentoria Individual / Consultoria", "R$ 2.000+", "5 vendas (lucrativo)"],
  ];
  const colsW = [32, 68, 26, 42];
  const rowH = 12;
  let tx = 14;
  const headers = ["Nível", "Produto", "Preço", "Vendas p/ R$10k"];
  doc.setFillColor(20, 14, 40);
  doc.rect(tx, y, colsW.reduce((a, b) => a + b, 0), rowH, "F");
  headers.forEach((h, i) => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(...GRAY);
    doc.text(h.toUpperCase(), tx + 3, y + 7);
    tx += colsW[i];
  });
  y += rowH;
  tableData.forEach((row, ri) => {
    tx = 14;
    if (ri % 2 === 1) { doc.setFillColor(25, 20, 50); doc.rect(tx, y, colsW.reduce((a, b) => a + b, 0), rowH, "F"); }
    row.forEach((cell, ci) => {
      doc.setFont("helvetica", ci === 2 && ri === 1 ? "bold" : "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(ci === 0 ? 180 : (ci === 2 && ri === 1 ? 16 : 220), ci === 0 ? 160 : (ci === 2 && ri === 1 ? 185 : 225), ci === 0 ? 255 : (ci === 2 && ri === 1 ? 129 : 240));
      doc.text(cell, tx + 3, y + 7);
      tx += colsW[ci];
    });
    y += rowH;
  });
  y += 8;
  y = greenHighlight(doc, "💡 A Matemática dos R$ 10k:", "Não tente vender para 100 pessoas. Venda um curso de R$497 para 15 pessoas e ofereça um upgrade de mentoria individual por +R$1.500 para 2 delas. Total: R$10.455. Mais simples do que parece, se você tiver o produto escada.", 14, y, W - 28);

  // ── CAP 6: Scripts de Copy ──────────────────────────────────────────────────
  newPage(doc, name, email, ++p, TOTAL_PAGES);
  y = 18;
  y = sectionHeader(doc, "06", "Scripts de Copy (Ouro Puro)", "Copie, cole, adapte e venda.", y);
  y = scriptBlock(doc, "O Post de Oferta Direta", "Cansado de [Dor Principal]?\n\nEu vejo muita gente tentando [O que não funciona] e acabando com [Resultado Ruim].\n\nEu criei um método simples pra você chegar em [Resultado Desejado] em apenas [Tempo], sem precisar de [O que eles odeiam].\n\nVou abrir apenas 5 vagas para o [Nome do seu Produto] hoje.\n\n👇 Comente 'QUERO' abaixo e eu te mando os detalhes no privado.", 14, y, W - 28, [...PURPLE]);
  y += 4;
  y = scriptBlock(doc, "O Stories de Urgência", "[Foto de um comprovante de Pix borrado ou de um aluno]\n\nMais uma pessoa garantiu a vaga agora! 🔥\n\nAgora restam oficialmente apenas 2 vagas com o bônus de [Algum Bônus].\n\nDepois que essas 2 saírem, o preço volta para R$ [Preço Cheio].\n\nToca no link da Bio agora ou responde 'VAGA' aqui.", 14, y, W - 28, [...GREEN]);

  // ── CAP 7: Matador de Objeções ──────────────────────────────────────────────
  newPage(doc, name, email, ++p, TOTAL_PAGES);
  y = 18;
  y = sectionHeader(doc, "07", "O Matador de Objeções", "As 5 barreiras que impedem o Pix e como destruí-las", y);
  const objecoes = [
    ["Tá caro", "Caro comparado a quê? Se esse método te fizer economizar R$ 2.000 em 1 mês, ele está de graça. Você não está pagando um curso, está comprando seu tempo de volta."],
    ["Não tenho tempo", "Exatamente por isso você precisa disso. O método foi feito para quem tem apenas 30 min por dia. Se você não tem 30 min para mudar sua vida, o tempo é seu maior problema."],
    ["Será que funciona pra mim?", "O método foi testado por [Exemplo de perfil]. Se você fizer o passo a passo, o resultado é matemático. E se não funcionar, você tem 7 dias de garantia total."],
    ["Vou pensar", "Pensar não traz resultado. Decidir sim. Enquanto você pensa, outros estão ocupando as vagas e faturando o que você poderia estar faturando."],
    ["Não sei se é o momento", "Nunca vai ser o momento perfeito. O momento perfeito é construído pela sua decisão de começar hoje."],
  ];
  objecoes.forEach(([obj, resp]) => {
    if (y > 255) { newPage(doc, name, email, ++p, TOTAL_PAGES); y = 18; }
    const rlines = doc.splitTextToSize(`Você diz: "${resp}"`, W - 40);
    const h = rlines.length * 4.5 + 16;
    card(doc, 14, y, W - 28, h);
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(...GRAY);
    doc.text(`Se ele disser: "${obj}"`, 18, y + 5);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...WHITE);
    doc.text(rlines, 18, y + 10);
    y += h + 4;
  });

  // ── CAP 8: WhatsApp Direct ──────────────────────────────────────────────────
  newPage(doc, name, email, ++p, TOTAL_PAGES);
  y = 18;
  y = sectionHeader(doc, "08", "Estratégia WhatsApp Direct", "O metodo 'Invisivel' para vender sem aparecer no Instagram", y);
  y = bodyText(doc, "O WhatsApp é a maior ferramenta de vendas do mundo. Se você tem 50 contatos, você tem 50 chances de fazer R$ 1k hoje.", 14, y, W - 28);
  y += 6;
  boldText(doc, "A Técnica do Status de 3 Passos:", 14, y); y += 8;
  const steps8 = [
    ["01", "Status 1:", "Uma pergunta sobre a dor. \"Alguém aqui também sofre para [Problema]?\""],
    ["02", "Status 2:", "A solução. \"Eu descobri um jeito de resolver isso em 10 min. Olha o resultado: [Foto/Print]\""],
    ["03", "Status 3:", "O CTA. \"Vou ensinar 3 pessoas a fazerem o mesmo hoje. Me chama aqui agora.\""],
  ];
  steps8.forEach(([n, label, text]) => {
    doc.setFillColor(...GREEN);
    doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(10, 20, 14);
    doc.roundedRect(16, y, 7, 7, 1, 1, "F");
    doc.text(n, 19.5, y + 5, { align: "center" });
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...WHITE);
    doc.text(label, 26, y + 5);
    doc.setFont("helvetica", "normal"); doc.setTextColor(170, 220, 190);
    doc.text(text, 50, y + 5);
    y += 10;
  });
  y += 4;
  y = quoteBlock(doc, "Isso funciona porque no WhatsApp a barreira é menor. É uma conversa, não um anúncio. Seja pessoal, não um robô. — Allan", 14, y, W - 28);

  // ── CAP 9: Erros Fatais ─────────────────────────────────────────────────────
  newPage(doc, name, email, ++p, TOTAL_PAGES);
  y = 18;
  y = sectionHeader(doc, "09", "Tabela de Erros Fatais", "O que NÃO fazer se você quer chegar aos R$ 10k", y);
  const erros = [
    ["Gastar R$ 2k em tráfego sem validar a oferta", "Validar no 1:1 e WhatsApp antes de gastar R$ 1"],
    ["Esperar o site ficar 'perfeito' para lançar", "Usar um link de pagamento e um PDF direto"],
    ["Falar das 'ferramentas' do seu curso", "Falar da TRANSFORMAÇÃO e do RESULTADO"],
    ["Ignorar quem não comprou", "Pedir feedback para entender onde você errou no copy"],
  ];
  // header
  const errW = (W - 28) / 2;
  doc.setFillColor(40, 15, 15); doc.rect(14, y, errW, 9, "F");
  doc.setFillColor(10, 30, 20); doc.rect(14 + errW, y, errW, 9, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...RED);
  doc.text("AÇÃO AMADORA", 18, y + 6);
  doc.setTextColor(...GREEN);
  doc.text("AÇÃO NEXOS", 18 + errW, y + 6);
  y += 9;
  erros.forEach(([bad, good], ri) => {
    const blines = doc.splitTextToSize(bad, errW - 8);
    const glines = doc.splitTextToSize(good, errW - 8);
    const rh = Math.max(blines.length, glines.length) * 4.5 + 10;
    if (ri % 2 === 0) { doc.setFillColor(18, 10, 10); doc.rect(14, y, errW, rh, "F"); doc.setFillColor(10, 18, 12); doc.rect(14 + errW, y, errW, rh, "F"); }
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(220, 150, 150);
    doc.text(blines, 18, y + 7);
    doc.setTextColor(150, 230, 180);
    doc.text(glines, 18 + errW, y + 7);
    y += rh;
  });

  // ── CAP 10: Estudos de Caso ─────────────────────────────────────────────────
  newPage(doc, name, email, ++p, TOTAL_PAGES);
  y = 18;
  y = sectionHeader(doc, "10", "Estudos de Caso: O Erro que Salvou Tudo", "Histórias reais de quem quase quebrou e virou o jogo", y);
  const cases = [
    {
      title: "O Mentor que Não Vendia",
      color: [...PURPLE],
      text: "Marcos tentou lançar uma mentoria de R$ 2.000 direto para desconhecidos. Erro: Falta de escada de valor.\n\nA virada: Criou um workshop de R$ 97 sobre \"Os 3 Pilares\". Vendeu 30 vagas (R$ 2.910). No final do workshop, ofereceu a mentoria de R$ 2k para quem queria ajuda pessoal. 6 pessoas compraram.\n\nResultado Final: R$ 14.910 em 10 dias.",
    },
    {
      title: "A 'Loja' que virou Curso",
      color: [...GREEN],
      text: "Júlia vendia planners físicos. Margem pequena, logística infernal. Erro: Escalar produto físico sem capital.\n\nA virada: Parou de vender o planner e começou a vender o MÉTODO de organização de rotina por R$ 197. Custo zero de entrega.\n\nResultado: 52 vendas no primeiro mês = R$ 10.244 limpos no bolso.",
    },
  ];
  cases.forEach(({ title, color, text }, i) => {
    const caseLines = doc.splitTextToSize(text, 80);
    const h = caseLines.length * 4.5 + 18;
    const cx = 14 + i * 94;
    card(doc, cx, y, 88, h);
    doc.setDrawColor(color[0], color[1], color[2]);
    doc.setLineWidth(1);
    doc.line(cx, y, cx + 88, y);
    doc.setLineWidth(0.2);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...WHITE);
    doc.text(title, cx + 4, y + 7);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(160, 170, 210);
    doc.text(caseLines, cx + 4, y + 13);
  });
  y += 85;

  // ── PRÓXIMA MISSÃO ──────────────────────────────────────────────────────────
  if (y > 200) { newPage(doc, name, email, ++p, TOTAL_PAGES); y = 18; }
  doc.setFillColor(20, 15, 45);
  doc.setDrawColor(80, 50, 160);
  doc.setLineWidth(0.5);
  doc.roundedRect(14, y, W - 28, 70, 4, 4, "FD");
  doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(...WHITE);
  doc.text("SUA PRÓXIMA MISSÃO", W / 2, y + 16, { align: "center" });
  const missText = "Você tem o mapa. Você tem os scripts. Você tem a sequência.\nAgora, você tem uma escolha: continuar tentando sozinho\nou usar a inteligência que orquestrou este guia para lançar para você.";
  const missLines = doc.splitTextToSize(missText, W - 56);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(170, 180, 220);
  doc.text(missLines, W / 2, y + 26, { align: "center" });
  doc.setFillColor(...PURPLE);
  doc.roundedRect(W / 2 - 55, y + 50, 110, 12, 3, 3, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...WHITE);
  doc.text("ATIVAR METODOLOGIA NEXOS COMPLETA →", W / 2, y + 57.5, { align: "center" });
  doc.text("agencianexos.vip", W / 2, y + 67, { align: "center" });

  // Save
  const safeName = name.replace(/[^a-zA-Z0-9\s]/g, "").trim().replace(/\s+/g, "_");
  doc.save(`NexOS_Mapa_10K_${safeName}.pdf`);
}
