import { and, eq, inArray } from "drizzle-orm";
import { db, executionEvidenceTable, masterplanVersionsTable } from "@workspace/db";
import { CAPABILITIES_BY_KEY, CAPABILITY_REGISTRY, CERTIFICATION_DIMENSIONS, type CapabilityDefinition, type CertificationDimension } from "./capability-registry.js";

type Json = Record<string, unknown>;
export type CertificationEvidence = {
  workspaceId?: string; subjectType?: string; state?: string; masterplanVersionId?: string | null; contextFingerprint?: string | null;
  details?: unknown;
  contentHash?: string | null;
};

const obj = (v: unknown): Json => v && typeof v === "object" && !Array.isArray(v) ? v as Json : {};
const truth = (v: unknown) => v === true || v === "true";
function hasAny(value: Json, keys: string[]): boolean { return keys.some((key) => truth(value[key])); }
function realDetails(row: CertificationEvidence): Json {
  const d = obj(row.details);
  // Fixtures, mocks, local runs and dry-runs are never certification evidence.
  if (hasAny(d, ["mock", "fixture", "test", "simulated", "simulation", "local", "dryRun", "dry_run"])) return {};
  const environment = String(obj(d["certification"])["environment"] ?? "").toLowerCase();
  if (["test", "local", "mock", "fixture", "simulation", "dry_run"].includes(environment)) return {};
  return d;
}

function dimensionsFor(definition: CapabilityDefinition, evidence: CertificationEvidence[]): Set<CertificationDimension> {
  const complete = new Set<CertificationDimension>();
  for (const row of evidence) {
    if (row.state !== "provider_confirmed" || !definition.subjectTypes.includes(String(row.subjectType))) continue;
    const d = realDetails(row);
    const receipt = d.receipt ?? d.providerReceipt ?? d.providerRequestId;
    const readback = d.readback ?? d.verification ?? d.providerReadback;
    // Legacy rows may contribute only when an actual provider receipt/readback exists.
    const providerProof = receipt != null && readback != null;
    if (!providerProof) continue;
    complete.add("material_execution");
    complete.add("independent_provider_evidence");

    // Legacy rows stop at execution and provider proof. Promotion beyond that
    // requires an internal executor-issued, independently verified envelope.
    const certification = obj(d["certification"]);
    const dimensions = Array.isArray(certification["dimensions"]) ? certification["dimensions"] : [];
    const structuredProof =
      certification["capabilityKey"] === definition.key
      && certification["source"] === "trusted_paid_media_executor"
      && (certification["environment"] === "production" || certification["environment"] === "provider_sandbox")
      && certification["independentlyVerified"] === true;
    if (!structuredProof) continue;

    if (dimensions.includes("deterministic_executor") && certification["deterministicExecutorVerified"] === true) {
      complete.add("deterministic_executor");
    }
    if (
      dimensions.includes("tenant_isolation_idempotency")
      && Boolean(row.workspaceId)
      && certification["tenantIsolationVerified"] === true
      && certification["idempotencyVerified"] === true
    ) complete.add("tenant_isolation_idempotency");
    if (
      dimensions.includes("failure_injection_recovery")
      && certification["failureInjected"] === true
      && certification["recoveryVerified"] === true
    ) complete.add("failure_injection_recovery");
    if (
      dimensions.includes("approved_master_plan_binding")
      && Boolean(row.masterplanVersionId)
      && Boolean(row.contextFingerprint)
      && typeof certification["masterPlanContentHash"] === "string"
      && certification["masterPlanContentHash"] === row.contentHash
    ) complete.add("approved_master_plan_binding");
  }
  return complete;
}

/**
 * Internal-only, fail-closed evaluator. Never expose this result as
 * customer-facing readiness, authorization, delivery or certification copy.
 */
export function evaluateCapabilityCertification(definition: CapabilityDefinition, evidence: readonly CertificationEvidence[]) {
  const verified = dimensionsFor(definition, evidence as CertificationEvidence[]);
  const missingDimensions = CERTIFICATION_DIMENSIONS.filter((dimension) => !verified.has(dimension));
  return {
    key: definition.key,
    name: definition.name,
    baseline: definition.baseline,
    declared: true,
    implemented: definition.baseline === "PARTIAL",
    available: evidence.some((row) => definition.subjectTypes.includes(String(row.subjectType)) && row.state === "provider_confirmed" && Object.keys(realDetails(row)).length > 0),
    verified: missingDimensions.length === 0,
    health: missingDimensions.length === 0 ? "HEALTHY" as const : definition.baseline,
    verifiedDimensions: [...verified],
    missingDimensions,
  };
}

export async function getCapabilityCertification(workspaceId: string, capabilityKey: string) {
  const definition = CAPABILITIES_BY_KEY.get(capabilityKey);
  if (!definition) return undefined;
  const evidence = definition.subjectTypes.length
    ? await db.select({
      workspaceId: executionEvidenceTable.workspaceId, subjectType: executionEvidenceTable.subjectType,
      state: executionEvidenceTable.state, masterplanVersionId: executionEvidenceTable.masterplanVersionId,
      contextFingerprint: executionEvidenceTable.contextFingerprint,
       contentHash: masterplanVersionsTable.contentHash,
      details: executionEvidenceTable.details,
     }).from(executionEvidenceTable)
       .leftJoin(masterplanVersionsTable, eq(executionEvidenceTable.masterplanVersionId, masterplanVersionsTable.id))
       .where(and(eq(executionEvidenceTable.workspaceId, workspaceId), inArray(executionEvidenceTable.subjectType, [...definition.subjectTypes])))
    : [];
  return evaluateCapabilityCertification(definition, evidence);
}

export async function listCapabilityCertifications(workspaceId: string) {
  return Promise.all(CAPABILITY_REGISTRY.map((definition) => getCapabilityCertification(workspaceId, definition.key)));
}