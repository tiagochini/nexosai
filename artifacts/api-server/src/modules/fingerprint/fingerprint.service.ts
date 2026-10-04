import { db, masterprintDownloadsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger.js";

export interface RegisterFingerprintInput {
  fingerprint: string;
  userId: string;
  userEmail: string;
  userName: string;
  workspaceId: string;
  workspaceName: string;
  campaignId: string;
  campaignTitle?: string;
  track?: string;
  ipAddress?: string;
  userAgent?: string;
}

export async function registerFingerprint(input: RegisterFingerprintInput): Promise<void> {
  try {
    await db.insert(masterprintDownloadsTable).values({
      fingerprint: input.fingerprint,
      userId: input.userId,
      userEmail: input.userEmail,
      userName: input.userName,
      workspaceId: input.workspaceId,
      workspaceName: input.workspaceName,
      campaignId: input.campaignId,
      campaignTitle: input.campaignTitle ?? null,
      track: input.track ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    }).onConflictDoNothing();
  } catch (err) {
    logger.warn({ err }, "Failed to register fingerprint");
  }
}

export async function lookupFingerprint(code: string) {
  const rows = await db
    .select()
    .from(masterprintDownloadsTable)
    .where(eq(masterprintDownloadsTable.fingerprint, code))
    .limit(1);
  return rows[0] ?? null;
}

export async function listRecentDownloads(limit = 50) {
  return db
    .select()
    .from(masterprintDownloadsTable)
    .orderBy(masterprintDownloadsTable.generatedAt)
    .limit(limit);
}
