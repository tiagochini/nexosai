import { jsPDF } from "jspdf";

const PURPLE = [88, 28, 220] as const;
const DARK = [14, 12, 28] as const;
const LIGHT_GRAY = [160, 155, 175] as const;
const WHITE = [255, 255, 255] as const;
const RED = [220, 60, 60] as const;
const GREEN = [20, 180, 120] as const;

const ERRORS = [
  {
    n: "01",
    titulo: "Postar para todo mundo — e não falar com ninguém",
    descricao:
      "Tem um conteúdo que agrada a todos e converte zero. Quando você tenta falar com 'quem quer crescer online', você não fala com ninguém de verdade. O algoritmo não é o seu problema — é a falta de um avatar tão específico que, ao ler seu post, a pessoa pensa: 'como ele sabe exatamente o que eu estou vivendo?'",
    aprofundamento:
      "A especificidade é contra-intuitiva. Parece que restringir o público vai diminuir o alcance. Na prática, é o oposto: quanto mais específico for o problema que você resolve, mais as pessoas certas te compartilham para outras pessoas certas.",
    exemplo:
      "Felipe criava conteúdo de 'saúde e bem-estar' há 11 meses. 1.200 seguidores, engajamento morto. Quando mudou o posicionamento para 'homens acima dos 40 que querem emagrecer sem abrir mão de churrasco e cerveja no fim de semana', foi de 1.200 para 8.400 seguidores em 4 meses — e vendeu R$34k no primeiro lançamento.",
    correcao:
      "Escreva a frase: 'Meu conteúdo é para [cargo/situação específica] que quer [resultado concreto] sem [sacrifício que detestam].' Se você travar na frase, seu posicionamento ainda não está pronto.",
  },
  {
    n: "02",
    titulo: "Ensinar demais, conectar de menos",
    descricao:
      "O criador que só educa cria audiência de leitores. O criador que educa e se revela cria audiência de seguidores fiéis. A diferença é brutal: a primeira te lê enquanto você é útil. A segunda te segue enquanto você existe.",
    aprofundamento:
      "Conteúdo puramente educativo tem prazo de validade. Quando alguém aprende o que você ensina, não precisa mais de você. Mas quando você mostra seu processo — seus erros, suas dúvidas, o que estava errado antes de acertar — você cria algo que nenhum concorrente consegue copiar: a sua história.",
    exemplo:
      "Camila ensinava design para iniciantes com posts de dicas e tutoriais. Platôu em 3.200 seguidores. Publicou um carrossel 'Os 3 projetos que me envergonham hoje — e o que cada um me ensinou'. Foi compartilhado 847 vezes. Ganhou 1.100 seguidores naquela semana.",
    correcao:
      "A proporção que funciona: 60% ensino prático, 30% história pessoal e processo, 10% bastidores e vulnerabilidade calculada. 'Vulnerabilidade calculada' não é expor tudo — é escolher uma dificuldade real que seu avatar também vive, mostrar como você passou por ela, e extrair o aprendizado.",
  },
  {
    n: "03",
    titulo: "Consistência de volume sem consistência de qualidade",
    descricao:
      "Ninguém te disse que postar todo dia é uma armadilha. O algoritmo recompensa frequência, mas a audiência recompensa impacto. Você pode postar 30 vezes por mês e encolher — ou postar 8 vezes e crescer 40%. A diferença não está na quantidade. Está em quantas vezes por mês você publicou algo que fez a pessoa parar o scroll.",
    aprofundamento:
      "Existe um fenômeno chamado fadiga de criador. Quando você se compromete com volume antes de dominar a essência de cada peça, começa a produzir por obrigação — e sua audiência sente. Um post feito com pressa transmite pressa. Um post feito com intenção transmite intenção.",
    exemplo:
      "Renata postava stories todos os dias. Crescia 80 seguidores por mês. Quando passou a publicar apenas quando tinha algo real para dizer — uma descoberta, um caso de aluno, um erro —, foi para 400 seguidores por mês. Menos posts, mais crescimento.",
    correcao:
      "Crie um banco de 'momentos de insight' — anote quando algo te surpreendeu, quando um cliente disse algo revelador, quando você errou e entendeu o porquê. Esses momentos reais valem mais do que qualquer calendário editorial.",
  },
  {
    n: "04",
    titulo: "O gancho que não para o scroll — os 3 primeiros segundos",
    descricao:
      "Você pode ter o melhor conteúdo do mundo no segundo 0:30. Se os primeiros 3 segundos não prenderem, ninguém vai chegar lá. O algoritmo mede retenção desde o primeiro frame. Queda imediata = distribuição zero.",
    aprofundamento:
      "Anatomia do gancho que converte: (1) Uma afirmação que incomoda ou intriga. (2) Uma pergunta que o avatar faz para si mesmo toda semana. (3) Uma promessa de revelação de algo que poucos sabem. Ganchos fracos começam com 'Hoje vou falar sobre...'. Ganchos fortes começam com o problema, a dor, a contradição — sem apresentação.",
    exemplo:
      "Daniel começava todos os vídeos com 'Olá galera, hoje trago mais um conteúdo sobre...' Média de retenção: 22%. Reformulou o início: começava direto na frase mais forte. Retenção foi para 61%. O mesmo conteúdo. Apenas os primeiros 8 segundos mudaram.",
    correcao:
      "Antes de publicar, escreva os primeiros 15 segundos como se estivesse respondendo: 'O que eu diria se só tivesse 3 segundos para convencer essa pessoa a não sair?' Se a resposta não é como você começa, inverta. Comece pelo mais forte. Sempre.",
  },
  {
    n: "05",
    titulo: "Ignorar quem já te segue — e só pensar em crescer",
    descricao:
      "Você trata seus seguidores atuais como plateia e fica em busca de novos espectadores. Mas as pessoas que já te seguem são seus melhores vendedores, depoentes e distribuidores — e a maioria dos criadores as ignora completamente depois do follow.",
    aprofundamento:
      "A matemática simples: se 3% dos seus 5.000 seguidores te recomendam para uma pessoa cada, você ganha 150 novos seguidores por mês sem criar nada novo. Para 3% recomendar, precisam ter tido uma experiência de conexão real.",
    exemplo:
      "Tatiana tinha 2.800 seguidores e focava 100% em criação para alcançar novos. Um mês fez o oposto: respondeu todos os DMs antigos, repostou histórias de 3 seguidoras com resultados. Resultado: 430 novos seguidores em 15 dias, vindos de indicação orgânica.",
    correcao:
      "Reserve 20 minutos por dia para 'modo comunidade': responda comentários como conversas, não notificações. Mencione seguidores que compartilharam resultados. A audiência que se sente vista cresce em silêncio e compra em voz alta.",
  },
  {
    n: "06",
    titulo: "Construir audiência em terreno alugado — sem capturar nada",
    descricao:
      "Você tem 4.000 seguidores no Instagram. Sabe quantos emails ou contatos de WhatsApp você tem dessas 4.000 pessoas? Se a resposta for 'poucos', você está construindo um negócio em cima de um servidor que você não controla, com regras que mudam sem aviso.",
    aprofundamento:
      "Posts orgânicos no Instagram chegam a 2–6% dos seus seguidores. Um email disparado para uma lista de 1.000 é aberto por 200–280 pessoas (taxa média 20–28%). Comunicação com permissão explícita converte de 5 a 10x mais que interrupção algorítmica.",
    exemplo:
      "Darren Rowse adotou desde o início uma estratégia que seus colegas achavam excessiva: email list como ativo central, redes sociais como canal de descoberta. Em 2012, quando o Facebook reduziu o alcance orgânico de 16% para menos de 6%, seu negócio não sentiu o impacto.",
    correcao:
      "Crie uma isca digital simples — um checklist, um mini-guia, um template — e coloque o link na bio com uma frase de valor claro. Toda semana, mencione nos stories que a isca existe.",
  },
  {
    n: "07",
    titulo: "Medir as métricas que não pagam boleto",
    descricao:
      "Você comemora quando um post bomba em likes e fica frustrado quando não. Mas likes não pagam boleto. Salvamentos e compartilhamentos indicam valor real. Cliques no link indicam intenção. Leads capturados indicam futuro comprador.",
    aprofundamento:
      "Hierarquia de métricas: Curtidas (vaidade) → Comentários (engajamento) → Salvamentos (valor percebido) → Compartilhamentos (confiança) → Cliques (intenção) → Leads (futura receita). A métrica que você acompanha determina o tipo de conteúdo que você cria.",
    exemplo:
      "Mariana comemorava posts com 800 curtidas e os replicava. Quando olhou os dados de conversão, descobriu que os posts com 120 curtidas mas 94 salvamentos geravam 12x mais cliques no link da bio. Mudou a métrica que monitorava — e a receita mudou junto.",
    correcao:
      "Defina UMA métrica principal por objetivo: alcance → impressões; autoridade → salvamentos; vendas → cliques e leads. Pare de medir tudo. Otimize para o número que move o resultado que você quer.",
  },
];

