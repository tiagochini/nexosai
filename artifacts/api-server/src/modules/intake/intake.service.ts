import { eq, and } from "drizzle-orm";
import {
  db,
  campaignsTable,
  auditLogsTable,
  type Campaign,
} from "@workspace/db";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import type { Logger } from "pino";

export type CampaignType =
  | "launch"
  | "perpetual_launch"
  | "flash_sale"
  | "live_sale"
  | "continuous_sales"
  | "subscription_growth"
  | "authority"
  | "audience_growth"
  | "branding"
  | "creator_monetization"
  | "upsell"
  | "remarketing"
  | "affiliate"
  | "scale"
  | "regional_dominance"
  // Seed / validation launch — sell before building, validate with real money
  | "semente_launch";

export type CampaignTrack =
  | "six_digits"
  | "eight_digits"
  | "ten_digits"
  | "not_applicable";

export interface IntakeQuestion {
  id: string;
  section: string;
  label: string;
  description?: string;
  type: "text" | "textarea" | "select" | "multiselect" | "number" | "boolean";
  options?: { value: string; label: string }[];
  required: boolean;
  aiDecide?: boolean;
  tracks?: CampaignTrack[];
  campaignTypes?: CampaignType[];
  placeholder?: string;
}

// ─── SHARED BASE QUESTIONS (all campaign types) ───────────────────────────────

const BASE_PRODUCT_QUESTIONS: IntakeQuestion[] = [
  {
    id: "product.name",
    section: "produto",
    label: "Nome do produto ou serviço",
    type: "text",
    required: true,
    placeholder: "Ex: Método Lançamento Acelerado",
  },
  {
    id: "product.description",
    section: "produto",
    label: "Descreva seu produto em detalhes",
    description: "Quanto mais detalhes, mais precisa será a campanha",
    type: "textarea",
    required: true,
    placeholder: "O que é, como funciona, o que entrega, qual a transformação...",
  },
  {
    id: "product.category",
    section: "produto",
    label: "Categoria do produto",
    type: "select",
    options: [
      { value: "infoproduct", label: "Infoproduto (curso, ebook, mentoria digital)" },
      { value: "mentorship", label: "Mentoria / Consultoria" },
      { value: "software", label: "Software / SaaS" },
      { value: "service", label: "Serviço contínuo" },
      { value: "ecommerce", label: "E-commerce / Produto físico" },
      { value: "community", label: "Comunidade / Assinatura" },
      { value: "event", label: "Evento / Imersão presencial" },
    ],
    required: true,
  },
  {
    id: "product.deliveryMethod",
    section: "produto",
    label: "Como o produto é entregue?",
    type: "select",
    options: [
      { value: "100_online", label: "100% online / digital" },
      { value: "hybrid", label: "Híbrido (online + presencial)" },
      { value: "in_person", label: "Presencial" },
      { value: "physical_shipment", label: "Envio físico" },
    ],
    required: true,
  },
  {
    id: "product.price",
    section: "produto",
    label: "Preço de venda (R$)",
    type: "number",
    required: true,
    placeholder: "Ex: 997",
  },
  {
    id: "product.pricingModel",
    section: "produto",
    label: "Modelo de precificação",
    type: "select",
    options: [
      { value: "one_time", label: "Pagamento único" },
      { value: "installments", label: "Parcelado (sem recorrência)" },
      { value: "recurring_monthly", label: "Assinatura mensal" },
      { value: "recurring_annual", label: "Assinatura anual" },
      { value: "hybrid", label: "Entrada + recorrência" },
    ],
    required: true,
  },
  {
    id: "product.socialProof",
    section: "produto",
    label: "Qual é sua prova social? (resultados, depoimentos, números)",
    description: "Seja honesto. A IA só trabalha com prova real.",
    type: "textarea",
    required: false,
    placeholder: "Ex: 2.300 alunos, taxa de conclusão 78%, 40 casos documentados...",
  },
];

