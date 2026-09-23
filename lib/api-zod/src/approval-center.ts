import { z } from "zod";

export const ApprovalDecisionResponseSchema = z.object({
  decision: z.object({
    id: z.string().uuid(),
    subjectType: z.enum(["masterplan", "content_piece", "checkpoint"]),
    subjectId: z.string(),
    decision: z.enum(["approved", "rejected", "revision_requested"]),
    actorUserId: z.string().uuid(),
    decidedAt: z.coerce.date(),
    reason: z.string().nullable(),
    subjectVersion: z.number().nullable(),
    expectedSnapshotHash: z.string(),
    resolvedSnapshotHash: z.string(),
    contextFingerprint: z.string().nullable(),
  }),
});