const HOOK_FRAMEWORK = {
  titulo: "Framework do Gancho em 3 Camadas",
  subtitulo:
    "Como escrever os primeiros 15 segundos de qualquer conteúdo para que o algoritmo — e a pessoa — não consigam parar",
  camadas: [
    {
      numero: "Camada 1",
      nome: "O Padrão de Interrupção",
      desc: "Comece com algo que quebre a expectativa. Uma afirmação que contraria o que a pessoa acredita, um dado que surpreende, ou uma pergunta que ela faz para si mesma toda semana mas nunca viu ninguém responder diretamente.",
      exemplos_fracos: [
        "'Hoje vou falar sobre crescimento no Instagram...'",
        "'Dica número 1 para aumentar sua audiência...'",
      ],
      exemplos_fortes: [
        "'Você está crescendo errado — e o algoritmo está te mostrando isso.'",
        "'3.200 seguidores. Zero vendas. Aqui está o que eu não entendia.'",
      ],
    },
    {
      numero: "Camada 2",
      nome: "A Promessa de Revelação",
      desc: "Depois do padrão de interrupção, você tem 5 segundos para entregar a promessa do que vai ser revelado. Não o que você vai ensinar — o que a pessoa vai conseguir entender, fazer ou evitar depois de consumir o conteúdo.",
      exemplos_fracos: [
        "'Nesse vídeo vou explicar como funciona o algoritmo.'",
      ],
      exemplos_fortes: [
        "'Em 90 segundos você vai entender por que seu alcance caiu — e a correção não exige nenhum novo conteúdo.'",
      ],
    },
    {
      numero: "Camada 3",
      nome: "O Prêmio da Continuidade",
      desc: "Logo no início — não no final — sinalize que tem algo ainda mais valioso chegando. Isso retém quem está decidindo se vai continuar.",
      exemplos_fracos: ["'Fica até o final que tem uma dica especial.'"],
      exemplos_fortes: [
        "'E no final vou mostrar o formato exato que uso nos posts que mais convertem.'",
      ],
    },
  ],
  template:
    "[AFIRMAÇÃO QUE CONTRARIA UMA CRENÇA COMUM] + [PROMESSA ESPECÍFICA DO QUE VÃO APRENDER] + [SINALIZAÇÃO DO QUE VEM NO FINAL]",
};