const BASE_AUDIENCE_QUESTIONS: IntakeQuestion[] = [
  {
    id: "audience.description",
    section: "audiência",
    label: "Descreva seu avatar ideal",
    type: "textarea",
    required: true,
    placeholder: "Ex: Mulher 35-45 anos, profissional liberal, renda R$8k–R$15k...",
  },
  {
    id: "audience.painPoints",
    section: "audiência",
    label: "Quais são as principais dores do avatar?",
    type: "textarea",
    required: true,
    aiDecide: true,
    placeholder: "Liste 3-5 dores mais críticas...",
  },
  {
    id: "audience.desires",
    section: "audiência",
    label: "Quais são os desejos mais profundos do avatar?",
    type: "textarea",
    required: true,
    aiDecide: true,
  },
  {
    id: "audience.decisionMaker",
    section: "audiência",
    label: "Quem toma a decisão de compra?",
    description: "Quem paga vs. quem usa pode ser pessoas diferentes (ex: empresa B2B, escola, clínica)",
    type: "select",
    options: [
      { value: "self", label: "A própria pessoa (B2C direto)" },
      { value: "business_owner", label: "Dono do negócio / Empresário" },
      { value: "manager", label: "Gestor / Coordenador" },
      { value: "teacher_educator", label: "Professor / Educador" },
      { value: "hr_department", label: "RH / Departamento de treinamento" },
      { value: "couple_family", label: "Casal / Decisão familiar" },
      { value: "committee", label: "Comitê / Decisão coletiva" },
    ],
    required: false,
    aiDecide: true,
  },
  {
    id: "audience.buyerVsUser",
    section: "audiência",
    label: "Quem paga é quem usa o produto?",
    description: "Importante para definir a copy correta — falar com quem paga ou quem usa",
    type: "textarea",
    required: false,
    aiDecide: true,
    placeholder: "Ex: A escola paga, mas o professor usa. A empresa paga, mas o funcionário usa.",
  },
  {
    id: "audience.sophisticationLevel",
    section: "audiência",
    label: "Nível de consciência da audiência",
    type: "select",
    options: [
      { value: "unaware", label: "Inconsciente — não sabe que tem o problema" },
      { value: "problem_aware", label: "Consciente do problema — não conhece soluções" },
      { value: "solution_aware", label: "Consciente da solução — não te conhece" },
      { value: "product_aware", label: "Consciente do produto — já te conhece, não comprou" },
      { value: "most_aware", label: "Mais consciente — já comprou de você" },
    ],
    required: true,
    aiDecide: true,
  },
  {
    id: "audience.location",
    section: "audiência",
    label: "Localização geográfica",
    type: "select",
    options: [
      { value: "brazil_nationwide", label: "Brasil (nacional)" },
      { value: "brazil_southeast", label: "Brasil Sudeste" },
      { value: "brazil_northeast", label: "Brasil Nordeste" },
      { value: "latin_america", label: "América Latina" },
      { value: "portugal", label: "Portugal" },
      { value: "global_ptbr", label: "Global em PT-BR" },
    ],
    required: true,
  },
  {
    id: "business.hasPhysicalLocation",
    section: "audiência",
    label: "Seu negócio tem presença física local?",
    description: "Academias, studios, clínicas, restaurantes, lojas — ativa segmentação por raio geográfico de 3–10km.",
    type: "select",
    options: [
      { value: "yes", label: "Sim — tenho endereço(s) físico(s)" },
      { value: "no",  label: "Não — 100% digital / remoto" },
    ],
    required: false,
    aiDecide: true,
  },
  {
    id: "business.physicalCities",
    section: "audiência",
    label: "Em quais cidades/bairros está sua operação física?",
    description: "Usado para raio geográfico de 3–10km. Ex: 'São Paulo - Vila Olímpia e Itaim'. O agente de targeting criará públicos com raio ao redor de cada localização.",
    type: "textarea",
    required: false,
    aiDecide: true,
    placeholder: "Ex: São Paulo - Pinheiros e Vila Madalena. Belo Horizonte - Savassi.",
  },
];

const BASE_CREATOR_QUESTIONS: IntakeQuestion[] = [
  {
    id: "creator.name",
    section: "criador",
    label: "Seu nome (ou nome da marca)",
    type: "text",
    required: true,
  },
  {
    id: "creator.positioning",
    section: "criador",
    label: "Qual é o seu posicionamento?",
    type: "select",
    options: [
      { value: "expert", label: "Expert / Especialista reconhecido" },
      { value: "authority", label: "Autoridade de mercado" },
      { value: "storyteller", label: "Contador de histórias / Inspiração" },
      { value: "educator", label: "Educador / Professor" },
      { value: "entertainer", label: "Entertainer / Criador de conteúdo" },
      { value: "transformation", label: "Guardião da transformação" },
      { value: "community_leader", label: "Líder de comunidade" },
    ],
    required: true,
    aiDecide: true,
  },
  {
    id: "creator.uniqueAngle",
    section: "criador",
    label: "Qual é o seu ângulo único / diferencial?",
    type: "textarea",
    required: true,
    aiDecide: true,
    placeholder: "O que te faz diferente de todos no mercado?",
  },
];

