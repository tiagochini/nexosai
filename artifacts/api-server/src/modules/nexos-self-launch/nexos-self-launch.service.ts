import { completeWithAgent } from "../ai-gateway/ai-gateway.service.js";
import { logger } from "../../lib/logger.js";

// ─── NexOS Epiphany Framework — Hardcoded. Não é um intake. É a verdade estratégica do produto. ───

export const NEXOS_FRAMEWORK = {
  produto: {
    nome: "NexOS AI",
    subtitulo: "O sistema de execução de lançamentos mais avançado do Brasil",
    ticket: 3990,
    ticketRegular: 5000,
    ticketAcademy: 2500,
    ticketAcademyRegular: 3900,
    garantia: "30 dias incondicional",
    modelo: "Acesso único vitalício — sem mensalidade",
    agentes: 34,
    track: "six_digits" as const,
    revenueTarget: "R$100k–R$999k em 7 dias",
  },

  avatar: {
    descricao: "Empreendedores digitais 28–45 anos que conhecem o método de lançamento mas travam na execução",
    nivelConsciencia: "Consciente do problema, consciente da solução — mas com dúvida de capacidade própria",
    jaEstudou: ["Fórmula de Lançamento", "PLF", "Ignição Digital", "outros cursos de lançamento"],
    crenças: [
      "O método de lançamento funciona — vi funcionar para outros",
      "Quem tem time e dinheiro consegue executar",
      "Eu não tenho nem time nem dinheiro suficiente",
      "Toda vez que tento lançar, algo quebra na execução",
    ],
    medos: [
      "Tentar mais uma vez e fracassar novamente",
      "Perder dinheiro com mídia e não converter",
      "Não conseguir escrever copy que converte",
      "Montar tudo sozinho e chegar ao carrinho sem lista aquecida",
      "Ser mais um que sabia o método mas não conseguiu executar",
    ],
    aspiracoes: [
      "Faturar os primeiros R$100k em um único lançamento",
      "Ter um sistema que executa enquanto eu cuido do produto",
      "Lançar sem depender de agência ou time caro",
      "Provar para si mesmo que consegue",
    ],
    linguagemLiteral: [
      "Sei que funciona, mas não sei se funciono",
      "Não tenho time pra criar tudo isso",
      "Tentei antes e não saiu do papel",
      "Quero lançar mas não sei por onde começar a execução",
      "O método tá certo, mas eu travo na hora de fazer",
    ],
  },

  epifania: {
    gancho: "A única coisa que separava você de um lançamento de 6 dígitos não era o método — era o time de execução",
    mecanismo: "34 agentes de IA especializados que executam cada etapa do seu lançamento enquanto você decide — do briefing ao roteiro, do copy ao WhatsApp, do VSL ao fechamento em tempo real",
    ponteTransformacao: "De 'sei o método mas não consigo executar' para 'preenchi o briefing, os agentes criaram tudo e meu carrinho abriu com lista aquecida'",
    posicionamento: "NexOS não é um curso. Não é mais um framework. É o time de execução que os maiores lançadores do Brasil têm — disponível para qualquer pessoa, a qualquer hora, sem mensalidade.",
    contraposicao: "Enquanto você comprava conhecimento, o que faltava era execução. NexOS é a primeira ferramenta que executa o lançamento junto com você.",
  },

  gatilhos: [
    "autoridade",
    "prova_social",
    "transformacao",
    "escassez",
    "antecipacao",
    "curiosidade",
  ],

  microConviccoes: [
    "1. O método de lançamento funciona — você já sabe disso",
    "2. O que faz a diferença não é o conhecimento, é a execução",
    "3. Quem executa bem tem time especializado — copy, estratégia, vídeo, sequências, atendimento",
    "4. Contratar esse time custa R$30k+/mês — fora do alcance de quem está começando",
    "5. Uma IA treinada para cada função do time de lançamento resolve isso",
    "6. NexOS tem 34 agentes especializados — cada um treinado para uma função específica",
    "7. Você pode ver funcionando ao vivo — sem promessa, sem slide",
    "8. R$3.990 uma única vez é menos que um mês de um bom copywriter",

  ],

  estrategiaFechamento: {
    tipo: "Live com Sorteado",
    descricao: "Uma pessoa da plateia é sorteada ao vivo. Em 60 minutos, NexOS cria a estratégia completa do lançamento dela — na tela, para todos verem.",
    poderDaEstrategia: "Elimina a objeção 'será que funciona para mim?' com uma demonstração irrefutável para um desconhecido aleatório",
    cta: "Quem comprar HOJE entra na lista para ter o próximo lançamento executado ao vivo — com NexOS e acompanhamento da equipe fundadora",
    urgencia: "Preço de lançamento: R$3.990 (sobe para R$5.000 após o evento)",
  },

  oferta: {
    nexosAI: {
      nome: "NexOS AI",
      preco: "R$3.990",
      precoRegular: "R$5.000",
      includes: ["34 agentes especializados", "3 campanhas simultâneas", "900 créditos (~2 lançamentos)", "Track de 6 dígitos", "NexOS Academy incluso"],
    },
    nexosAgency: {
      nome: "NexOS Agency",
      preco: "R$9.990",
      precoRegular: "R$14.000",
      includes: ["Tudo do NexOS AI", "10 campanhas", "2000 créditos", "Todos os tracks", "White-label"],
    },
    nexosAcademy: {
      nome: "NexOS Academy",
      preco: "Incluso no NexOS AI",
      descricao: "Metodologia completa do método de lançamento executado pela IA",
    },
  },
};