function splitLines(text: string, maxWidth: number, doc: jsPDF): string[] {
  return doc.splitTextToSize(text, maxWidth) as string[];
}

function addWatermark(doc: jsPDF, watermarkText: string) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  doc.saveGraphicsState();
  doc.setGState(doc.GState({ opacity: 0.06 }));
  doc.setTextColor(88, 28, 220);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");

  const text = watermarkText.toUpperCase();
  const step = 38;
  for (let y = 20; y < pageH + 20; y += step) {
    for (let x = -20; x < pageW + 40; x += 90) {
      doc.text(text, x, y, { angle: 35 });
    }
  }

  doc.restoreGraphicsState();
}

function addFooter(
  doc: jsPDF,
  pageNum: number,
  total: number,
  leadName: string,
  leadEmail: string
) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  doc.setDrawColor(88, 28, 220);
  doc.setLineWidth(0.3);
  doc.line(14, pageH - 14, pageW - 14, pageH - 14);

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...LIGHT_GRAY);
  doc.text(
    `DOCUMENTO PROTEGIDO · Licenciado exclusivamente para ${leadName} <${leadEmail}> · Reprodução proibida — Lei 9.610/98`,
    pageW / 2,
    pageH - 9,
    { align: "center" }
  );
  doc.text(`${pageNum} / ${total}`, pageW - 14, pageH - 9, { align: "right" });
}

function addHeader(doc: jsPDF, subtitle: string) {
  doc.setFillColor(...DARK);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 18, "F");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PURPLE);
  doc.text("NEXOS ACADEMY", 14, 10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...LIGHT_GRAY);
  doc.text(subtitle, 14, 15.5);
}