const BASE_CONTENT_QUESTIONS: IntakeQuestion[] = [
  {
    id: "content.style",
    section: "conteúdo",
    label: "Estilo de conteúdo preferido",
    type: "multiselect",
    options: [
      { value: "educational", label: "Educativo / Didático" },
      { value: "inspirational", label: "Inspiracional / Motivacional" },
      { value: "provocative", label: "Provocativo / Questionador" },
      { value: "testimonial", label: "Depoimentos / Provas sociais" },
      { value: "documentary", label: "Documentário / Bastidores" },
      { value: "storytelling", label: "Storytelling / Narrativa" },
      { value: "authority", label: "Autoridade / Dados e pesquisas" },
    ],
    required: true,
    aiDecide: true,
  },
  {
    id: "content.tone",
    section: "conteúdo",
    label: "Tom de comunicação",
    type: "select",
    options: [
      { value: "formal", label: "Formal / Profissional" },
      { value: "casual", label: "Casual / Descontraído" },
      { value: "intimate", label: "Íntimo / Próximo" },
      { value: "urgent", label: "Urgente / Direto" },
      { value: "empathetic", label: "Empático / Acolhedor" },
      { value: "challenger", label: "Desafiador / Transformador" },
    ],
    required: true,
    aiDecide: true,
  },
  {
    id: "content.forbiddenTopics",
    section: "conteúdo",
    label: "Temas ou abordagens que NÃO devem ser usados",
    type: "textarea",
    required: false,
    placeholder: "Ex: não mencionar concorrentes, evitar promessas de riqueza rápida...",
  },
];

const BASE_RISK_QUESTIONS: IntakeQuestion[] = [
  {
    id: "risk.tolerance",
    section: "risco",
    label: "Tolerância a risco na campanha",
    type: "select",
    options: [
      { value: "conservative", label: "Conservador — crescimento seguro e previsível" },
      { value: "moderate", label: "Moderado — aceito arriscar parte do budget" },
      { value: "aggressive", label: "Agressivo — all-in, quero resultado máximo" },
    ],
    required: true,
    aiDecide: true,
  },
  {
    id: "risk.previousCampaigns",
    section: "risco",
    label: "Já fez campanhas antes? Qual foi o resultado?",
    type: "textarea",
    required: false,
    placeholder: "Ex: Fiz 3 lançamentos, o maior foi R$150k...",
  },
];

// ─── LAUNCH-SPECIFIC QUESTIONS ────────────────────────────────────────────────

const LAUNCH_QUESTIONS: IntakeQuestion[] = [
  {
    id: "campaign.revenueTarget",
    section: "lançamento",
    label: "Meta de faturamento da campanha (R$)",
    type: "number",
    required: true,
    placeholder: "Ex: 300000",
  },
  {
    id: "campaign.budget.total",
    section: "lançamento",
    label: "Budget total disponível (R$)",
    type: "number",
    required: true,
    placeholder: "Ex: 35000",
  },
  {
    id: "campaign.budget.traffic",
    section: "lançamento",
    label: "Budget para tráfego pago (R$)",
    type: "number",
    required: false,
    aiDecide: true,
    placeholder: "Ex: 25000",
  },
  {
    id: "campaign.salesChannel",
    section: "lançamento",
    label: "Canal principal de vendas",
    type: "select",
    options: [
      { value: "sales_page", label: "Página de vendas (checkout)" },
      { value: "whatsapp_group", label: "Grupo de WhatsApp" },
      { value: "webinar", label: "Webinário / Aula ao vivo" },
      { value: "lives", label: "Lives (Instagram, YouTube)" },
      { value: "vsl", label: "VSL (Video Sales Letter)" },
      { value: "telegram", label: "Canal do Telegram" },
      { value: "hybrid", label: "Multi-canal" },
    ],
    required: true,
    aiDecide: true,
  },
  {
    id: "launch.cartOpenDate",
    section: "lançamento",
    label: "Data prevista de abertura do carrinho",
    description: "O climax do lançamento — quando o produto finalmente fica disponível",
    type: "text",
    required: false,
    placeholder: "Ex: 15/06/2026 ou 'em 30 dias'",
  },
  {
    id: "launch.cartOpenDuration",
    section: "lançamento",
    label: "Por quantos dias o carrinho fica aberto?",
    description: "Normalmente 3-7 dias. Menos tempo = mais urgência",
    type: "number",
    required: true,
    placeholder: "Ex: 5",
  },
  {
    id: "launch.scarcityMechanism",
    section: "lançamento",
    label: "Mecanismo de escassez / urgência",
    type: "select",
    options: [
      { value: "deadline", label: "Prazo fixo de fechamento" },
      { value: "limited_spots", label: "Vagas limitadas" },
      { value: "bonus_expiry", label: "Bônus exclusivos expiram" },
      { value: "price_increase", label: "Preço sobe após período" },
      { value: "combined", label: "Combinação de mecanismos" },
    ],
    required: true,
    aiDecide: true,
  },
  {
    id: "campaign.hasAffiliate",
    section: "lançamento",
    label: "Vai ativar programa de afiliados?",
    type: "boolean",
    required: true,
  },
  {
    id: "campaign.affiliateCommission",
    section: "lançamento",
    label: "Comissão de afiliados (%)",
    type: "number",
    required: false,
    placeholder: "Ex: 30",
  },
  {
    id: "risk.tolerance",
    section: "risco",
    label: "Tolerância a risco na campanha",
    type: "select",
    options: [
      { value: "conservative", label: "Conservador — crescimento seguro e previsível" },
      { value: "moderate", label: "Moderado — aceito arriscar parte do budget" },
      { value: "aggressive", label: "Agressivo — all-in, quero resultado máximo" },
    ],
    required: true,
    aiDecide: true,
  },
  {
    id: "risk.previousCampaigns",
    section: "risco",
    label: "Já fez lançamentos antes? Qual foi o resultado?",
    type: "textarea",
    required: false,
    placeholder: "Ex: Fiz 3 lançamentos, o maior faturou R$150k...",
  },
];

