export type TriggerMapField = {
  path: string;
  label: string;
  kind: "text" | "list";
};

/** Shared trigger-map contract used by agent parsing, readiness, UI, and PDF. */
export const REQUIRED_TRIGGER_MAP_FIELDS: TriggerMapField[] = [
  { path: "preLaunch.triggerLogic", label: "Lógica de gatilhos do pré-lançamento", kind: "text" },
  { path: "preLaunch.triggerStack", label: "Sequência de gatilhos do pré-lançamento", kind: "list" },
  { path: "cartOpen.triggerLogic", label: "Lógica de gatilhos da abertura", kind: "text" },
  { path: "cartOpen.triggerStack", label: "Sequência de gatilhos da abertura", kind: "list" },
  { path: "cartClose.triggerLogic", label: "Lógica de gatilhos do fechamento", kind: "text" },
  { path: "cartClose.triggerStack", label: "Sequência de gatilhos do fechamento", kind: "list" },
  { path: "remarketing.triggerLogic", label: "Lógica de remarketing", kind: "text" },
  { path: "remarketing.triggerStack", label: "Sequência de remarketing", kind: "list" },
  { path: "dominantTrigger", label: "Gatilho dominante", kind: "text" },
  { path: "dominantTriggerJustification", label: "Justificativa do gatilho dominante", kind: "text" },
  { path: "triggerStackSequence", label: "Sequência geral de gatilhos", kind: "list" },
  { path: "socialProofBlueprint", label: "Plano de prova social", kind: "text" },
  { path: "antiRequisiteAngles", label: "Ângulos de objeção", kind: "list" },
  { path: "transformationBridge", label: "Ponte de transformação", kind: "text" },
];

type JsonObject = Record<string, unknown>;
const object = (value: unknown): JsonObject => value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};

function getPath(source: JsonObject, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => object(value)[key], source);
}

function isComplete(value: unknown, kind: TriggerMapField["kind"]): boolean {
  if (kind === "list") return Array.isArray(value) && value.some((item) => typeof item === "string" && item.trim().length >= 3);
  return typeof value === "string" && value.trim().length >= 3;
}

export function missingTriggerMapFields(triggerMapValue: unknown): TriggerMapField[] {
  const triggerMap = object(triggerMapValue);
  return REQUIRED_TRIGGER_MAP_FIELDS.filter((field) => !isComplete(getPath(triggerMap, field.path), field.kind));
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

/** Copies only values that were missing, preserving all existing strategy decisions. */
export function fillMissingTriggerMapFields(
  currentMapValue: unknown,
  proposedMapValue: unknown,
  fields: TriggerMapField[],
): JsonObject {
  const currentMap = JSON.parse(JSON.stringify(object(currentMapValue))) as JsonObject;
  const proposedMap = object(proposedMapValue);
  for (const field of fields) {
    const proposed = getPath(proposedMap, field.path);
    if (isComplete(proposed, field.kind)) setPath(currentMap, field.path, proposed);
  }
  return currentMap;
}