export async function generateProtectedPDF(
  leadName: string,
  leadEmail: string
): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const pageW = doc.internal.pageSize.getWidth();

  const watermarkText = `LICENCIADO PARA ${leadEmail}`;
  const marginL = 14;
  const marginR = 14;
  const contentW = pageW - marginL - marginR;
  const footerReserve = 20;

  let totalPages = 1 + ERRORS.length + 1;

  function newPage(subtitle: string) {
    doc.addPage();
    addHeader(doc, subtitle);
    addWatermark(doc, watermarkText);
  }

  // ── CAPA ────────────────────────────────────────────────────────────────────
  doc.setFillColor(...DARK);
  doc.rect(0, 0, pageW, doc.internal.pageSize.getHeight(), "F");
  addWatermark(doc, watermarkText);

  // Badge
  doc.setFillColor(88, 28, 220);
  doc.roundedRect(marginL, 30, 52, 8, 2, 2, "F");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...WHITE);
  doc.text("NEXOS ACADEMY  ·  GUIA EXCLUSIVO", marginL + 2, 35.5);

  // Título
  doc.setFontSize(26);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...WHITE);
  const titleLines = splitLines(
    "Os 7 Erros que Travam o Crescimento da Sua Audiência",
    contentW,
    doc
  );
  let ty = 56;
  for (const line of titleLines) {
    doc.text(line, marginL, ty);
    ty += 10;
  }

  // Subtítulo
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...LIGHT_GRAY);
  const subLines = splitLines(
    "Com casos reais, aprofundamento e o Framework do Gancho em 3 Camadas",
    contentW,
    doc
  );
  for (const line of subLines) {
    doc.text(line, marginL, ty + 4);
    ty += 6;
  }

  // Linha divisória
  doc.setDrawColor(...PURPLE);
  doc.setLineWidth(0.5);
  doc.line(marginL, ty + 12, marginL + 60, ty + 12);

  // Dados do comprador
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PURPLE);
  doc.text("DOCUMENTO LICENCIADO PARA:", marginL, ty + 22);
  doc.setFontSize(12);
  doc.setTextColor(...WHITE);
  doc.text(leadName, marginL, ty + 30);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...LIGHT_GRAY);
  doc.text(leadEmail, marginL, ty + 37);

  // Data
  const dateStr = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  doc.setFontSize(8);
  doc.text(`Gerado em ${dateStr}`, marginL, ty + 46);

  // Aviso antipirataria
  doc.setFillColor(220, 60, 60);
  doc.roundedRect(marginL, ty + 54, contentW, 22, 2, 2, "F");
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...WHITE);
  doc.text("⚠  PROTEÇÃO DE DIREITOS AUTORAIS", marginL + 3, ty + 62);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  const warnLines = splitLines(
    "Este documento é licenciado exclusivamente para o comprador identificado acima. A reprodução, distribuição ou compartilhamento não autorizado constitui violação da Lei 9.610/98 (Lei de Direitos Autorais) e pode implicar responsabilidade civil e criminal. Cada download é rastreado e vinculado ao adquirente.",
    contentW - 6,
    doc
  );
  let wy = ty + 68;
  for (const line of warnLines) {
    doc.text(line, marginL + 3, wy);
    wy += 4.5;
  }

  addFooter(doc, 1, totalPages, leadName, leadEmail);

  // ── PÁGINAS DOS ERROS ────────────────────────────────────────────────────────
  ERRORS.forEach((erro, idx) => {
    newPage(`Erro #${erro.n} de 07`);
    let y = 26;

    // Número badge
    doc.setFillColor(88, 28, 220);
    doc.roundedRect(marginL, y, 18, 8, 1.5, 1.5, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...WHITE);
    doc.text(`ERRO ${erro.n}`, marginL + 2, y + 5.5);

    y += 12;

    // Título do erro
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...WHITE);
    const tLines = splitLines(erro.titulo, contentW, doc);
    for (const line of tLines) {
      doc.text(line, marginL, y);
      y += 7;
    }
    y += 2;

    // Descrição
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...LIGHT_GRAY);
    const dLines = splitLines(erro.descricao, contentW, doc);
    for (const line of dLines) {
      if (y > doc.internal.pageSize.getHeight() - footerReserve) break;
      doc.text(line, marginL, y);
      y += 5;
    }
    y += 4;

    // Seção aprofundamento
    if (y < doc.internal.pageSize.getHeight() - footerReserve - 20) {
      doc.setFillColor(35, 28, 55);
      const apLines = splitLines(erro.aprofundamento, contentW - 8, doc);
      const boxH = apLines.length * 4.5 + 14;
      if (y + boxH < doc.internal.pageSize.getHeight() - footerReserve) {
        doc.roundedRect(marginL, y, contentW, boxH, 2, 2, "F");
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...PURPLE);
        doc.text("↗ POR QUE ISSO ACONTECE", marginL + 4, y + 7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(200, 195, 215);
        let ay = y + 12;
        for (const line of apLines) {
          doc.text(line, marginL + 4, ay);
          ay += 4.5;
        }
        y += boxH + 5;
      }
    }

    // Caso real
    if (y < doc.internal.pageSize.getHeight() - footerReserve - 20) {
      const exLines = splitLines(erro.exemplo, contentW - 8, doc);
      const boxH = exLines.length * 4.5 + 14;
      if (y + boxH < doc.internal.pageSize.getHeight() - footerReserve) {
        doc.setFillColor(45, 18, 18);
        doc.roundedRect(marginL, y, contentW, boxH, 2, 2, "F");
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...RED);
        doc.text("📍 CASO REAL", marginL + 4, y + 7);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(200, 185, 185);
        let ey = y + 12;
        for (const line of exLines) {
          doc.text(line, marginL + 4, ey);
          ey += 4.5;
        }
        y += boxH + 5;
      }
    }

    // O que fazer
    if (y < doc.internal.pageSize.getHeight() - footerReserve - 20) {
      const coLines = splitLines(erro.correcao, contentW - 8, doc);
      const boxH = coLines.length * 4.5 + 14;
      if (y + boxH < doc.internal.pageSize.getHeight() - footerReserve) {
        doc.setFillColor(12, 35, 25);
        doc.roundedRect(marginL, y, contentW, boxH, 2, 2, "F");
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...GREEN);
        doc.text("✓ O QUE FAZER", marginL + 4, y + 7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(185, 215, 200);
        let cy = y + 12;
        for (const line of coLines) {
          doc.text(line, marginL + 4, cy);
          cy += 4.5;
        }
        y += boxH + 5;
      }
    }

    addFooter(doc, idx + 2, totalPages, leadName, leadEmail);
  });

  // ── FRAMEWORK DO GANCHO ──────────────────────────────────────────────────────
  newPage("Framework do Gancho em 3 Camadas");
  let y = 26;

  doc.setFillColor(88, 28, 220);
  doc.roundedRect(marginL, y, contentW, 10, 2, 2, "F");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...WHITE);
  doc.text("FRAMEWORK DO GANCHO EM 3 CAMADAS", marginL + 4, y + 7);
  y += 16;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...LIGHT_GRAY);
  const subL = splitLines(HOOK_FRAMEWORK.subtitulo, contentW, doc);
  for (const l of subL) {
    doc.text(l, marginL, y);
    y += 5;
  }
  y += 4;

  const camadaColors: [number, number, number][] = [
    [248, 113, 113],
    [52, 211, 153],
    [167, 139, 250],
  ];

  for (let i = 0; i < HOOK_FRAMEWORK.camadas.length; i++) {
    const c = HOOK_FRAMEWORK.camadas[i];
    const col = camadaColors[i];

    doc.setDrawColor(...col);
    doc.setLineWidth(0.8);
    doc.line(marginL, y, marginL, y + 28);

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...col);
    doc.text(c.numero.toUpperCase(), marginL + 4, y + 5);

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...WHITE);
    doc.text(c.nome, marginL + 4, y + 11);

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...LIGHT_GRAY);
    const descLines = splitLines(c.desc, contentW - 8, doc);
    let dy = y + 17;
    for (const l of descLines) {
      doc.text(l, marginL + 4, dy);
      dy += 4.5;
    }

    y = dy + 6;
  }

  // Template
  y += 4;
  doc.setFillColor(30, 22, 50);
  const tmplLines = splitLines(HOOK_FRAMEWORK.template, contentW - 8, doc);
  const tmplH = tmplLines.length * 5 + 18;
  doc.roundedRect(marginL, y, contentW, tmplH, 2, 2, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PURPLE);
  doc.text("TEMPLATE PRONTO PARA USAR:", marginL + 4, y + 8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(220, 215, 240);
  let ty2 = y + 14;
  for (const l of tmplLines) {
    doc.text(l, marginL + 4, ty2);
    ty2 += 5;
  }

  addFooter(doc, totalPages, totalPages, leadName, leadEmail);

  // ── SALVAR ───────────────────────────────────────────────────────────────────
  const safeName = leadName.replace(/[^a-zA-Z0-9À-ÿ\s]/g, "").trim().replace(/\s+/g, "_");
  doc.save(`NexOS_Academy_Guia_Audiencia_${safeName}.pdf`);
}