const LAUNCH_8_DIGIT_EXTRA: IntakeQuestion[] = [
  {
    id: "scale.partnerStrategy",
    section: "escala",
    label: "Estratégia de parceiros / co-produtores",
    type: "textarea",
    required: false,
    aiDecide: true,
    tracks: ["eight_digits", "ten_digits"],
    placeholder: "Tem parceiros, influenciadores ou co-produtores?",
  },
  {
    id: "scale.affiliateStructure",
    section: "escala",
    label: "Estrutura de afiliados para escala",
    type: "textarea",
    required: true,
    aiDecide: true,
    tracks: ["eight_digits", "ten_digits"],
    placeholder: "Quantos afiliados, quais perfis, estratégia de ativação...",
  },
  {
    id: "scale.channelDiversification",
    section: "escala",
    label: "Canais para escala",
    type: "multiselect",
    options: [
      { value: "meta_ads", label: "Meta Ads (Facebook + Instagram)" },
      { value: "google_ads", label: "Google Ads / YouTube" },
      { value: "tiktok_ads", label: "TikTok Ads" },
      { value: "influencer", label: "Marketing de influência" },
      { value: "email", label: "E-mail marketing" },
      { value: "affiliate_network", label: "Rede de afiliados" },
    ],
    required: true,
    aiDecide: true,
    tracks: ["eight_digits", "ten_digits"],
  },
];

// ─── PERPETUAL LAUNCH-SPECIFIC QUESTIONS ─────────────────────────────────────

