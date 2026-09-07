import { eq, sql } from "drizzle-orm";
import { db, waitlistTable } from "@workspace/db";

export const LAUNCH_CAPACITY = 100;
export const LAUNCH_SOURCE = "landing-plf";

export type LaunchReservationResult = {
  duplicate: boolean;
  segment: string;
  /** Whether this WhatsApp number currently holds a launch reservation. */
  launchReserved: boolean;
};

/** The marker is deliberately composable so prior campaign attribution is retained. */
export function isLaunchSource(source: string | null | undefined): boolean {
  return source?.includes(LAUNCH_SOURCE) ?? false;
}

export function appendLaunchSource(source: string | null | undefined): string {
  if (isLaunchSource(source)) return source!;
  return source ? `${source},${LAUNCH_SOURCE}` : LAUNCH_SOURCE;
}

export function decideLaunchReservation(input: {
  existingLaunchReservation: boolean;
  capacityReached: boolean;
  existingWaitlistEntry: boolean;
}): "duplicate" | "capacity_reached" | "upgrade" | "reserve" {
  if (input.existingLaunchReservation) return "duplicate";
  if (input.capacityReached) return "capacity_reached";
  return input.existingWaitlistEntry ? "upgrade" : "reserve";
}

/**
 * The sole database path which assigns one of the pre-launch seats. The
 * advisory lock covers both the count and the insert/upgrade across workers.
 */
export async function reserveLaunchSeat(input: {
  name: string;
  whatsapp: string;
  email?: string;
  segment: string;
  source?: string;
}): Promise<LaunchReservationResult | null> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${LAUNCH_SOURCE}))`);
    const [existing] = await tx
      .select({ id: waitlistTable.id, segment: waitlistTable.segment, source: waitlistTable.source })
      .from(waitlistTable)
      .where(eq(waitlistTable.whatsapp, input.whatsapp))
      .limit(1);

    const [countRow] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(waitlistTable)
      .where(sql`${waitlistTable.source} LIKE ${`%${LAUNCH_SOURCE}%`}`);

    const decision = decideLaunchReservation({
      existingLaunchReservation: isLaunchSource(existing?.source),
      capacityReached: (countRow?.count ?? 0) >= LAUNCH_CAPACITY,
      existingWaitlistEntry: Boolean(existing),
    });

    if (decision === "capacity_reached") return null;
    if (decision === "duplicate") {
      return { duplicate: true, segment: existing!.segment, launchReserved: true };
    }
    if (decision === "upgrade") {
      await tx.update(waitlistTable)
        .set({ source: appendLaunchSource(existing!.source) })
        .where(eq(waitlistTable.id, existing!.id));
      return { duplicate: false, segment: existing!.segment, launchReserved: true };
    }

    await tx.insert(waitlistTable).values({
      name: input.name,
      whatsapp: input.whatsapp,
      email: input.email ?? null,
      segment: input.segment,
      source: appendLaunchSource(input.source),
    });
    return { duplicate: false, segment: input.segment, launchReserved: true };
  });
}