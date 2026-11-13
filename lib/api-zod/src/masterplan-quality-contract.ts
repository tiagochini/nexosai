export type MasterplanQualityField = {
  path: string;
  label: string;
  kind: "text" | "list" | "number";
};

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

type JsonObject = Record<string, unknown>;
const object = (value: unknown): JsonObject => value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};

function getPath(source: JsonObject, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => object(value)[key], source);
}

function isComplete(value: unknown, kind: MasterplanQualityField["kind"]): boolean {
  if (kind === "list") return Array.isArray(value) && value.some((item) => typeof item === "string" && item.trim().length >= 3);
  if (kind === "number") return typeof value === "number" && Number.isFinite(value) && value > 0;
  return typeof value === "string" && value.trim().length >= 3;
}

export function missingMasterplanQualityFields(strategyValue: unknown): MasterplanQualityField[] {
  const strategy = object(strategyValue);
  return REQUIRED_MASTERPLAN_QUALITY_FIELDS.filter((field) => !isComplete(getPath(strategy, field.path), field.kind));
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