const PERPETUAL_LAUNCH_QUESTIONS: IntakeQuestion[] = [
  {
    id: "campaign.revenueTarget",
    section: "perpétuo",
    label: "Meta de receita mensal recorrente (R$/mês)",
    type: "number",
    required: true,
    placeholder: "Ex: 80000",
  },
  {
    id: "campaign.budget.traffic",
    section: "perpétuo",
    label: "Budget mensal de tráfego pago (R$)",
    type: "number",
    required: true,
    placeholder: "Ex: 8000",
  },
  {
    id: "perpetual.triggerFormat",
    section: "perpétuo",
    label: "Formato do evento de trigger (o que abre o carrinho)",
    description: "Esse é o coração do lançamento perpétuo — o que faz o lead assistir antes de ver a oferta",
    type: "select",
    options: [
      { value: "vsl", label: "VSL — Video Sales Letter (vídeo de vendas longo)" },
      { value: "webinar", label: "Webinário gravado (parece ao vivo)" },
      { value: "challenge", label: "Desafio de 3-5 dias" },
      { value: "mini_course", label: "Mini-curso gratuito" },
      { value: "quiz", label: "Quiz / Diagnóstico personalizado" },
    ],
    required: true,
    aiDecide: true,
  },
  {
    id: "perpetual.cartOpenDuration",
    section: "perpétuo",
    label: "Por quantas horas o carrinho fica aberto por lead?",
    description: "Urgência individual por lead. Recomendado: 48-72h",
    type: "number",
    required: true,
    placeholder: "Ex: 48",
  },
  {
    id: "perpetual.nurturingDays",
    section: "perpétuo",
    label: "Quantos dias de nutrição antes de mostrar a oferta?",
    description: "Do opt-in até o trigger. Recomendado: 3-7 dias",
    type: "number",
    required: true,
    placeholder: "Ex: 5",
  },
  {
    id: "perpetual.automationPlatform",
    section: "perpétuo",
    label: "Plataforma de automação que vai usar",
    type: "select",
    options: [
      { value: "activecampaign", label: "ActiveCampaign" },
      { value: "klicksend", label: "Klicksend" },
      { value: "leadlovers", label: "Leadlovers" },
      { value: "mailchimp", label: "Mailchimp" },
      { value: "convertkit", label: "ConvertKit / Kit" },
      { value: "rd_station", label: "RD Station" },
      { value: "not_decided", label: "Ainda não decidi" },
    ],
    required: false,
    aiDecide: true,
  },
  {
    id: "perpetual.monthlyEntryTarget",
    section: "perpétuo",
    label: "Quantos leads entram no funil por mês?",
    type: "number",
    required: false,
    aiDecide: true,
    placeholder: "Ex: 1000",
  },
  {
    id: "risk.tolerance",
    section: "risco",
    label: "Tolerância a risco",
    type: "select",
    options: [
      { value: "conservative", label: "Conservador" },
      { value: "moderate", label: "Moderado" },
      { value: "aggressive", label: "Agressivo" },
    ],
    required: true,
    aiDecide: true,
  },
];

// ─── CONTINUOUS SALES-SPECIFIC QUESTIONS ─────────────────────────────────────

const CONTINUOUS_SALES_QUESTIONS: IntakeQuestion[] = [
  {
    id: "campaign.revenueTarget",
    section: "vendas contínuas",
    label: "Meta de receita mensal (R$/mês)",
    type: "number",
    required: true,
    placeholder: "Ex: 50000",
  },
  {
    id: "campaign.budget.traffic",
    section: "vendas contínuas",
    label: "Budget mensal de tráfego (R$/mês)",
    type: "number",
    required: true,
    placeholder: "Ex: 10000",
  },
  {
    id: "evergreen.funnelType",
    section: "vendas contínuas",
    label: "Tipo de funil de vendas",
    type: "select",
    options: [
      { value: "direct_response", label: "Resposta direta — tráfego vai direto para a página de vendas" },
      { value: "lead_magnet", label: "Lead magnet — captura lead e nutre por email/WhatsApp" },
      { value: "quiz_funnel", label: "Funil de quiz — qualifica e personaliza a oferta" },
      { value: "free_trial", label: "Trial gratuito — deixa experimentar antes de pagar" },
      { value: "consultation", label: "Consulta gratuita — alta conversão via atendimento" },
    ],
    required: true,
    aiDecide: true,
  },
  {
    id: "evergreen.nurturingChannel",
    section: "vendas contínuas",
    label: "Canal principal de nutrição de leads",
    type: "select",
    options: [
      { value: "email", label: "E-mail marketing" },
      { value: "whatsapp", label: "WhatsApp (broadcast / grupo)" },
      { value: "telegram", label: "Canal do Telegram" },
      { value: "sms", label: "SMS" },
      { value: "hybrid", label: "Multi-canal" },
    ],
    required: true,
    aiDecide: true,
  },
  {
    id: "evergreen.cacTarget",
    section: "vendas contínuas",
    label: "CAC máximo aceitável (R$) — Custo por Aquisição",
    description: "Quanto você aceita pagar para adquirir um cliente?",
    type: "number",
    required: false,
    aiDecide: true,
    placeholder: "Ex: 200 (para produto de R$997)",
  },
  {
    id: "evergreen.ltvTarget",
    section: "vendas contínuas",
    label: "LTV estimado por cliente (R$) — Lifetime Value",
    description: "Quanto um cliente gasta com você ao longo do tempo?",
    type: "number",
    required: false,
    aiDecide: true,
    placeholder: "Ex: 2000",
  },
  {
    id: "evergreen.monthlyLeadTarget",
    section: "vendas contínuas",
    label: "Quantos leads novos por mês?",
    type: "number",
    required: false,
    aiDecide: true,
    placeholder: "Ex: 500",
  },
  {
    id: "evergreen.automationPlatform",
    section: "vendas contínuas",
    label: "Plataforma de automação",
    type: "select",
    options: [
      { value: "activecampaign", label: "ActiveCampaign" },
      { value: "klicksend", label: "Klicksend" },
      { value: "leadlovers", label: "Leadlovers" },
      { value: "rd_station", label: "RD Station" },
      { value: "convertkit", label: "ConvertKit / Kit" },
      { value: "not_decided", label: "Ainda não decidi" },
    ],
    required: false,
    aiDecide: true,
  },
  {
    id: "risk.tolerance",
    section: "risco",
    label: "Tolerância a risco",
    type: "select",
    options: [
      { value: "conservative", label: "Conservador" },
      { value: "moderate", label: "Moderado" },
      { value: "aggressive", label: "Agressivo" },
    ],
    required: true,
    aiDecide: true,
  },
];

