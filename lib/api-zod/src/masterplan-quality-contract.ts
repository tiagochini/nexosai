export type MasterplanQualityField = {
  path: string;
  label: string;
  kind: "text" | "list" | "number";
};

/** Required strategy fields outside the campaign architecture and quality sections. */
export const REQUIRED_CAMPAIGN_CORE_FIELDS: MasterplanQualityField[] = [
  { path: "executiveSummary", label: "Resumo executivo", kind: "text" },
  { path: "bigDomino", label: "Big Domino", kind: "text" },
  { path: "marketDiagnosis.marketMaturity", label: "Maturidade do mercado", kind: "text" },
  { path: "marketDiagnosis.competitiveLandscape", label: "Cenário competitivo", kind: "text" },
  { path: "marketDiagnosis.entryBarriers", label: "Barreiras de entrada", kind: "list" },
  { path: "marketDiagnosis.opportunities", label: "Oportunidades", kind: "list" },
  { path: "marketDiagnosis.threats", label: "Ameaças", kind: "list" },
  { path: "offerPositioning.uniqueValueProposition", label: "Proposta de valor", kind: "text" },
  { path: "offerPositioning.primaryDifferentiator", label: "Diferencial principal", kind: "text" },
  { path: "offerPositioning.positioning", label: "Posicionamento", kind: "text" },
  { path: "offerPositioning.priceJustification", label: "Justificativa de preço", kind: "text" },
  { path: "offerPositioning.competitiveAdvantages", label: "Vantagens competitivas", kind: "list" },
  { path: "audienceSegmentation.primaryAvatar", label: "Avatar principal", kind: "text" },
  { path: "audienceSegmentation.psychographicProfile", label: "Perfil psicográfico", kind: "text" },
  { path: "audienceSegmentation.buyingTriggers", label: "Gatilhos de compra", kind: "list" },
  { path: "audienceSegmentation.objections", label: "Objeções", kind: "list" },
  { path: "audienceSegmentation.sophisticationStrategy", label: "Estratégia de sofisticação", kind: "text" },
  { path: "strategistNotes", label: "Observações do estrategista", kind: "text" },
];

/** Required evidence for the performance and risk sections of a usable master plan. */
export const REQUIRED_MASTERPLAN_QUALITY_FIELDS: MasterplanQualityField[] = [
  { path: "successMetrics.primaryKPI", label: "KPI principal", kind: "text" },
  { path: "successMetrics.revenueTarget", label: "Meta de receita", kind: "number" },
  { path: "successMetrics.conversionRateTarget", label: "Meta de conversão", kind: "number" },
  { path: "successMetrics.conversionRateDefinition", label: "Etapa e base da taxa de conversão", kind: "text" },
  { path: "successMetrics.launchWindow", label: "Janela da campanha", kind: "text" },
  { path: "successMetrics.criticalAssumptions", label: "Premissas críticas", kind: "list" },
  { path: "risks.level", label: "Nível de risco", kind: "text" },
  { path: "risks.mainRisks", label: "Riscos principais", kind: "list" },
  { path: "risks.mitigations", label: "Mitigações", kind: "list" },
];

export const REQUIRED_CAMPAIGN_ARCHITECTURE_FIELDS: MasterplanQualityField[] = [
  { path: "campaignArchitecture.coreNarrative", label: "Narrativa central", kind: "text" },
  { path: "campaignArchitecture.emotionalHook", label: "Gancho emocional", kind: "text" },
  { path: "campaignArchitecture.keyMessages", label: "Mensagens-chave", kind: "list" },
  { path: "campaignArchitecture.contentPillars", label: "Pilares de conteúdo", kind: "list" },
  { path: "campaignArchitecture.platformDistributionStrategy", label: "Distribuição por plataforma", kind: "text" },
  { path: "campaignArchitecture.callToActionStrategy", label: "Estratégia de chamada para ação", kind: "text" },
];

type JsonObject = Record<string, unknown>;
const object = (value: unknown): JsonObject => value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};

function getPath(source: JsonObject, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => object(value)[key], source);
}

function isComplete(value: unknown, kind: MasterplanQualityField["kind"]): boolean {
  if (kind === "list") return Array.isArray(value) && value.some((item) => isCompleteText(item));
  if (kind === "number") return typeof value === "number" && Number.isFinite(value) && value > 0;
  return isCompleteText(value);
}

function isCompleteText(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const text = value.trim();
  if (text.length < 3 || /[([{,;:/—-]\s*$/.test(text)) return false;
  if (/\b(?:and|or|e|ou|de|do|da|dos|das|para|com|que|em|por|sobre)\s*$/i.test(text)) return false;
  const pairs: Array<[string, string]> = [["(", ")"], ["[", "]"], ["{", "}"]];
  return pairs.every(([open, close]) => text.split(open).length <= text.split(close).length);
}

export function missingMasterplanQualityFields(strategyValue: unknown): MasterplanQualityField[] {
  const strategy = object(strategyValue);
  return REQUIRED_MASTERPLAN_QUALITY_FIELDS.filter((field) => !isComplete(getPath(strategy, field.path), field.kind));
}

export function missingCampaignCoreFields(strategyValue: unknown): MasterplanQualityField[] {
  const strategy = object(strategyValue);
  return REQUIRED_CAMPAIGN_CORE_FIELDS.filter((field) => !isComplete(getPath(strategy, field.path), field.kind));
}

function setPath(target: JsonObject, path: string, value: unknown): void {
  const keys = path.split(".");
  let current = target;
  for (const key of keys.slice(0, -1)) {
    const child = object(current[key]);
    current[key] = child;
    current = child;
  }
  current[keys[keys.length - 1]!] = value;
}

/** Merge only complete values for requested missing fields; preserve existing decisions. */
export function fillMissingMasterplanQualityFields(
  currentValue: unknown,
  proposedValue: unknown,
  fields: MasterplanQualityField[],
): JsonObject {
  const current = JSON.parse(JSON.stringify(object(currentValue))) as JsonObject;
  const proposed = object(proposedValue);
  for (const field of fields) {
    const value = getPath(proposed, field.path);
    if (isComplete(value, field.kind)) setPath(current, field.path, value);
  }
  return current;
}

export function missingCampaignArchitectureFields(strategyValue: unknown): MasterplanQualityField[] {
  const strategy = object(strategyValue);
  return REQUIRED_CAMPAIGN_ARCHITECTURE_FIELDS.filter((field) => !isComplete(getPath(strategy, field.path), field.kind));
}

/** Fill only absent or visibly truncated M06 values; retain existing approved content. */
export function fillMissingCampaignArchitectureFields(
  currentValue: unknown,
  proposedValue: unknown,
  fields: MasterplanQualityField[],
): JsonObject {
  const current = JSON.parse(JSON.stringify(object(currentValue))) as JsonObject;
  const proposed = object(proposedValue);
  for (const field of fields) {
    const value = getPath(proposed, field.path);
    if (isComplete(value, field.kind)) setPath(current, field.path, value);
  }
  return current;
}

/** Fill only missing or invalid core strategy values, preserving all other data. */
export function fillMissingCampaignCoreFields(
  currentValue: unknown,
  proposedValue: unknown,
  fields: MasterplanQualityField[],
): JsonObject {
  const current = JSON.parse(JSON.stringify(object(currentValue))) as JsonObject;
  const proposed = object(proposedValue);
  for (const field of fields) {
    const value = getPath(proposed, field.path);
    if (isComplete(value, field.kind)) setPath(current, field.path, value);
  }
  return current;
}
