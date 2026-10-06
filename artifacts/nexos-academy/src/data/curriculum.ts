export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface Lesson {
  id: string;
  title: string;
  duration: string;
  type: "text" | "video" | "exercise" | "quiz";
  content: string;
  keyPoints: string[];
  glossaryTerms?: string[];
  exercise?: string;
  locked?: boolean;
  questions?: QuizQuestion[];
  minPassScore?: number;
  bibliographyRefs?: string[];
}

export interface Chapter {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  duration: string;
  lessons: Lesson[];
  summary: string;
  locked?: boolean;
}

export interface Module {
  id: string;
  number: number;
  title: string;
  description: string;
  chapters: Chapter[];
  badge: string;
  standalone?: boolean;
  standalonePrice?: number;
  standaloneOriginalPrice?: number;
}

export const CURRICULUM: Module[] = [
  {
    "id": "fundamentos",
    "number": 1,
    "title": "Fundamentos do Marketing Digital",
    "description": "A base que sustenta toda campanha de 7 dígitos. Entenda como a atenção funciona, onde o tráfego nasce e por que a maioria falha antes mesmo de começar.",
    "badge": "Fundação",
    "chapters": [
      {
        "id": "atencao-digital",
        "number": 1,
        "title": "A Economia da Atenção",
        "subtitle": "Por que a atenção é a nova moeda do século XXI",
        "icon": "👁",
        "color": "from-blue-600 to-indigo-600",
        "duration": "45 min",
        "summary": "",
        "lessons": [
          {
            "id": "atencao-1",
            "title": "O que é a Economia da Atenção",
            "duration": "12 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "atencao-2",
            "title": "Algoritmos: Como Plataformas Distribuem Conteúdo",
            "duration": "18 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "atencao-3",
            "title": "Exercício: Audite Seu Feed",
            "duration": "15 min",
            "type": "exercise",
            "content": "",
            "keyPoints": []
          }
        ]
      },
      {
        "id": "trafego-organico",
        "number": 2,
        "title": "Tráfego Orgânico Dominante",
        "subtitle": "A máquina gratuita que alimenta qualquer lançamento",
        "icon": "🌱",
        "color": "from-emerald-600 to-teal-600",
        "duration": "1h 20min",
        "summary": "",
        "lessons": [
          {
            "id": "organico-1",
            "title": "Os 4 Tipos de Conteúdo Que Convertem",
            "duration": "20 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "organico-2",
            "title": "Reels & Shorts: Roteiros Prontos Para Gravar Hoje",
            "duration": "25 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "organico-3",
            "title": "SEO no Instagram e YouTube: Processo Passo a Passo",
            "duration": "20 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "organico-4",
            "title": "Quiz: Fundamentos de Tráfego Orgânico",
            "duration": "15 min",
            "type": "quiz",
            "content": "",
            "keyPoints": []
          }
        ]
      },
      {
        "id": "trafego-pago",
        "number": 3,
        "title": "Tráfego Pago: A Ciência dos Anúncios",
        "subtitle": "Do pixel ao ROI positivo com consistência",
        "icon": "💰",
        "color": "from-amber-600 to-orange-600",
        "duration": "1h 45min",
        "summary": "",
        "lessons": [
          {
            "id": "pago-1",
            "title": "Meta Ads: Estrutura de Campanha para Lançamentos",
            "duration": "30 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "pago-2",
            "title": "Criativos que Param o Scroll",
            "duration": "25 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "pago-3",
            "title": "Google Ads: Search + Display para Lançamentos",
            "duration": "20 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          }
        ]
      }
    ]
  },
  {
    "id": "formula-lancamento",
    "number": 2,
    "title": "Fórmula de Lançamento e PLF",
    "description": "O método que gerou mais de R$1 bilhão em vendas no Brasil. Aprenda a executar um lançamento completo do zero ao carrinho fechado.",
    "badge": "Core",
    "chapters": [
      {
        "id": "plf-estrutura",
        "number": 4,
        "title": "PLF: Product Launch Formula",
        "subtitle": "O método de Jeff Walker adaptado para o mercado brasileiro",
        "icon": "🚀",
        "color": "from-violet-600 to-purple-600",
        "duration": "1h 30min",
        "summary": "",
        "lessons": [
          {
            "id": "plf-1",
            "title": "Estrutura da PLF Brasileira",
            "duration": "25 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "plf-2",
            "title": "Construindo Sua Lista de Espera",
            "duration": "20 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          }
        ]
      },
      {
        "id": "mental-triggers",
        "number": 5,
        "title": "Engenharia Comportamental: Os 12 Gatilhos",
        "subtitle": "A mecânica psicológica profunda de cada decisão de compra",
        "icon": "🧠",
        "color": "from-rose-600 to-pink-600",
        "duration": "2h 40min",
        "summary": "",
        "lessons": [
          {
            "id": "triggers-1",
            "title": "Credibilidade: Autoridade, Prova Social e Escassez",
            "duration": "40 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "triggers-2",
            "title": "Relacionamento: Urgência, Reciprocidade e Comunidade",
            "duration": "40 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "triggers-3",
            "title": "Desejo: Antecipação, Transformação e Medo de Perda",
            "duration": "40 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "triggers-4",
            "title": "Ação: Curiosidade, Evento, Contraste + Mapa de Uso",
            "duration": "40 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          }
        ],
        "locked": false
      },
      {
        "id": "copywriting",
        "number": 6,
        "title": "Copywriting de Alto Impacto",
        "subtitle": "Palavras que vendem: do headline ao fechamento",
        "icon": "✍️",
        "color": "from-cyan-600 to-blue-600",
        "duration": "1h 50min",
        "summary": "",
        "lessons": [
          {
            "id": "copy-1",
            "title": "A Anatomia do Copy Perfeito",
            "duration": "25 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "copy-2",
            "title": "VSL: Roteiro Completo Pronto para Adaptar",
            "duration": "35 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          }
        ],
        "locked": false
      }
    ]
  },
  {
    "id": "tipos-lancamento",
    "number": 3,
    "title": "Tipos de Lançamento e Monetização",
    "description": "Cada produto e momento de negócio pede um modelo diferente. Aprenda quando usar Semente, Perpétuo, Interno, Afiliado e como montar uma escada de valor que maximiza o LTV do cliente.",
    "badge": "Estratégia",
    "chapters": [
      {
        "id": "modelos-lancamento",
        "number": 7,
        "title": "Os 6 Modelos de Lançamento",
        "subtitle": "Semente, Perpétuo, Interno, Externo, Afiliado e Co-criação",
        "icon": "🗺",
        "color": "from-violet-600 to-purple-600",
        "duration": "1h 30min",
        "summary": "",
        "lessons": [
          {
            "id": "semente",
            "title": "Lançamento Semente: Venda Antes de Criar",
            "duration": "22 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "perpetuo",
            "title": "Lançamento Perpétuo: A Máquina de Vendas 24/7",
            "duration": "25 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "interno-externo",
            "title": "Lançamento Interno e Externo",
            "duration": "18 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "afiliado",
            "title": "Lançamento de Afiliado: Lucro Sem Produto Próprio",
            "duration": "20 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "comparativo-modelos",
            "title": "Exercício: Qual Modelo é o Seu?",
            "duration": "15 min",
            "type": "exercise",
            "content": "",
            "keyPoints": []
          }
        ]
      },
      {
        "id": "escada-valor",
        "number": 8,
        "title": "Escada de Valor e Monetização Avançada",
        "subtitle": "Como maximizar o LTV de cada cliente com upsell, downsell e recorrência",
        "icon": "📈",
        "color": "from-emerald-600 to-teal-600",
        "duration": "1h 15min",
        "summary": "",
        "lessons": [
          {
            "id": "escada-1",
            "title": "Escada de Valor: Mapeando Sua Jornada de Produtos",
            "duration": "25 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "upsell-downsell",
            "title": "Upsell, Downsell e Order Bump: Copy e Estrutura",
            "duration": "20 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "recorrencia",
            "title": "Modelos de Recorrência: A Receita Previsível",
            "duration": "22 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "monetizacao-quiz",
            "title": "Quiz: Estratégia de Monetização",
            "duration": "15 min",
            "type": "quiz",
            "content": "",
            "keyPoints": []
          }
        ],
        "locked": false
      },
      {
        "id": "pos-venda",
        "number": 9,
        "title": "Pós-Venda e Retenção: O Ciclo Completo",
        "subtitle": "De comprador a fã: como transformar resultados em indicações",
        "icon": "🔄",
        "color": "from-sky-600 to-blue-600",
        "duration": "50 min",
        "summary": "",
        "lessons": [
          {
            "id": "onboarding",
            "title": "Onboarding: Os Primeiros 7 Dias Decidem Tudo",
            "duration": "18 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "indicacoes",
            "title": "Programa de Indicação: Crescimento Orgânico pelo Boca a Boca",
            "duration": "20 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          }
        ],
        "locked": false
      }
    ]
  },
  {
    "id": "ferramentas-plataformas",
    "number": 4,
    "title": "Ferramentas e Plataformas do Marketing Digital",
    "description": "Domine o ecossistema de ferramentas que os maiores produtores usam. De criação de conteúdo a agendamento, análise e automação — cada plataforma tem seu jogo e suas regras.",
    "badge": "Ferramentas",
    "chapters": [
      {
        "id": "instagram-tiktok",
        "number": 10,
        "title": "Instagram e TikTok: Orgânico de Alto Impacto",
        "subtitle": "Os algoritmos, formatos e estratégias de crescimento que funcionam em 2026",
        "icon": "📱",
        "color": "from-pink-600 to-rose-600",
        "duration": "1h 45min",
        "summary": "",
        "lessons": [
          {
            "id": "tiktok-algoritmo",
            "title": "TikTok: Como Funciona e Como Crescer Sistematicamente",
            "duration": "25 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "instagram-estrategia",
            "title": "Instagram: Reels, Carrosséis e a Estratégia de Conversão",
            "duration": "28 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "facebook-youtube",
            "title": "Facebook e YouTube: Audiência Madura e Conteúdo Longo",
            "duration": "22 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "ferramentas-producao",
            "title": "Stack de Ferramentas: Do Zero ao Profissional",
            "duration": "20 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          }
        ],
        "locked": false
      }
    ]
  },
  {
    "id": "meta-ads",
    "number": 5,
    "title": "Meta Ads — O Curso Definitivo",
    "description": "Do zero ao avançado em Facebook e Instagram Ads. Estrutura de campanha, públicos, criativos, otimização e escala — tudo que você precisa para dominar o tráfego pago na Meta.",
    "badge": "Meta Ads",
    "chapters": [
      {
        "id": "meta-fundamentos",
        "number": 11,
        "title": "Fundamentos do Meta Ads",
        "subtitle": "Business Manager, Pixel, estrutura de campanha e primeiros anúncios",
        "icon": "🎯",
        "color": "from-blue-600 to-blue-800",
        "duration": "2h",
        "summary": "",
        "lessons": [
          {
            "id": "meta-bm",
            "title": "Business Manager: Configuração Profissional do Zero",
            "duration": "20 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "meta-estrutura",
            "title": "Estrutura de Campanha: CBO, ABO e Objetivos",
            "duration": "25 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "meta-publicos",
            "title": "Públicos: Frio, Morno e Quente",
            "duration": "25 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "meta-criativos",
            "title": "Criativos que Convertem: Copy e Estrutura Prontos",
            "duration": "30 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "meta-otimizacao",
            "title": "Otimização e Escala: Do R$50 ao R$5.000/dia",
            "duration": "30 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          }
        ],
        "locked": false
      },
      {
        "id": "meta-avancado",
        "number": 12,
        "title": "Meta Ads Avançado: Lançamentos e Funis",
        "subtitle": "Estrutura de campanha para lançamentos, retargeting em cascata e remarketing de lista",
        "icon": "🚀",
        "color": "from-indigo-600 to-violet-600",
        "duration": "1h 30min",
        "summary": "",
        "lessons": [
          {
            "id": "meta-lancamento",
            "title": "Estrutura Completa de Mídia para um Lançamento",
            "duration": "30 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "meta-mensuração",
            "title": "Mensuração Real: Attribution e o Relatório que Importa",
            "duration": "25 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          }
        ],
        "locked": false
      }
    ]
  },
  {
    "id": "nexos-ferramenta",
    "number": 6,
    "title": "NexOS — A Ferramenta Definitiva",
    "description": "Você aprendeu a metodologia. Agora conheça a plataforma que executa tudo isso com inteligência artificial — do briefing ao carrinho aberto, de forma automática e auditável.",
    "badge": "NexOS",
    "chapters": [
      {
        "id": "nexos-apresentacao",
        "number": 13,
        "title": "Por que o NexOS Existe",
        "subtitle": "O problema que nenhuma ferramenta resolvia — até agora",
        "icon": "⚡",
        "color": "from-purple-600 to-indigo-700",
        "duration": "45 min",
        "summary": "",
        "lessons": [
          {
            "id": "nexos-problema",
            "title": "O Teto Invisível do Produtor Digital",
            "duration": "20 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "nexos-como-funciona",
            "title": "Como o NexOS Funciona: Do Briefing ao Carrinho",
            "duration": "25 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          }
        ]
      },
      {
        "id": "nexos-diferenciais",
        "number": 14,
        "title": "NexOS na Prática: Funcionalidades e Diferenciais",
        "subtitle": "Tudo que o NexOS faz que nenhuma outra ferramenta do mercado faz",
        "icon": "🧠",
        "color": "from-cyan-600 to-blue-600",
        "duration": "1h",
        "summary": "",
        "lessons": [
          {
            "id": "nexos-agentes",
            "title": "Os 44 Especialistas: Especialistas Disponíveis 24/7",
            "duration": "25 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "nexos-recursos",
            "title": "Recursos Exclusivos: Do que Nenhuma Outra Ferramenta Tem",
            "duration": "30 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "nexos-planos",
            "title": "Acesso, Créditos e Como Começar",
            "duration": "15 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          }
        ],
        "locked": false
      }
    ]
  },
  {
    "id": "algoritmos",
    "number": 7,
    "title": "Algoritmos: A Ciência de Ser Visto",
    "description": "Entenda como cada algoritmo pensa, o que ele quer maximizar e como você pode usá-lo como alavanca — não lutar contra ele. TikTok, Instagram, YouTube, Facebook, Google e os padrões universais que governam todos eles.",
    "badge": "Algoritmos",
    "chapters": [
      {
        "id": "algoritmos-fundamentos",
        "number": 15,
        "title": "A Lógica Universal dos Algoritmos",
        "subtitle": "O que todo algoritmo de recomendação tem em comum — e como usar isso",
        "icon": "🧮",
        "color": "from-slate-600 to-gray-700",
        "duration": "1h 20min",
        "summary": "",
        "lessons": [
          {
            "id": "algo-o-que-e",
            "title": "O que é um Algoritmo de Recomendação e o que ele Quer",
            "duration": "22 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "algo-psicologia",
            "title": "A Psicologia por Trás dos Sinais de Engajamento",
            "duration": "25 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "algo-metricas-universais",
            "title": "As 7 Métricas que Todo Algoritmo Mede",
            "duration": "18 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          }
        ]
      },
      {
        "id": "algoritmo-tiktok-profundo",
        "number": 16,
        "title": "TikTok Algorithm: Dissecção Completa",
        "subtitle": "O sistema de distribuição mais sofisticado da história das redes sociais",
        "icon": "🎵",
        "color": "from-black to-gray-800",
        "duration": "1h 30min",
        "summary": "",
        "lessons": [
          {
            "id": "tiktok-deep-1",
            "title": "O Sistema de Pontuação do TikTok: O que o ByteDance Realmente Mede",
            "duration": "28 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "tiktok-deep-2",
            "title": "Estratégia de Conta: Como Construir Autoridade de Nicho no TikTok",
            "duration": "25 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "tiktok-deep-3",
            "title": "Conteúdo de Conversão no TikTok: Do Scroll à Venda",
            "duration": "22 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          }
        ],
        "locked": false
      },
      {
        "id": "algoritmo-instagram-profundo",
        "number": 17,
        "title": "Instagram Algorithm: Os 4 Sistemas Separados",
        "subtitle": "Feed, Explore, Reels e Stories têm algoritmos distintos — dominar todos multiplica o alcance",
        "icon": "📸",
        "color": "from-pink-600 to-purple-700",
        "duration": "1h 15min",
        "summary": "",
        "lessons": [
          {
            "id": "ig-quatro-sistemas",
            "title": "Os 4 Algoritmos do Instagram e seus Sinais Específicos",
            "duration": "28 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "ig-crescimento-estrategia",
            "title": "Estratégia de Crescimento Acelerado no Instagram",
            "duration": "28 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          }
        ],
        "locked": false
      },
      {
        "id": "algoritmo-youtube-profundo",
        "number": 18,
        "title": "YouTube Algorithm: O Motor de Busca de Vídeo",
        "subtitle": "Como o maior buscador de vídeo do mundo decide o que mostrar — e como aparecer nele",
        "icon": "▶",
        "color": "from-red-600 to-red-800",
        "duration": "1h",
        "summary": "",
        "lessons": [
          {
            "id": "yt-dois-motores",
            "title": "Os Dois Motores do YouTube: Busca e Recomendação",
            "duration": "28 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "yt-seo",
            "title": "YouTube SEO Avançado: Apareça em Buscas por Anos",
            "duration": "22 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          }
        ],
        "locked": false
      },
      {
        "id": "algoritmo-facebook-google",
        "number": 19,
        "title": "Facebook Orgânico e Google: Os Algoritmos de Intenção",
        "subtitle": "Facebook Groups, o feed orgânico e o algoritmo de busca do Google",
        "icon": "🔵",
        "color": "from-blue-700 to-blue-900",
        "duration": "1h",
        "summary": "",
        "lessons": [
          {
            "id": "fb-groups-algoritmo",
            "title": "Facebook Groups: O Algoritmo que Ainda Entrega Alcance",
            "duration": "25 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "google-seo-intencao",
            "title": "Google Search: O Algoritmo de Maior Intenção de Compra",
            "duration": "25 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          }
        ],
        "locked": false
      },
      {
        "id": "algoritmo-dominio-total",
        "number": 20,
        "title": "Domínio Total: Estratégia Multi-Plataforma e Omnichannel",
        "subtitle": "Como criar uma presença algorítmica que se reforça em todas as plataformas simultaneamente",
        "icon": "🌐",
        "color": "from-emerald-600 to-cyan-600",
        "duration": "1h",
        "summary": "",
        "lessons": [
          {
            "id": "omnichannel-estrategia",
            "title": "A Estratégia de Conteúdo Multi-Plataforma que Multiplica Alcance",
            "duration": "25 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "algoritmo-acompanhar",
            "title": "Como Acompanhar as Mudanças de Algoritmo sem Enlouquecer",
            "duration": "20 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "algoritmo-exercicio-final",
            "title": "Exercício Final: Auditoria Algorítmica do Seu Negócio",
            "duration": "15 min",
            "type": "exercise",
            "content": "",
            "keyPoints": []
          }
        ],
        "locked": false
      },
      {
        "id": "segredo-redes-sociais",
        "number": 21,
        "title": "O Segredo das Redes Sociais",
        "subtitle": "A revelação que gestores de tráfego e plataformas nunca vão te contar",
        "icon": "🔐",
        "color": "from-red-950 to-gray-900",
        "duration": "2h",
        "summary": "",
        "lessons": [
          {
            "id": "segredo-1-ilusao",
            "title": "A Grande Ilusão: O que Você Acredita vs. a Realidade",
            "duration": "22 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "segredo-2-supressao",
            "title": "A Supressão Programada: O Ciclo que Toda Plataforma Repete",
            "duration": "28 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "segredo-3-predicao-comportamental",
            "title": "O Motor de Predição Comportamental: Por que Qualidade Não é o Critério",
            "duration": "25 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "segredo-4-dois-jogos",
            "title": "A Virada de Chave: O Framework dos Dois Jogos",
            "duration": "30 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "segredo-5-framework-independencia",
            "title": "O Framework de Independência: Construindo um Negócio à Prova de Algoritmo",
            "duration": "28 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "segredo-exercicio-auditoria",
            "title": "Exercício Final: Auditoria de Independência Algorítmica",
            "duration": "20 min",
            "type": "exercise",
            "content": "",
            "keyPoints": []
          }
        ],
        "locked": false
      }
    ]
  },
  {
    "id": "integracoes-automacoes",
    "number": 8,
    "title": "Integrações e Automações: A Máquina Conectada",
    "description": "A teoria sem execução técnica não gera receita. Este módulo preenche a lacuna entre aprender e operar: configura o Meta Business Manager profissional, instala CAPI server-side, conecta Hotmart/Kiwify ao pixel, monta automações de email e WhatsApp, cria webhooks entre plataformas e constrói o cronograma operacional completo de um lançamento. Ao final, sua máquina de lançamentos roda automaticamente — da captura ao pós-venda.",
    "badge": "Automação",
    "chapters": [
      {
        "id": "meta-pixel-capi",
        "number": 22,
        "title": "Meta: Pixel Avançado, CAPI e Business Manager Profissional",
        "subtitle": "A base técnica que determina a qualidade de todo o seu tráfego pago",
        "icon": "🎯",
        "color": "from-blue-800 to-indigo-900",
        "duration": "2h 30min",
        "summary": "",
        "lessons": [
          {
            "id": "meta-bm-profissional",
            "title": "Arquitetura do Business Manager: Contas, Ativos e Permissões",
            "duration": "25 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "meta-pixel-avancado",
            "title": "Pixel Avançado: Eventos Padrão, Customizados e Parâmetros",
            "duration": "30 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "meta-capi",
            "title": "Conversions API (CAPI): Rastreamento Server-Side para o Mundo Pós-Cookie",
            "duration": "32 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "meta-attribution",
            "title": "Attribution e Mensuração Real: Descobrindo o que Realmente Vendeu",
            "duration": "22 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "meta-system-user",
            "title": "System Users, Tokens de API e Automação de Anúncios",
            "duration": "20 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          }
        ],
        "locked": false
      },
      {
        "id": "plataformas-pagamento",
        "number": 23,
        "title": "Plataformas de Pagamento: Hotmart, Kiwify e Eduzz",
        "subtitle": "Configuração técnica completa e integração com todo o ecossistema de marketing",
        "icon": "💳",
        "color": "from-green-800 to-emerald-900",
        "duration": "2h",
        "summary": "",
        "lessons": [
          {
            "id": "hotmart-setup-completo",
            "title": "Hotmart: Configuração Completa do Produto ao Webhook",
            "duration": "28 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "kiwify-setup-completo",
            "title": "Kiwify: Checkout de Alta Conversão e Integrações Nativas",
            "duration": "25 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "eduzz-setup",
            "title": "Eduzz: Estrutura, Checkout e Programa de Afiliados",
            "duration": "20 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "asaas-configuracao",
            "title": "Asaas: Gateway Financeiro Completo para Negócios Digitais",
            "duration": "25 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "checkout-email-whatsapp-flow",
            "title": "O Fluxo Automático Completo: Compra → Email → WhatsApp → Área de Membros",
            "duration": "28 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "payment-exercise",
            "title": "Exercício: Checklist Completo de Produto e Integrações",
            "duration": "15 min",
            "type": "exercise",
            "content": "",
            "keyPoints": []
          }
        ],
        "locked": false
      },
      {
        "id": "email-automation",
        "number": 24,
        "title": "Email Marketing: Automação Profissional de Lançamentos",
        "subtitle": "RD Station, ActiveCampaign e as sequências que vendem automaticamente",
        "icon": "📧",
        "color": "from-violet-800 to-purple-900",
        "duration": "2h 30min",
        "summary": "",
        "lessons": [
          {
            "id": "rdstation-configuracao",
            "title": "RD Station: Configuração, Lead Scoring e Fluxos para Lançamentos",
            "duration": "30 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "activecampaign-avancado",
            "title": "ActiveCampaign: Lead Scoring, Tagging Avançado e Automações",
            "duration": "28 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "sequencia-prelancamento",
            "title": "A Sequência dos 7 Emails de Pré-Lançamento (Com Copy Pronto)",
            "duration": "28 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "sequencia-carrinho",
            "title": "Sequências de Carrinho: Abertura, Urgência e Fechamento",
            "duration": "22 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "sequencia-pos-compra",
            "title": "Sequência Pós-Compra: Onboarding que Retém e Upsell que Converte",
            "duration": "22 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          }
        ],
        "locked": false
      },
      {
        "id": "whatsapp-automation",
        "number": 25,
        "title": "WhatsApp Automation: ManyChat, WABA e Disparos de Lançamento",
        "subtitle": "O canal com 90% de leitura — configurado para trabalhar automaticamente",
        "icon": "💬",
        "color": "from-green-700 to-teal-800",
        "duration": "2h",
        "summary": "",
        "lessons": [
          {
            "id": "manychat-configuracao",
            "title": "ManyChat: Fluxos, Comentários → DM e Captura de Leads via Instagram",
            "duration": "28 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "waba-zapi-configuracao",
            "title": "WhatsApp Business API: Opções, Configuração e Casos de Uso",
            "duration": "25 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "whatsapp-sequencias-lancamento",
            "title": "Sequências de WhatsApp para Cada Fase do Lançamento",
            "duration": "25 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "whatsapp-lgpd-compliance",
            "title": "LGPD no WhatsApp: Opt-in, Opt-out e Como Não Ser Banido",
            "duration": "20 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "whatsapp-exercise",
            "title": "Exercício: Monte Sua Primeira Sequência Automática de WhatsApp",
            "duration": "20 min",
            "type": "exercise",
            "content": "",
            "keyPoints": []
          }
        ],
        "locked": false
      },
      {
        "id": "webhooks-integracoes",
        "number": 26,
        "title": "Webhooks, Zapier e Make: A Cola Entre Todos os Sistemas",
        "subtitle": "Automatize o que nenhuma plataforma faz nativamente — sem programar",
        "icon": "🔗",
        "color": "from-orange-800 to-red-900",
        "duration": "1h 45min",
        "summary": "",
        "lessons": [
          {
            "id": "webhooks-fundamentos",
            "title": "O que é um Webhook e como Ele Conecta Tudo",
            "duration": "22 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "zapier-make-automacoes",
            "title": "Zapier e Make: Automações Sem Código Para Não-Técnicos",
            "duration": "28 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "fluxo-mestre-integracao",
            "title": "O Fluxo Mestre: Conectando Hotmart + Email + WhatsApp + CRM",
            "duration": "30 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "monitoramento-alertas",
            "title": "Monitoramento, Alertas e Resolução de Problemas em Produção",
            "duration": "18 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          }
        ],
        "locked": false
      },
      {
        "id": "calendario-operacional",
        "number": 27,
        "title": "Calendário Editorial e Cronograma Operacional de Lançamento",
        "subtitle": "O mapa completo de 30 dias que transforma a teoria em execução perfeita",
        "icon": "📅",
        "color": "from-indigo-800 to-blue-900",
        "duration": "2h",
        "summary": "",
        "lessons": [
          {
            "id": "timing-sequencias-plf",
            "title": "A Lógica de Timing das Sequências PLF (Semana a Semana)",
            "duration": "25 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "ferramentas-agendamento-conteudo",
            "title": "Ferramentas de Agendamento: Metricool, Buffer e Agendamento Nativo",
            "duration": "22 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "cronograma-definitivo-30-dias",
            "title": "O Cronograma Definitivo: Dia a Dia dos 30 Dias de Lançamento",
            "duration": "32 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "budget-distribution-fases",
            "title": "Budget Distribution: Como Alocar Verba de Anúncios por Fase",
            "duration": "22 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "cronograma-exercise",
            "title": "Exercício Final: Monte o Cronograma do Seu Próximo Lançamento",
            "duration": "25 min",
            "type": "exercise",
            "content": "",
            "keyPoints": []
          }
        ],
        "locked": false
      }
    ]
  },
  {
    "id": "copywriting-persuasao",
    "number": 9,
    "title": "Copywriting e Persuasão: A Ciência de Converter Palavras em Vendas",
    "description": "A habilidade que multiplica o resultado de tudo que você já aprendeu. Copy não é dom — é estrutura, psicologia e técnica testável. Aqui você aprende as fórmulas, os gatilhos e os casos reais internacionais que documentaram o poder das palavras certas no momento certo.",
    "badge": "Copy",
    "chapters": [
      {
        "id": "gatilhos-aplicados",
        "number": 28,
        "title": "Gatilhos Mentais Aplicados: Do Conceito ao Copy Real",
        "subtitle": "Os 12 gatilhos do NexOS em profundidade — com exemplos reais e templates prontos",
        "icon": "🧠",
        "color": "from-purple-800 to-pink-900",
        "duration": "2h",
        "summary": "",
        "lessons": [
          {
            "id": "autoridade-prova-social-aplicados",
            "title": "Autoridade e Prova Social: Os Dois Gatilhos que Vencem o Ceticismo",
            "duration": "28 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "escassez-urgencia-aplicados",
            "title": "Escassez e Urgência: O Gatilho que Quebra a Procrastinação",
            "duration": "25 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "reciprocidade-antecipacao-aplicados",
            "title": "Reciprocidade, Antecipação e Curiosidade: Os Gatilhos de Aquecimento",
            "duration": "22 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "medo-perda-transformacao-aplicados",
            "title": "Medo de Perda e Transformação: Os Gatilhos que Movem a Decisão Final",
            "duration": "22 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          }
        ],
        "locked": false
      },
      {
        "id": "estruturas-copy",
        "number": 29,
        "title": "Estruturas de Copy: Fórmulas, Headlines e CTAs para Cada Canal",
        "subtitle": "O arsenal completo de copy — da bio do Instagram à página de vendas de R$1M",
        "icon": "✍️",
        "color": "from-indigo-800 to-violet-900",
        "duration": "2h 20min",
        "summary": "",
        "lessons": [
          {
            "id": "copy-landing-page",
            "title": "Copy de Landing Page e Página de Vendas: Do Headline ao Fechamento",
            "duration": "32 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "copy-anuncio-avancado",
            "title": "Copy de Anúncio Avançado: Meta Ads, Google e TikTok",
            "duration": "28 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "copy-redes-sociais",
            "title": "Copy para Redes Sociais: Legendas, Bio e Carrossel que Convertem",
            "duration": "25 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "copy-email-whatsapp",
            "title": "Copy de Email e WhatsApp: A Voz que Chega no Mais Íntimo do Contato",
            "duration": "22 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          }
        ],
        "locked": false
      },
      {
        "id": "storytelling-vendas",
        "number": 30,
        "title": "Storytelling como Arma de Venda",
        "subtitle": "Por que histórias vendem mais do que argumentos — e como estruturar a sua",
        "icon": "📖",
        "color": "from-amber-800 to-orange-900",
        "duration": "1h 40min",
        "summary": "",
        "lessons": [
          {
            "id": "jornada-heroi-marketing",
            "title": "A Jornada do Herói no Marketing: A Estrutura que Todo Copy de Conversão Usa",
            "duration": "28 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "historia-origem-fundadora",
            "title": "A História de Origem: Como Contar Sua Jornada de Forma que Vende",
            "duration": "25 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          }
        ],
        "locked": false
      },
      {
        "id": "prova-social-internacional",
        "number": 31,
        "title": "Prova Social Internacional: Casos Reais Documentados e Como Replicar",
        "subtitle": "Os estudos de caso que provam — com dados — que copy e persuasão são ciência",
        "icon": "🌎",
        "color": "from-teal-800 to-cyan-900",
        "duration": "2h",
        "summary": "",
        "lessons": [
          {
            "id": "casos-ogilvy-halbert",
            "title": "David Ogilvy e Gary Halbert: Os Fundadores do Copy Moderno",
            "duration": "30 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "casos-digitais-documentados",
            "title": "Dollar Shave Club, Dropbox e ConvertKit: Copy Digital que Mudou Mercados",
            "duration": "30 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "casos-brasileiros-documentados",
            "title": "Casos Brasileiros Documentados: PLF, Hotmart e Lançamentos de Referência",
            "duration": "28 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "como-coletar-prova-social",
            "title": "Como Coletar, Formatar e Usar Prova Social que Converte",
            "duration": "25 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          }
        ],
        "locked": false
      }
    ]
  },
  {
    "id": "produto-digital",
    "number": 10,
    "title": "Produto Digital: Audiência, Criação e Entrega",
    "description": "O produto certo para o público certo muda tudo. Este módulo cobre o processo completo: como entender profundamente sua audiência, transformar esse entendimento em um produto que o mercado já quer comprar, validar antes de criar, escolher a plataforma correta e entregar uma experiência que retém e gera indicações.",
    "badge": "Produto",
    "chapters": [
      {
        "id": "entendendo-audiencia",
        "number": 32,
        "title": "Entendendo Sua Audiência: Do Seguidor ao Cliente",
        "subtitle": "A pesquisa de mercado que revela o que seu público realmente quer comprar",
        "icon": "🎯",
        "color": "from-blue-800 to-cyan-900",
        "duration": "2h",
        "summary": "",
        "lessons": [
          {
            "id": "jobs-to-be-done",
            "title": "Jobs to Be Done: O Framework que Explica Por que as Pessoas Realmente Compram",
            "duration": "28 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "pesquisa-mercado-pratica",
            "title": "Pesquisa de Mercado Prática: 5 Métodos para Descobrir o que Sua Audiência Comprará",
            "duration": "25 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "avatar-real-versus-imaginado",
            "title": "Avatar Real vs. Avatar Imaginado: Como Validar Quem É Seu Cliente de Verdade",
            "duration": "20 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "audiencia-para-cliente",
            "title": "Da Audiência ao Cliente: O Funil de Confiança que Transforma Seguidores em Compradores",
            "duration": "22 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          }
        ],
        "locked": false
      },
      {
        "id": "criacao-produtos-digitais",
        "number": 33,
        "title": "Criando Produtos Digitais: Do Zero ao Produto que o Mercado Quer",
        "subtitle": "Tipos, estruturas, produção e o processo de criação que elimina a paralisia",
        "icon": "🛠️",
        "color": "from-emerald-800 to-green-900",
        "duration": "2h 10min",
        "summary": "",
        "lessons": [
          {
            "id": "tipos-produtos-digitais",
            "title": "Os 8 Tipos de Produto Digital e Quando Usar Cada Um",
            "duration": "25 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "estrutura-curso-online",
            "title": "Estrutura de Curso Online: Do Briefing às Aulas Gravadas",
            "duration": "28 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "validacao-antes-criar",
            "title": "Validar Antes de Criar: O Método que Elimina o Risco de Criar Produto que Não Vende",
            "duration": "25 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "precificacao-produto-digital",
            "title": "Precificação: Como Definir o Preço que Vende Mais (Não o Mais Barato)",
            "duration": "22 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          }
        ],
        "locked": false
      },
      {
        "id": "escolha-plataforma-entrega",
        "number": 34,
        "title": "Escolha de Plataforma, Teste e Entrega do Produto",
        "subtitle": "Como escolher onde vender, como testar antes de lançar e como entregar uma experiência que retém",
        "icon": "🚀",
        "color": "from-violet-800 to-purple-900",
        "duration": "1h 50min",
        "summary": "",
        "lessons": [
          {
            "id": "criterios-escolha-plataforma",
            "title": "Como Escolher a Plataforma Certa para Seu Produto",
            "duration": "25 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "teste-completo-produto",
            "title": "Testando Tudo Antes de Lançar: O Checklist de 42 Pontos",
            "duration": "22 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "entrega-experiencia-cliente",
            "title": "Entrega e Experiência do Cliente: O que Acontece Depois da Venda Decide Tudo",
            "duration": "25 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          }
        ],
        "locked": false
      }
    ]
  },
  {
    "id": "frequencias-mentais",
    "number": 11,
    "title": "As 4 Frequências Mentais",
    "description": "Engenharia mental de elite: mapeie em qual frequência você opera hoje, quebre os bloqueios do ciclo neuroestrutural e instale a Mente de Destino — a frequência que dobra a realidade à execução, não o contrário.",
    "badge": "Mentalidade de Elite",
    "chapters": [
      {
        "id": "ciclo-neuroestrutural",
        "number": 1,
        "title": "O Ciclo Neuroestrutural da Realidade",
        "subtitle": "Entenda a engrenagem que roda no motor biológico e cognitivo",
        "icon": "🧠",
        "color": "from-violet-600 to-purple-700",
        "duration": "50 min",
        "summary": "",
        "locked": false,
        "lessons": [
          {
            "id": "fm-ciclo-1",
            "title": "A Linha de Montagem Interna",
            "duration": "18 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "fm-ciclo-2",
            "title": "Diagnóstico: Em Qual Frequência Você Está Agora?",
            "duration": "22 min",
            "type": "exercise",
            "content": "",
            "keyPoints": []
          }
        ]
      },
      {
        "id": "frequencia-1-operacional",
        "number": 2,
        "title": "Frequência 1: A Mente Operacional",
        "subtitle": "A Roda da Sobrevivência — diagnóstico e quebra do ciclo do medo",
        "icon": "🔴",
        "color": "from-red-700 to-red-900",
        "duration": "55 min",
        "summary": "",
        "locked": false,
        "lessons": [
          {
            "id": "fm-op-1",
            "title": "O Mapa da Mente Operacional",
            "duration": "20 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "fm-op-2",
            "title": "Exercício PNL: A Desassociação do Locus",
            "duration": "35 min",
            "type": "exercise",
            "content": "",
            "keyPoints": []
          }
        ]
      },
      {
        "id": "frequencia-2-gestora",
        "number": 3,
        "title": "Frequência 2: A Mente Gestora/Executiva",
        "subtitle": "A Roda do Controle — quebrando o teto do esgotamento",
        "icon": "🟡",
        "color": "from-amber-600 to-yellow-700",
        "duration": "50 min",
        "summary": "",
        "locked": false,
        "lessons": [
          {
            "id": "fm-gest-1",
            "title": "O Mapa da Mente Gestora",
            "duration": "18 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "fm-gest-2",
            "title": "Exercício PNL: O Pivot de Metaprograma",
            "duration": "32 min",
            "type": "exercise",
            "content": "",
            "keyPoints": []
          }
        ]
      },
      {
        "id": "frequencia-3-empreendedora",
        "number": 4,
        "title": "Frequência 3: A Mente Empreendedora",
        "subtitle": "A Roda da Validação — estabilizando a montanha-russa dopaminérgica",
        "icon": "🔵",
        "color": "from-blue-600 to-indigo-700",
        "duration": "55 min",
        "summary": "",
        "locked": false,
        "lessons": [
          {
            "id": "fm-emp-1",
            "title": "O Mapa da Mente Empreendedora",
            "duration": "20 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "fm-emp-2",
            "title": "Exercício PNL: A Estabilização Hormonal da Identidade",
            "duration": "35 min",
            "type": "exercise",
            "content": "",
            "keyPoints": []
          }
        ]
      },
      {
        "id": "frequencia-4-destino",
        "number": 5,
        "title": "Frequência 4: A Mente de Destino",
        "subtitle": "O Decreto Inabalável — instalando a obstinação cirúrgica",
        "icon": "⚡",
        "color": "from-emerald-500 to-teal-600",
        "duration": "75 min",
        "summary": "",
        "locked": false,
        "lessons": [
          {
            "id": "fm-dest-1",
            "title": "O Ciclo Invertido: Como a Frequência 4 Hackeia a Realidade",
            "duration": "25 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "fm-dest-2",
            "title": "A Ponte ao Futuro Reversa — Construindo a Memória de Futuro",
            "duration": "30 min",
            "type": "exercise",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "fm-dest-3",
            "title": "Manutenção Ecológica da Frequência 4",
            "duration": "20 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          }
        ]
      }
    ]
  },
  {
    "id": "psicologia-avancada",
    "number": 12,
    "title": "Psicologia Avançada de Vendas",
    "description": "Os 8 frameworks que os melhores copywriters e estrategistas do mundo usam para mover decisões de compra — operacionalizados como regras de decisão, não conceitos abstratos.",
    "badge": "Premium",
    "chapters": [
      {
        "id": "mente-comprador",
        "number": 35,
        "title": "A Mente do Comprador",
        "subtitle": "Kahneman, Ariely e Thaler: a neurociência das decisões de compra",
        "icon": "🧠",
        "color": "from-violet-700 to-purple-800",
        "duration": "65 min",
        "summary": "",
        "lessons": [
          {
            "id": "psi-kahneman-1",
            "title": "Prospect Theory: Por Que Perder Dói Mais Que Ganhar",
            "duration": "20 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "psi-ariely-1",
            "title": "Irracionalidade Previsível: Dan Ariely e as Anomalias de Decisão",
            "duration": "18 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          }
        ]
      },
      {
        "id": "sofisticacao-mercado",
        "number": 36,
        "title": "Sofisticação de Mercado — Eugene Schwartz",
        "subtitle": "Os 5 níveis que determinam o tipo de lead, headline e promessa da campanha",
        "icon": "🎯",
        "color": "from-blue-700 to-indigo-800",
        "duration": "55 min",
        "summary": "",
        "lessons": [
          {
            "id": "psi-schwartz-1",
            "title": "Os 5 Níveis de Sofisticação de Schwartz — Com Exemplos Reais",
            "duration": "22 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "psi-masterson-1",
            "title": "O Resistance Meter de Michael Masterson",
            "duration": "15 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          }
        ]
      },
      {
        "id": "pre-suasao",
        "number": 37,
        "title": "Pre-Suasão e Framing — Cialdini",
        "subtitle": "A persuasão começa antes da mensagem: como preparar o frame mental do prospect",
        "icon": "🔮",
        "color": "from-emerald-700 to-teal-800",
        "duration": "50 min",
        "summary": "",
        "lessons": [
          {
            "id": "psi-cialdini-presuasion",
            "title": "Pre-Suasion: O que Vem Antes Determina o que Vem Depois",
            "duration": "20 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "psi-blair-warren",
            "title": "Blair Warren: Uma Frase. Toda Persuasão.",
            "duration": "15 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          }
        ]
      },
      {
        "id": "precificacao-psicologica",
        "number": 38,
        "title": "Precificação Psicológica",
        "subtitle": "Van Westendorp, ancoragem, decoy e a psicologia do preço ótimo",
        "icon": "💰",
        "color": "from-amber-700 to-orange-800",
        "duration": "45 min",
        "summary": "",
        "lessons": [
          {
            "id": "psi-van-westendorp",
            "title": "Van Westendorp PSM: Encontrando o Preço Ótimo com 4 Perguntas",
            "duration": "18 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          }
        ]
      },
      {
        "id": "prova-credibilidade",
        "number": 39,
        "title": "Prova e Credibilidade — Gary Bencivenga",
        "subtitle": "A pirâmide de evidência que elimina o ceticismo racional de forma irrefutável",
        "icon": "📊",
        "color": "from-rose-700 to-red-800",
        "duration": "40 min",
        "summary": "",
        "lessons": [
          {
            "id": "psi-bencivenga-1",
            "title": "O Princípio da Prova — Gary Bencivenga",
            "duration": "20 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "psi-jay-abraham",
            "title": "Jay Abraham: Strategy of Preeminence e o Próximo Problema",
            "duration": "18 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          }
        ]
      }
    ]
  },
  {
    "id": "seo-perpetuo",
    "number": 13,
    "title": "SEO para Produtos Digitais",
    "description": "O canal orgânico que alimenta o funil perpétuo. Aprenda a ranquear no Google, YouTube e redes sociais para capturar leads que já estão procurando o que você vende — sem pagar por tráfego a cada venda.",
    "badge": "Módulo Premium",
    "standalone": true,
    "standalonePrice": 497,
    "standaloneOriginalPrice": 997,
    "chapters": [
      {
        "id": "seo-vs-lancamento",
        "number": 40,
        "title": "SEO vs Lançamento: Onde Cada Um Vive",
        "subtitle": "Por que SEO não funciona em PLF mas é ouro no perpétuo",
        "icon": "🔍",
        "color": "from-emerald-600 to-teal-600",
        "duration": "50 min",
        "summary": "",
        "lessons": [
          {
            "id": "seo-perp-1",
            "title": "Por Que SEO e PLF Vivem em Universos Diferentes",
            "duration": "14 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "seo-perp-2",
            "title": "Como o Google Decide Quem Aparece: Intenção de Busca",
            "duration": "18 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "seo-perp-3",
            "title": "Pesquisa de Palavras-Chave para Infoprodutores",
            "duration": "18 min",
            "type": "exercise",
            "content": "",
            "keyPoints": []
          }
        ]
      },
      {
        "id": "seo-on-page",
        "number": 41,
        "title": "SEO On-Page para Infoprodutores",
        "subtitle": "Estrutura técnica que ranqueia: title, H1, meta e URL",
        "icon": "📄",
        "color": "from-teal-600 to-cyan-600",
        "duration": "55 min",
        "summary": "",
        "lessons": [
          {
            "id": "seo-perp-4",
            "title": "Anatomia da Página que Ranqueia: Title, H1, Meta, URL",
            "duration": "20 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "seo-perp-5",
            "title": "Content Clusters: Como Construir Autoridade de Tópico",
            "duration": "22 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "seo-perp-6",
            "title": "SEO para Página de Captura do Funil Perpétuo",
            "duration": "13 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          }
        ]
      },
      {
        "id": "seo-perpetuo-execucao",
        "number": 42,
        "title": "SEO no Perpétuo: Execução e Calendário",
        "subtitle": "YouTube SEO, blog como motor de leads, e rotina de publicação sustentável",
        "icon": "📅",
        "color": "from-cyan-600 to-blue-600",
        "duration": "45 min",
        "summary": "",
        "lessons": [
          {
            "id": "seo-perp-7",
            "title": "YouTube SEO no Funil Perpétuo",
            "duration": "16 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "seo-perp-8",
            "title": "Calendário de Conteúdo SEO: Rotina Sustentável",
            "duration": "14 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "seo-perp-9",
            "title": "Métricas de SEO: O Que Medir e Quando Esperar",
            "duration": "15 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          }
        ]
      }
    ]
  },
  {
    "id": "bonus-infraestrutura",
    "number": 0,
    "title": "🎁 BÔNUS: Infraestrutura Completa de Lançamento",
    "description": "Módulo adicional exclusivo. Tudo que você precisa configurar antes de lançar: domínio, email profissional, WhatsApp Business, redes sociais e todas as integrações de ads — do zero ao automático.",
    "badge": "Bônus Exclusivo",
    "chapters": [
      {
        "id": "bonus-dominio-email",
        "number": 1,
        "title": "Domínio Profissional + Email Autenticado",
        "subtitle": "Como sair do @gmail para o @seudominio sem cair no spam",
        "icon": "🌐",
        "color": "from-violet-600 to-purple-600",
        "duration": "40 min",
        "summary": "",
        "lessons": [
          {
            "id": "bonus-dominio-1",
            "title": "Por Que Domínio Próprio é Obrigatório",
            "duration": "8 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "bonus-dominio-2",
            "title": "Comprando Seu Domínio: Passo a Passo",
            "duration": "12 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "bonus-dominio-3",
            "title": "Configurando Email Profissional com Resend",
            "duration": "20 min",
            "type": "exercise",
            "content": "",
            "keyPoints": []
          }
        ]
      },
      {
        "id": "bonus-whatsapp",
        "number": 2,
        "title": "WhatsApp Business: Configuração Profissional",
        "subtitle": "De número pessoal para canal de vendas automatizado",
        "icon": "💬",
        "color": "from-green-600 to-emerald-600",
        "duration": "35 min",
        "summary": "",
        "lessons": [
          {
            "id": "bonus-whatsapp-1",
            "title": "WhatsApp Business vs Pessoal: O Que Muda",
            "duration": "10 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "bonus-whatsapp-2",
            "title": "Catálogo de Produtos e Mensagens Automáticas",
            "duration": "15 min",
            "type": "exercise",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "bonus-whatsapp-3",
            "title": "WhatsApp Business API: Automação Completa",
            "duration": "10 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          }
        ]
      },
      {
        "id": "bonus-meta-ads",
        "number": 3,
        "title": "Meta Ads: Configuração Completa",
        "subtitle": "Facebook Ads + Instagram Ads do zero ao primeiro anúncio",
        "icon": "📘",
        "color": "from-blue-600 to-blue-700",
        "duration": "50 min",
        "summary": "",
        "lessons": [
          {
            "id": "bonus-meta-1",
            "title": "Estrutura da Conta Meta Ads",
            "duration": "15 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "bonus-meta-2",
            "title": "Pixel do Meta: Instalação e Eventos",
            "duration": "20 min",
            "type": "exercise",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "bonus-meta-3",
            "title": "Primeira Campanha de Captação",
            "duration": "15 min",
            "type": "exercise",
            "content": "",
            "keyPoints": []
          }
        ]
      },
      {
        "id": "bonus-tiktok-google-ads",
        "number": 4,
        "title": "TikTok Ads, Google Ads e Outras Plataformas",
        "subtitle": "Expansão para além do Meta: onde mais colocar seu budget",
        "icon": "🎯",
        "color": "from-pink-600 to-rose-600",
        "duration": "45 min",
        "summary": "",
        "lessons": [
          {
            "id": "bonus-tiktok-1",
            "title": "TikTok Ads: A Plataforma que Cresce Mais Rápido",
            "duration": "20 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "bonus-google-ads",
            "title": "Google Ads: Capturando Quem Já Está Procurando",
            "duration": "15 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "bonus-linkedin-outros",
            "title": "LinkedIn, X, Pinterest e Plataformas de Nicho",
            "duration": "10 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          }
        ]
      },
      {
        "id": "bonus-redes-sociais",
        "number": 5,
        "title": "Conectando Todas as Redes Sociais",
        "subtitle": "Instagram, Facebook, YouTube, LinkedIn, TikTok — organicamente integrados",
        "icon": "🔗",
        "color": "from-orange-500 to-amber-500",
        "duration": "30 min",
        "summary": "",
        "lessons": [
          {
            "id": "bonus-social-1",
            "title": "Perfis Otimizados para Lançamento",
            "duration": "15 min",
            "type": "exercise",
            "content": "",
            "keyPoints": []
          },
          {
            "id": "bonus-social-2",
            "title": "Agendamento e Automação de Conteúdo",
            "duration": "15 min",
            "type": "text",
            "content": "",
            "keyPoints": []
          }
        ]
      },
      {
        "id": "bonus-checklist-final",
        "number": 6,
        "title": "Checklist Completo: Do Zero ao Lançamento Automatizado",
        "subtitle": "Tudo que precisa estar configurado antes de apertar o botão",
        "icon": "✅",
        "color": "from-cyan-600 to-teal-600",
        "duration": "20 min",
        "summary": "",
        "lessons": [
          {
            "id": "bonus-checklist-1",
            "title": "O Checklist de 47 Itens",
            "duration": "20 min",
            "type": "exercise",
            "content": "",
            "keyPoints": []
          }
        ]
      }
    ]
  }
];

export const PRODUCTS = [
  {
    id: "free-guide",
    name: "Os 7 Erros do Primeiro Lançamento",
    price: 0,
    type: "free" as const,
    description: "Guia gratuito com os erros mais comuns de quem estreia no digital — e o que fazer diferente desde o início. PDF de acesso imediato.",
    features: [
      "12 páginas direto ao ponto",
      "Os 7 erros com exemplos reais",
      "Checklist de autodiagnóstico",
      "Acesso imediato ao PDF"
    ],
    badge: "Gratuito"
  },
  {
    id: "mini-guide",
    name: "Mapa dos Primeiros R$10K em Vendas Online",
    price: 97,
    originalPrice: 299,
    type: "starter" as const,
    description: "O guia operacional para quem quer sair do zero e chegar aos primeiros 5 dígitos em vendas online — sem produto pronto, sem seguidores, sem equipe.",
    features: [
      "10 capítulos práticos e densos — sem teoria vaga",
      "Scripts de copy prontos para copiar e usar",
      "Checklist de 7 dias: um cliente pagante em 7 dias",
      "Estratégia 'Sem Seguidores' para quem está no zero",
      "Matador de objeções com respostas exatas para cada situação",
      "Produto Escada: como ir de R$97 até R$10K no mesmo funil",
      "Acesso imediato + atualizações gratuitas vitalícias"
    ],
    badge: "🔥 Mais Vendido"
  },
  {
    id: "complete-bundle",
    name: "Metodologia NexOS — Edição Completa",
    price: 2500,
    type: "premium" as const,
    description: "O ebook mais completo sobre lançamentos digitais do Brasil + slides profissionais + acesso ao portal de treinamento.",
    features: [
      "Ebook de 380+ páginas (PDF + ePub)",
      "192 slides em 8 módulos (PowerPoint + Keynote)",
      "Acesso vitalício ao portal de treinamento",
      "Atualizações por 2 anos",
      "Comunidade exclusiva no WhatsApp",
      "3 templates de VSL prontos",
      "Swipe file com 200+ exemplos",
      "Suporte prioritário por email"
    ],
    badge: "Acesso Completo"
  }
];

export function setPaidCurriculum(modules: Module[]) { CURRICULUM.splice(0, CURRICULUM.length, ...modules); }
const PUBLIC_CATALOG: Module[] = structuredClone(CURRICULUM);
export function resetPaidCurriculum() { setPaidCurriculum(structuredClone(PUBLIC_CATALOG)); }