// ─── FLASH SALE-SPECIFIC QUESTIONS ───────────────────────────────────────────

const FLASH_SALE_QUESTIONS: IntakeQuestion[] = [
  {
    id: "campaign.revenueTarget",
    section: "queima relâmpago",
    label: "Meta de faturamento da queima (R$)",
    type: "number",
    required: true,
  },
  {
    id: "campaign.budget.traffic",
    section: "queima relâmpago",
    label: "Budget de tráfego para a queima (R$)",
    type: "number",
    required: true,
  },
  {
    id: "flash.duration",
    section: "queima relâmpago",
    label: "Duração da queima (horas)",
    description: "Queimas relâmpago: 24h, 48h ou 72h. Menos tempo = mais urgência",
    type: "select",
    options: [
      { value: "24", label: "24 horas" },
      { value: "48", label: "48 horas" },
      { value: "72", label: "72 horas" },
    ],
    required: true,
  },
  {
    id: "flash.discountMechanism",
    section: "queima relâmpago",
    label: "Mecanismo de desconto / oferta especial",
    type: "select",
    options: [
      { value: "percentage_off", label: "Desconto percentual (ex: 40% off)" },
      { value: "bonus_pack", label: "Mesmo preço + bônus exclusivos" },
      { value: "bundle", label: "Bundle (produto + outros juntos)" },
      { value: "installment_deal", label: "Condição especial de parcelamento" },
      { value: "first_access", label: "Primeiro acesso / pré-venda" },
    ],
    required: true,
    aiDecide: true,
  },
  {
    id: "flash.trigger",
    section: "queima relâmpago",
    label: "Motivo / gatilho da queima",
    description: "Uma queima sempre precisa de um motivo. Sem motivo, parece desespero.",
    type: "select",
    options: [
      { value: "anniversary", label: "Aniversário (empresa, produto, pessoal)" },
      { value: "celebration", label: "Celebração de meta atingida" },
      { value: "season", label: "Data sazonal (Black Friday, Natal, etc.)" },
      { value: "stock_clearance", label: "Liberação de vagas / estoque" },
      { value: "new_version", label: "Lançamento de nova versão / atualização" },
      { value: "exclusive_event", label: "Evento / Live exclusiva" },
    ],
    required: true,
  },
  {
    id: "flash.audienceSize",
    section: "queima relâmpago",
    label: "Tamanho da lista/audiência existente",
    description: "Queimas dependem de audiência aquecida existente",
    type: "number",
    required: false,
    placeholder: "Ex: 5000 (número de emails ou seguidores)",
  },
  {
    id: "risk.tolerance",
    section: "risco",
    label: "Tolerância a risco",
    type: "select",
    options: [
      { value: "conservative", label: "Conservador" },
      { value: "moderate", label: "Moderado" },
      { value: "aggressive", label: "Agressivo" },
    ],
    required: true,
    aiDecide: true,
  },
];

// ─── LIVE SALE-SPECIFIC QUESTIONS ────────────────────────────────────────────

