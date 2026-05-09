import { eq, and } from "drizzle-orm";
import {
  db,
  campaignsTable,
  auditLogsTable,
  type Campaign,
} from "@workspace/db";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import type { Logger } from "pino";

export interface IntakeQuestion {
  id: string;
  section: string;
  label: string;
  description?: string;
  type: "text" | "textarea" | "select" | "multiselect" | "number" | "boolean";
  options?: { value: string; label: string }[];
  required: boolean;
  aiDecide?: boolean;
  tracks?: ("six_digits" | "eight_digits" | "ten_digits")[];
  placeholder?: string;
}

const PRODUCT_QUESTIONS: IntakeQuestion[] = [
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
    label: "Qual é sua prova social? (resultados de alunos, depoimentos, números)",
    description: "Seja honesto. A IA só trabalha com prova real.",
    type: "textarea",
    required: false,
    aiDecide: false,
    placeholder: "Ex: 2.300 alunos, taxa de conclusão 78%, 40 casos documentados de resultado...",
  },
];

const AUDIENCE_QUESTIONS: IntakeQuestion[] = [
  {
    id: "audience.description",
    section: "audiência",
    label: "Descreva seu avatar ideal",
    description: "Quem é a pessoa que mais se beneficia do seu produto?",
    type: "textarea",
    required: true,
    placeholder: "Ex: Mulher 35-45 anos, profissional liberal, renda R$8k-R$15k, sonha em ter negócio próprio...",
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
    placeholder: "O que ele realmente quer alcançar? Não só o que ele acha que quer...",
  },
  {
    id: "audience.sophisticationLevel",
    section: "audiência",
    label: "Nível de consciência da audiência",
    description: "O quanto eles já sabem sobre o problema e a solução?",
    type: "select",
    options: [
      { value: "unaware", label: "Inconsciente — não sabe que tem o problema" },
      { value: "problem_aware", label: "Consciente do problema — sabe que tem o problema mas não conhece soluções" },
      { value: "solution_aware", label: "Consciente da solução — sabe que existem soluções mas não conhece você" },
      { value: "product_aware", label: "Consciente do produto — já te conhece mas ainda não comprou" },
      { value: "most_aware", label: "Mais consciente — já comprou de você antes" },
    ],
    required: true,
    aiDecide: true,
  },
  {
    id: "audience.location",
    section: "audiência",
    label: "Localização geográfica da audiência",
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
];

const CREATOR_QUESTIONS: IntakeQuestion[] = [
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
    description: "O que te faz diferente de todos os outros no mercado?",
    type: "textarea",
    required: true,
    aiDecide: true,
    placeholder: "Ex: Único método que combina psicologia comportamental com automação...",
  },
];

const CAMPAIGN_QUESTIONS: IntakeQuestion[] = [
  {
    id: "campaign.revenueTarget",
    section: "campanha",
    label: "Meta de faturamento da campanha (R$)",
    type: "number",
    required: true,
    placeholder: "Ex: 300000",
  },
  {
    id: "campaign.budget.total",
    section: "campanha",
    label: "Budget total disponível (R$)",
    type: "number",
    required: true,
    placeholder: "Ex: 30000",
  },
  {
    id: "campaign.budget.traffic",
    section: "campanha",
    label: "Budget para tráfego pago (R$)",
    description: "Deixe 0 se for lançamento orgânico",
    type: "number",
    required: false,
    aiDecide: true,
    placeholder: "Ex: 20000",
  },
  {
    id: "campaign.salesChannel",
    section: "campanha",
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
    id: "campaign.hasAffiliate",
    section: "campanha",
    label: "Vai ativar programa de afiliados?",
    type: "boolean",
    required: true,
  },
  {
    id: "campaign.affiliateCommission",
    section: "campanha",
    label: "Comissão de afiliados (%)",
    type: "number",
    required: false,
    placeholder: "Ex: 30",
  },
];

const CONTENT_QUESTIONS: IntakeQuestion[] = [
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
    placeholder: "Ex: não mencionar concorrentes, evitar promessas de ficou rico rápido...",
  },
];

const RISK_QUESTIONS: IntakeQuestion[] = [
  {
    id: "risk.tolerance",
    section: "risco",
    label: "Tolerância a risco na campanha",
    type: "select",
    options: [
      { value: "conservative", label: "Conservador — prefiro crescimento seguro e previsível" },
      { value: "moderate", label: "Moderado — aceito arriscar parte do budget por maior resultado" },
      { value: "aggressive", label: "Agressivo — all-in, quero resultado máximo" },
    ],
    required: true,
    aiDecide: true,
  },
  {
    id: "risk.previousLaunches",
    section: "risco",
    label: "Já fez lançamentos antes? Qual foi o resultado?",
    type: "textarea",
    required: false,
    placeholder: "Ex: Fiz 3 lançamentos, o maior foi R$150k, o menor R$40k...",
  },
];