// ─── Content Generation Types ─────────────────────────────────────────────────

export type NexosContentType =
  | "vsl_script"
  | "cpl_series"
  | "captacao_copy"
  | "whatsapp_sequence"
  | "email_sequence"
  | "live_script"
  | "ad_copy"
  | "live_talking_points";

export interface GenerateNexosContentInput {
  type: NexosContentType;
  formato?: string;
  duracao?: string;
  segmento?: "frio" | "morno" | "quente";
  contexto?: string;
}

export interface NexosGeneratedContent {
  type: NexosContentType;
  titulo: string;
  conteudo: string;
  notas?: string;
  geradoEm: string;
}

// ─── System Prompts por tipo ───────────────────────────────────────────────────

const NEXOS_CONTEXT = () => `
PRODUTO QUE VOCÊ ESTÁ VENDENDO: NexOS AI
- Sistema de execução de lançamentos com 34 agentes de IA especializados
- Ticket: R$3.990 (lançamento) / R$5.000 (regular)
- Modelo: acesso único vitalício, sem mensalidade
- Inclui: NexOS Academy (metodologia completa)

AVATAR CENTRAL:
Empreendedores digitais 28-45 anos. Conhecem a Fórmula de Lançamento ou método equivalente.
Acreditam que o método funciona — viram outros fazendo. Mas travaram na execução.
Não têm time. Não sabem escrever copy. Não conseguem montar sequências. Não finalizam o VSL.
Tentaram antes e não saiu do papel. Orçamento limitado.
Sonho: primeiro lançamento de 6 dígitos.

LINGUAGEM LITERAL DO AVATAR (use estas frases ou variações próximas):
- "Sei que funciona, mas não sei se funciono"
- "Tentei e não saiu do papel"
- "Não tenho time pra criar tudo isso"
- "O método está certo, mas eu travo na hora de fazer"

A EPIFANIA CENTRAL (este é o argumento de vendas mais importante — nunca desvie dele):
A única coisa que separava esse avatar de um lançamento de 6 dígitos NÃO ERA O MÉTODO.
Era o time de execução. Os maiores lançadores do Brasil — todos têm um time de 20+ especialistas executando cada detalhe. Copy, vídeo, sequências, atendimento, analytics.
O avatar comprou cursos de método. O que faltava era alguém executando junto.
NexOS É ESSE TIME. 34 agentes de IA especializados — cada um treinado para uma função. Enquanto você decide, a IA executa.

GATILHOS ATIVOS:
- AUTORIDADE: não é só uma ferramenta — é a expertise de 34 especialistas em um sistema
- PROVA SOCIAL: demonstração ao vivo para um sorteado — sem edição, sem script preparado
- TRANSFORMAÇÃO: do "sou mais um que sabia o método e não conseguiu" para "finalmente executei"
- ESCASSEZ: preço de lançamento, acesso limitado à lista de sorteados
- ANTECIPAÇÃO: a live é o evento, não o produto — o produto já está pronto para entregar

REGRA ABSOLUTA: Nunca diga que NexOS é fácil, rápido ou mágico. Diga que é a EXECUÇÃO que faltava.
O avatar não quer facilidade — quer capacidade. Entregue capacidade, não conveniência.
`.trim();