const LIVE_SALE_QUESTIONS: IntakeQuestion[] = [
  {
    id: "campaign.revenueTarget",
    section: "live de vendas",
    label: "Meta de faturamento da live (R$)",
    type: "number",
    required: true,
  },
  {
    id: "live.platform",
    section: "live de vendas",
    label: "Plataforma da live",
    type: "select",
    options: [
      { value: "instagram", label: "Instagram Live" },
      { value: "youtube", label: "YouTube Live" },
      { value: "tiktok", label: "TikTok Live" },
      { value: "zoom_webinar", label: "Zoom / Webinário" },
      { value: "multi", label: "Multi-plataforma simultânea" },
    ],
    required: true,
  },
  {
    id: "live.duration",
    section: "live de vendas",
    label: "Duração estimada da live (horas)",
    type: "select",
    options: [
      { value: "1", label: "1 hora" },
      { value: "2", label: "2 horas" },
      { value: "3", label: "3 horas" },
      { value: "4_plus", label: "4+ horas (live longa)" },
    ],
    required: true,
    aiDecide: true,
  },
  {
    id: "live.exclusiveOffer",
    section: "live de vendas",
    label: "Oferta exclusiva da live",
    description: "O que é EXCLUSIVO para quem está na live? Sem exclusividade, sem urgência.",
    type: "textarea",
    required: true,
    placeholder: "Ex: Preço especial + 3 bônus + acesso a grupo exclusivo só para quem comprar durante a live",
  },
  {
    id: "live.entertainmentElement",
    section: "live de vendas",
    label: "Elemento de entretenimento / engajamento",
    type: "textarea",
    required: false,
    aiDecide: true,
    placeholder: "Ex: sorteios, quiz ao vivo, desafio, convidado especial...",
  },
  {
    id: "risk.tolerance",
    section: "risco",
    label: "Tolerância a risco",
    type: "select",
    options: [
      { value: "conservative", label: "Conservador" },
      { value: "moderate", label: "Moderado" },
      { value: "aggressive", label: "Agressivo" },
    ],
    required: true,
    aiDecide: true,
  },
];

// ─── REMARKETING-SPECIFIC QUESTIONS ──────────────────────────────────────────

const REMARKETING_QUESTIONS: IntakeQuestion[] = [
  {
    id: "remarketing.audienceType",
    section: "remarketing",
    label: "Tipo de audiência para remarketing",
    type: "select",
    options: [
      { value: "cold_leads", label: "Leads frios — entraram na lista mas nunca compraram" },
      { value: "cart_abandonment", label: "Abandono de carrinho — chegaram ao checkout" },
      { value: "past_buyers", label: "Compradores anteriores — upsell/cross-sell" },
      { value: "inactive_subscribers", label: "Assinantes inativos — reativação" },
      { value: "event_attendees", label: "Participantes de evento anterior" },
    ],
    required: true,
  },
  {
    id: "remarketing.audienceSize",
    section: "remarketing",
    label: "Tamanho da audiência de remarketing",
    type: "number",
    required: true,
    placeholder: "Ex: 3000",
  },
  {
    id: "remarketing.timeSinceLastContact",
    section: "remarketing",
    label: "Há quanto tempo sem contato?",
    type: "select",
    options: [
      { value: "1_30_days", label: "1-30 dias" },
      { value: "31_90_days", label: "31-90 dias" },
      { value: "91_180_days", label: "3-6 meses" },
      { value: "180_plus_days", label: "Mais de 6 meses" },
    ],
    required: true,
  },
  {
    id: "remarketing.offerAngle",
    section: "remarketing",
    label: "Novo ângulo de oferta para remarketing",
    description: "Não repita o que não funcionou. Qual ângulo diferente vai usar?",
    type: "textarea",
    required: true,
    placeholder: "Ex: desconto de reativação, bônus que não foram oferecidos antes, nova prova social...",
  },
  {
    id: "campaign.budget.total",
    section: "remarketing",
    label: "Budget total para remarketing (R$)",
    type: "number",
    required: true,
  },
  {
    id: "risk.tolerance",
    section: "risco",
    label: "Tolerância a risco",
    type: "select",
    options: [
      { value: "conservative", label: "Conservador" },
      { value: "moderate", label: "Moderado" },
      { value: "aggressive", label: "Agressivo" },
    ],
    required: true,
  },
];

// ─── UPSELL-SPECIFIC QUESTIONS ────────────────────────────────────────────────

const UPSELL_QUESTIONS: IntakeQuestion[] = [
  {
    id: "upsell.triggerProduct",
    section: "upsell",
    label: "Qual produto o cliente comprou para chegar aqui?",
    type: "textarea",
    required: true,
    placeholder: "Nome e preço do produto de entrada",
  },
  {
    id: "upsell.offerType",
    section: "upsell",
    label: "Tipo de oferta de upsell",
    type: "select",
    options: [
      { value: "order_bump", label: "Order Bump — oferecido no checkout" },
      { value: "one_time_offer", label: "OTO — oferecido logo após a compra" },
      { value: "upsell_page", label: "Página de upsell pós-compra" },
      { value: "email_sequence", label: "Sequência de e-mails pós-compra" },
      { value: "upgrade", label: "Upgrade de plano / tier" },
    ],
    required: true,
    aiDecide: true,
  },
  {
    id: "product.price",
    section: "upsell",
    label: "Preço do upsell (R$)",
    type: "number",
    required: true,
  },
  {
    id: "upsell.complementarity",
    section: "upsell",
    label: "Como este upsell complementa o produto que o cliente já comprou?",
    type: "textarea",
    required: true,
    placeholder: "O cliente comprou X. Este upsell entrega Y que resolve Z que X não resolve...",
  },
  {
    id: "upsell.buyerAudienceSize",
    section: "upsell",
    label: "Quantos clientes podem receber esta oferta?",
    type: "number",
    required: true,
    placeholder: "Ex: 500",
  },
];

