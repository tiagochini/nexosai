import { and, eq } from "drizzle-orm";
import { db, sequenceContactsTable, sequenceEngagementTable } from "@workspace/db";
import type { JourneyStage } from "./first-touch-policy.js";

const order: JourneyStage[] = ["awareness", "consideration", "qualification", "objection_handling", "closing", "converted"];

/** Transactional seam for specialized sales agents; stages only move forward. */
export async function advanceJourneyStage(input: {
  workspaceId: string; contactId: string; stage: JourneyStage; evidence?: Record<string, unknown>;
}): Promise<boolean> {
  return db.transaction(async (tx) => {
    if (!input.evidence?.source || !input.evidence?.externalRef) throw new Error("journey evidence requires source and externalRef");
    const [contact] = await tx.select().from(sequenceContactsTable).where(and(
      eq(sequenceContactsTable.id, input.contactId), eq(sequenceContactsTable.workspaceId, input.workspaceId),
    )).limit(1);
    if (!contact) throw new Error("contact not found in workspace");
    const current = contact.journeyStage as JourneyStage;
    if (contact.segment === "unsubscribed" || current === "converted" || order.indexOf(input.stage) <= order.indexOf(current)) return false;
    if (input.stage === "converted") {
      if (input.evidence.type !== "conversion" || !input.evidence.verified) throw new Error("verified conversion evidence required");
    } else if (order.indexOf(input.stage) !== order.indexOf(current) + 1) return false;
    const [advanced] = await tx.update(sequenceContactsTable).set(input.stage === "converted"
      ? { journeyStage: "converted", segment: "converted" } : { journeyStage: input.stage })
      .where(and(eq(sequenceContactsTable.id, input.contactId), eq(sequenceContactsTable.workspaceId, input.workspaceId), eq(sequenceContactsTable.journeyStage, current)))
      .returning({ id: sequenceContactsTable.id });
    if (!advanced) return false;
    await tx.insert(sequenceEngagementTable).values({
      sequenceId: contact.sequenceId, contactId: contact.id, workspaceId: input.workspaceId,
      event: "reply", metadata: { journeyStageAdvance: true, from: current, to: input.stage, evidence: input.evidence ?? {} },
    });
    return true;
  });
}