const EIGHT_DIGIT_EXTRA: IntakeQuestion[] = [
  {
    id: "scale.partnerStrategy",
    section: "escala",
    label: "Estratégia de parceiros / co-produtores",
    type: "textarea",
    required: false,
    aiDecide: true,
    tracks: ["eight_digits", "ten_digits"],
    placeholder: "Tem parceiros, influenciadores ou co-produtores envolvidos?",
  },
  {
    id: "scale.affiliateStructure",
    section: "escala",
    label: "Estrutura de afiliados para escala",
    description: "Para lançamentos de 8 dígitos, afiliados são essenciais",
    type: "textarea",
    required: true,
    aiDecide: true,
    tracks: ["eight_digits", "ten_digits"],
    placeholder: "Quantos afiliados, quais perfis, qual a estratégia de ativação...",
  },
  {
    id: "scale.channelDiversification",
    section: "escala",
    label: "Canais de distribuição para escala",
    type: "multiselect",
    options: [
      { value: "meta_ads", label: "Meta Ads (Facebook + Instagram)" },
      { value: "google_ads", label: "Google Ads / YouTube" },
      { value: "tiktok_ads", label: "TikTok Ads" },
      { value: "influencer", label: "Marketing de influência" },
      { value: "email", label: "E-mail marketing" },
      { value: "affiliate_network", label: "Rede de afiliados (Hotmart/Kiwify)" },
      { value: "podcast", label: "Podcast / Áudio" },
    ],
    required: true,
    aiDecide: true,
    tracks: ["eight_digits", "ten_digits"],
  },
];

const TEN_DIGIT_EXTRA: IntakeQuestion[] = [
  {
    id: "enterprise.internationalExpansion",
    section: "enterprise",
    label: "Plano de expansão internacional",
    type: "textarea",
    required: false,
    aiDecide: true,
    tracks: ["ten_digits"],
    placeholder: "Quais países, em qual idioma, qual a estratégia de localização...",
  },
  {
    id: "enterprise.brandPartnerships",
    section: "enterprise",
    label: "Parcerias com marcas / patrocínios",
    type: "textarea",
    required: false,
    tracks: ["ten_digits"],
    placeholder: "Marcas parceiras, patrocinadores, co-branding...",
  },
];

export function getIntakeQuestions(
  track: "six_digits" | "eight_digits" | "ten_digits",
): IntakeQuestion[] {
  const base = [
    ...PRODUCT_QUESTIONS,
    ...AUDIENCE_QUESTIONS,
    ...CREATOR_QUESTIONS,
    ...CAMPAIGN_QUESTIONS,
    ...CONTENT_QUESTIONS,
    ...RISK_QUESTIONS,
  ];

  if (track === "eight_digits" || track === "ten_digits") {
    base.push(...EIGHT_DIGIT_EXTRA);
  }
  if (track === "ten_digits") {
    base.push(...TEN_DIGIT_EXTRA);
  }

  return base.filter((q) => !q.tracks || q.tracks.includes(track));
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

  if (campaign.status !== "intake") {
    throw new ValidationError(
      `Cannot update intake when campaign status is '${campaign.status}'`,
    );
  }

  const [updated] = await db
    .update(campaignsTable)
    .set({ intakeData })
    .where(eq(campaignsTable.id, campaignId))
    .returning();

  await db.insert(auditLogsTable).values({
    workspaceId,
    campaignId,
    action: "campaign.intake.saved",
    actor: "user",
    data: { fieldsCount: Object.keys(intakeData).length },
  });

  log.info({ campaignId, fieldsCount: Object.keys(intakeData).length }, "Intake data saved");
  return updated;
}

export function validateIntakeCompleteness(
  track: "six_digits" | "eight_digits" | "ten_digits",
  intakeData: Record<string, unknown>,
): { valid: boolean; missingRequired: string[] } {
  const questions = getIntakeQuestions(track);
  const required = questions.filter((q) => q.required);
  const missingRequired = required
    .filter((q) => {
      const value = intakeData[q.id];
      return value === undefined || value === null || value === "";
    })
    .map((q) => q.id);

  return { valid: missingRequired.length === 0, missingRequired };
}