// ─── QUESTION BUILDER ─────────────────────────────────────────────────────────

export function getIntakeQuestions(
  type: CampaignType,
  track: CampaignTrack = "six_digits",
): IntakeQuestion[] {
  const base = [
    ...BASE_PRODUCT_QUESTIONS,
    ...BASE_AUDIENCE_QUESTIONS,
    ...BASE_CREATOR_QUESTIONS,
    ...BASE_CONTENT_QUESTIONS,
  ];

  switch (type) {
    case "launch": {
      const q = [...base, ...LAUNCH_QUESTIONS];
      if (track === "eight_digits" || track === "ten_digits") {
        q.push(...LAUNCH_8_DIGIT_EXTRA);
      }
      return q;
    }
    case "perpetual_launch":
      return [...base, ...PERPETUAL_LAUNCH_QUESTIONS];

    case "flash_sale":
      return [...base, ...FLASH_SALE_QUESTIONS];

    case "live_sale":
      return [...base, ...LIVE_SALE_QUESTIONS];

    case "continuous_sales":
    case "subscription_growth":
      return [...base, ...CONTINUOUS_SALES_QUESTIONS];

    case "upsell":
      return [...BASE_CREATOR_QUESTIONS, ...BASE_CONTENT_QUESTIONS, ...UPSELL_QUESTIONS];

    case "remarketing":
      return [...BASE_PRODUCT_QUESTIONS, ...REMARKETING_QUESTIONS];

    default:
      // authority, audience_growth, branding, creator_monetization, affiliate, scale, regional_dominance
      return [
        ...base,
        ...BASE_RISK_QUESTIONS,
        {
          id: "campaign.revenueTarget",
          section: "campanha",
          label: "Meta de resultado da campanha (R$)",
          type: "number" as const,
          required: true,
          placeholder: "Ex: 50000",
        },
        {
          id: "campaign.budget.total",
          section: "campanha",
          label: "Budget total disponível (R$)",
          type: "number" as const,
          required: true,
          placeholder: "Ex: 15000",
        },
      ];
  }
}

export async function saveIntakeData(
  campaignId: string,
  workspaceId: string,
  intakeData: Record<string, unknown>,
  log: Logger,
): Promise<Campaign> {
  const [campaign] = await db
    .select()
    .from(campaignsTable)
    .where(
      and(
        eq(campaignsTable.id, campaignId),
        eq(campaignsTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (!campaign) throw new NotFoundError("Campaign");

  const EDITABLE_STATUSES = ["intake", "analyzing", "strategy_ready"];
  if (!EDITABLE_STATUSES.includes(campaign.status ?? "")) {
    throw new ValidationError(
      `Cannot update intake when campaign status is '${campaign.status}'`,
    );
  }

  // If editing after strategy was generated, reset back to intake so strategy is regenerated
  const resetStatus = campaign.status !== "intake" ? "intake" : undefined;

  const [updated] = await db
    .update(campaignsTable)
    .set({ intakeData, ...(resetStatus ? { status: resetStatus, updatedAt: new Date() } : {}) })
    .where(eq(campaignsTable.id, campaignId))
    .returning();

  await db.insert(auditLogsTable).values({
    workspaceId,
    campaignId,
    action: "campaign.intake.saved",
    actor: "user",
    data: { fieldsCount: Object.keys(intakeData).length },
  });

  log.info({ campaignId, fieldsCount: Object.keys(intakeData).length }, "Intake saved");
  return updated;
}

export function validateIntakeCompleteness(
  type: CampaignType,
  track: CampaignTrack,
  intakeData: Record<string, unknown>,
): { valid: boolean; missingRequired: string[] } {
  const questions = getIntakeQuestions(type, track);
  const required = questions.filter((q) => q.required);
  const missingRequired = required
    .filter((q) => {
      const value = intakeData[q.id];
      return value === undefined || value === null || value === "";
    })
    .map((q) => q.id);

  return { valid: missingRequired.length === 0, missingRequired };
}