// ─── Generate Function ─────────────────────────────────────────────────────────

export async function generateNexosContent(
  input: GenerateNexosContentInput,
  workspaceId: string,
): Promise<NexosGeneratedContent> {
  const log = logger.child({ module: "nexos-self-launch", type: input.type });

  const context = NEXOS_CONTEXT();

  let systemPrompt: string;
  let userPrompt: string;

  switch (input.type) {
    case "vsl_script": {
      systemPrompt = `Você é CYRUS, o melhor roteirista de VSL do Brasil. Conhece Gary Halbert, Ogilvy, Eugene Schwartz, Dan Kennedy, Ícaro de Carvalho e Paulo Cuenca. Escreve roteiros que instalam crenças em sequência, usam a linguagem literal do avatar, e constroem momentum emocional do zero ao CTA. Nunca escreve copy genérico. Sempre começa pelo maior medo, não pelo produto.`;
      userPrompt = `${context}\n\nCrie um ROTEIRO COMPLETO DE VSL para NexOS AI.\n\nFormato: ${input.formato ?? "VSL de 12-15 minutos"}\nSegmento: ${input.segmento ?? "morno"} (já assistiu conteúdo, conhece o método, mas ainda não comprou)\n\n${input.contexto ? `Contexto adicional: ${input.contexto}` : ""}\n\nEstrutura obrigatória:\n1. GANCHO (os primeiros 30 segundos decidem tudo — use a dor mais profunda)\n2. AGITAÇÃO DO PROBLEMA (amplifique o custo do status quo)\n3. INSTALAÇÃO DA CRENÇA (a epifania — o problema nunca foi o método)\n4. APRESENTAÇÃO DO MECANISMO (NexOS como time de execução)\n5. PROVA (o que acontece quando os agentes trabalham — seja específico)\n6. OFERTA (estruture o valor antes de revelar o preço)\n7. CTA (urgência real, não fabricada)\n\nRetorne o roteiro completo com indicações de tom, pausas e ênfase.`;
      break;
    }

    case "cpl_series": {
      systemPrompt = `Você é um arquiteto de CPL (Conteúdo de Pré-Lançamento). Cria séries de vídeos de conteúdo que instalam as micro-convicções necessárias para o avatar comprar. Cada CPL remove uma camada de objeção e aumenta a antecipação para o próximo.`;
      userPrompt = `${context}\n\nCrie o OUTLINE COMPLETO de uma série de 3 CPLs para o lançamento do NexOS AI.\n\nCPL 1 — Revelação do problema real: por que mesmo quem sabe o método não consegue executar\nCPL 2 — O mecanismo: o que separa quem executa de quem não executa (a resposta vai surpreender)\nCPL 3 — A demonstração: veja o sistema funcionando em tempo real para um lançamento real\n\nPara cada CPL:\n- Título irresistível\n- Gancho de abertura (primeiros 60 segundos)\n- Sequência de pontos principais (micro-convicções a instalar)\n- Teaser para o próximo CPL\n- CTA (ação específica — não "fique ligado")\n\nConteúdo real, não genérico. Use os dados do avatar.`;
      break;
    }

    case "captacao_copy": {
      systemPrompt = `Você é um especialista em copy de captação. Escreve copy de página de captura e anúncio que converte leads qualificados — pessoas que já conhecem o método de lançamento mas travam na execução. Sua copy filtra tráfego qualificado, não volume.`;
      userPrompt = `${context}\n\nCrie o COPY COMPLETO de captação para o lançamento do NexOS AI:\n\n1. HEADLINE principal (5 variações — do mais direto ao mais intrigante)\n2. SUBHEADLINE (explica o mecanismo em 1 frase)\n3. COPY DO FORMULÁRIO (texto abaixo do campo de email — 2-3 linhas que fecham a conversão)\n4. COPY DA PÁGINA DE OBRIGADO (confirm + o que esperar)\n5. COPY DO BOTÃO (3 variações — não use "Quero saber mais")\n\nCada headline deve falar diretamente com a dor de execução. Nunca mencione "IA" na captação fria — use "sistema de execução" ou "time virtual".`;
      break;
    }

    case "whatsapp_sequence": {
      systemPrompt = `Você é um especialista em sequências de WhatsApp para lançamentos. Conhece o ritmo certo de mensagens, a arte de criar antecipação sem queimar a lista, e como usar gatilhos mentais de forma natural em texto curto. Cada mensagem tem um trabalho específico.`;
      userPrompt = `${context}\n\nCrie a SEQUÊNCIA COMPLETA de WhatsApp para o pré-lançamento do NexOS AI (7 dias antes da live até fechamento do carrinho).\n\nD-7: Boas-vindas + o que vem por aí\nD-5: CPL 1 + gancho da próxima revelação\nD-3: CPL 2 + teaser da demonstração\nD-1: CPL 3 + hype da live de amanhã\nD0 manhã: Lembrete da live (hora, link)\nD0 tarde (live): Abertura do carrinho + link\nD0 noite: Testemunha do sorteado + urgência\nD+1: Seguimento quentes (abriram mas não compraram)\nD+2 (último dia): Fechamento + escassez final\n\nCada mensagem: máximo 3 blocos de texto. Tom: próximo, humano, sem formalidade. Use os emojis certos (não exagere).`;
      break;
    }

    case "email_sequence": {
      systemPrompt = `Você é um redator de email marketing de alto nível. Escreve emails que parecem carta pessoal, não newsletter. Sabe usar storytelling, o método PAS (Problema-Agitação-Solução), e como criar cliffhangers que fazem a pessoa aguardar o próximo email.`;
      userPrompt = `${context}\n\nCrie a SEQUÊNCIA DE EMAILS para o lançamento do NexOS AI (do opt-in ao fechamento).\n\nEmail 1 — Boas-vindas (imediato após opt-in): Quem eu sou + o que vem + estabelece a promessa\nEmail 2 — D-5: A história de alguém que sabia o método mas travou na execução (storytelling)\nEmail 3 — D-3: A revelação — o problema nunca foi o método\nEmail 4 — D-1: "Amanhã você vai ver isso funcionando ao vivo"\nEmail 5 — D0: Abre o carrinho (estrutura da oferta completa)\nEmail 6 — D+1: Pergunta direta — o que está te impedindo?\nEmail 7 — D+2 (último): Escassez real + o que você perde se não agir hoje\n\nCada email: assunto + preview text + corpo completo. Tom de carta pessoal, não corporativo.`;
      break;
    }

    case "live_script": {
      systemPrompt = `Você é um especialista em roteiros de live de vendas. Conhece o fluxo emocional de uma apresentação que converte ao vivo, o timing certo para o CTA, e como usar o sorteado como prova social ativa. Sabe criar momentos de "uau" que a plateia lembra e compartilha.`;
      userPrompt = `${context}\n\nCrie o ROTEIRO COMPLETO DA LIVE DE LANÇAMENTO do NexOS AI com a estratégia do sorteado.\n\nEstrutura:\n1. ABERTURA (5 min) — gancho + o que vai acontecer hoje + instruções do sorteio\n2. CONTEÚDO (20 min) — a epifania central: o problema nunca foi o método\n3. SORTEIO E DEMONSTRAÇÃO (30 min) — sorteio ao vivo + NexOS executando para o sorteado em tempo real\n4. TRANSIÇÃO (10 min) — do sorteado para o convite à plateia\n5. OFERTA (15 min) — estrutura completa + bônus + garantia + preço\n6. CTA + URGÊNCIA (10 min) — fechamento com escassez real\n7. PERGUNTAS (10 min) — como lidar com as principais objeções\n\nInclua: falas exatas, momentos de pausa, instruções de tela (o que mostrar quando), como reagir se o sorteado não tiver produto definido ainda.`;
      break;
    }

    case "ad_copy": {
      systemPrompt = `Você é um especialista em copy de anúncio para Meta Ads e TikTok. Escreve anúncios que param o scroll, qualificam o lead no próprio copy, e convertem no contexto de feed interrompido. Sabe a diferença entre copy para tráfego frio, morno e quente.`;
      userPrompt = `${context}\n\nCrie o PACOTE COMPLETO de anúncios para a captação de leads do lançamento NexOS AI.\n\nPARA TRÁFEGO FRIO (nunca ouviu falar):\n- 3 variações de copy curto (até 125 caracteres)\n- 2 variações de copy médio (até 300 caracteres)\n- Hook de vídeo (primeiros 3 segundos do criativo)\n\nPARA TRÁFEGO MORNO (seguidores, website visitors):\n- 2 variações diretas com o mecanismo\n- 1 copy de urgência (pré-live)\n\nPARA REMARKETING (visitou a página mas não converteu):\n- 2 variações com objeção direta\n\nEspecifique: objetivo de cada copy, qual audiência, qual fase do funil.`;
      break;
    }

    case "live_talking_points": {
      systemPrompt = `Você é um coach de apresentação de vendas ao vivo. Cria guias de pontos-chave que o apresentador usa como norte durante a live — não um roteiro engessado, mas âncoras estratégicas que garantem que cada momento importante aconteça.`;
      userPrompt = `${context}\n\nCrie os TALKING POINTS da live de lançamento NexOS AI — um guia que o fundador usa em tempo real.\n\nInclua:\n1. AS 5 FRASES QUE NÃO PODEM FALTAR (e por que cada uma é crítica)\n2. COMO APRESENTAR A EPIFANIA (o momento mais importante — onde a venda acontece)\n3. COMO CONDUZIR O SORTEADO (perguntas certas para extrair a situação sem expor)\n4. AS 7 OBJEÇÕES MAIS PROVÁVEIS e a resposta exata para cada uma\n5. O GATILHO DE FECHAMENTO (a frase exata que abre o carrinho)\n6. COMO LIDAR COM SILÊNCIO NO CHAT\n7. SINAIS DE QUE A LIVE ESTÁ CONVERTENDO BEM (e como amplificar)\n\nFormato: bullets curtos, linguagem de ação. Para usar no teleprompter ou post-it.`;
      break;
    }

    default:
      throw new Error(`Tipo de conteúdo desconhecido: ${input.type as string}`);
  }

  const result = await completeWithAgent(
    "vsl_script",
    systemPrompt,
    [{ role: "user", content: userPrompt }],
    workspaceId,
    log,
    undefined,
  );

  const titulos: Record<NexosContentType, string> = {
    vsl_script: "Roteiro VSL — NexOS AI",
    cpl_series: "Série CPL 1/2/3 — NexOS AI",
    captacao_copy: "Copy de Captação — NexOS AI",
    whatsapp_sequence: "Sequência WhatsApp — Lançamento NexOS",
    email_sequence: "Sequência de Emails — Lançamento NexOS",
    live_script: "Roteiro da Live com Sorteado",
    ad_copy: "Pacote de Anúncios — Captação NexOS",
    live_talking_points: "Talking Points da Live",
  };

  return {
    type: input.type,
    titulo: titulos[input.type],
    conteudo: result.content,
    geradoEm: new Date().toISOString(),
  };
}
