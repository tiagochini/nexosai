export const CERTIFICATION_DIMENSIONS = [
  "material_execution",
  "deterministic_executor",
  "independent_provider_evidence",
  "tenant_isolation_idempotency",
  "failure_injection_recovery",
  "approved_master_plan_binding",
] as const;

export type CertificationDimension = typeof CERTIFICATION_DIMENSIONS[number];
export type CapabilityBaseline = "PARTIAL" | "BLOCKED";

export interface CapabilityDefinition {
  key: string;
  name: string;
  baseline: CapabilityBaseline;
  requiredDimensions: readonly CertificationDimension[];
  subjectTypes: readonly string[];
}

const all = [...CERTIFICATION_DIMENSIONS] as readonly CertificationDimension[];
const definition = (key: string, name: string, baseline: CapabilityBaseline = "PARTIAL", subjectTypes: readonly string[] = []): CapabilityDefinition => ({
  key, name, baseline, requiredDimensions: all, subjectTypes,
});

/** The order and wording mirror the canonical GLP22 matrix. */
export const CAPABILITY_REGISTRY: readonly CapabilityDefinition[] = [
  definition("intake", "Imersão e intake"),
  definition("market_intelligence", "Inteligência e análise de mercado"),
  definition("avatar_segmentation_journey", "Avatar, segmentação e jornada"),
  definition("positioning_mechanism_narrative", "Posicionamento, mecanismo e narrativa"),
  definition("offer_engineering", "Engenharia da oferta"),
  definition("strategic_launch_architecture", "Arquitetura estratégica do lançamento"),
  definition("master_plan", "Master Plan"),
  definition("funnel_building", "Construção do funil"),
  definition("copy", "Copy"),
  definition("creative_direction_visual_production", "Direção criativa e produção visual"),
  definition("video_production", "Direção e produção de vídeos", "BLOCKED"),
  definition("pages_digital_assets", "Páginas e ativos digitais"),
  definition("infrastructure_tracking_integrations", "Infraestrutura, tracking e integrações"),
  definition("crm_leads_groups_communities", "CRM, gestão de leads, grupos e comunidades"),
  definition("digital_presence_audience", "Presença Digital e audiência"),
  definition("email_messaging_nurture", "E-mail, mensagens e nutrição"),
  definition("paid_media", "Mídia paga", "BLOCKED", ["paid_media_attempt", "paid_media_launch_plan"]),
  definition("coordinated_launch_execution", "Execução coordenada do lançamento"),
  definition("sales_conversion_support", "Atendimento, vendas e conversão"),
  definition("monitoring_optimization", "Monitoramento e otimização"),
  definition("post_launch_learning", "Pós-lançamento e aprendizado"),
  definition("continuity_relaunch_perpetual", "Continuidade, relançamento e perpétuo"),
];

export const CAPABILITIES_BY_KEY = new Map(CAPABILITY_REGISTRY.map((capability) => [capability.key, capability]));