import crypto from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  pagesTable,
  landingRevisionsTable,
  landingDeploymentsTable,
  auditLogsTable,
  campaignsTable,
  domainsTable,
  launchSequencesTable,
  paidMediaDatasetsTable,
  contentPiecesTable,
} from "@workspace/db";
import { AppError, NotFoundError } from "../../lib/errors.js";
import {
  materializeLandingHtml,
  validateLandingImplementation,
  validateLandingSource,
  type LandingSource,
  type LandingImplementation,
} from "./landing-publication.service.js";
import { getApprovedMasterplan } from "../masterplan/masterplan.service.js";
import { assertLandingAdTracking } from "./landing-tracking.service.js";

const hash = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
type Snapshot = {
  version: 1;
  baseHash: string;
  source: LandingSource;
  implementation: LandingImplementation;
  sequenceId?: string;
  setup: unknown;
};
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
function conflict(message: string): never {
  throw new AppError(409, message, "LANDING_REVISION_STALE");
}
export function assertRevisionSnapshot(
  liveHtml: string | null,
  revision: { html: string; contentHash: string },
  snapshot: { baseHash: string },
  approvedHash: string,
) {
  if (
    revision.contentHash !== approvedHash ||
    hash(revision.html) !== approvedHash ||
    snapshot.baseHash !== hash(liveHtml ?? "")
  )
    conflict(
      "A página ou a revisão mudou. Gere e confira uma nova prévia antes de publicar.",
    );
}
async function validateSnapshot(
  tx: Tx,
  workspaceId: string,
  page: typeof pagesTable.$inferSelect,
  snapshot: Snapshot,
) {
  if (!page.campaignId || !page.domainId || page.status !== "published")
    conflict(
      "A página precisa estar publicada e vinculada a campanha e domínio.",
    );
  const [domain] = await tx
    .select()
    .from(domainsTable)
    .where(
      and(
        eq(domainsTable.id, page.domainId),
        eq(domainsTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (
    !domain?.dnsVerified ||
    new URL(page.publishedUrl!).hostname !== domain.domain
  )
    conflict("Verifique o domínio da página antes de publicar a revisão.");
  validateLandingImplementation(snapshot.implementation, snapshot.sequenceId);
  const errors = validateLandingSource(snapshot.source);
  if (errors.length)
    throw new AppError(
      422,
      "Revise a estrutura da landing antes de gerar a prévia.",
      "LANDING_VALIDATION_FAILED",
      errors,
    );
  if (snapshot.sequenceId) {
    const [sequence] = await tx
      .select()
      .from(launchSequencesTable)
      .where(
        and(
          eq(launchSequencesTable.id, snapshot.sequenceId),
          eq(launchSequencesTable.workspaceId, workspaceId),
          eq(launchSequencesTable.campaignId, page.campaignId),
        ),
      )
      .limit(1);
    if (
      !sequence?.leadCaptureEnabled ||
      !["active", "scheduled"].includes(sequence.status)
    )
      conflict("A captura precisa estar habilitada e ativa ou agendada.");
  }
  const tracking = snapshot.implementation.tracking;
  if (tracking.metaDatasetId) {
    const [dataset] = await tx
      .select()
      .from(paidMediaDatasetsTable)
      .where(
        and(
          eq(paidMediaDatasetsTable.id, tracking.metaDatasetId),
          eq(paidMediaDatasetsTable.workspaceId, workspaceId),
          eq(paidMediaDatasetsTable.provider, "meta_ads"),
        ),
      )
      .limit(1);
    if (!dataset || dataset.providerDatasetId !== tracking.metaPixelId)
      conflict("O dataset Meta mudou. Gere uma nova revisão.");
  }
  const approvedPieces = await tx
    .select({ content: contentPiecesTable.content })
    .from(contentPiecesTable)
    .where(
      and(
        eq(contentPiecesTable.workspaceId, workspaceId),
        eq(contentPiecesTable.campaignId, page.campaignId),
        eq(contentPiecesTable.type, "landing_page_structure"),
        eq(contentPiecesTable.status, "approved"),
      ),
    );
  if (
    !approvedPieces.some(
      (piece) => canonical(piece.content) === canonical(snapshot.source),
    )
  )
    conflict("A estrutura da landing precisa continuar aprovada.");
  // Current ad contract is checked again at the explicit publication boundary.
  const masterplan = await getApprovedMasterplan(
    workspaceId,
    page.campaignId,
    tx,
  );
  assertLandingAdTracking(masterplan?.snapshot, domain.domain, tracking);
}

export async function prepareLandingUpgrade(
  workspaceId: string,
  campaignId: string,
  input: {
    source: LandingSource;
    implementation: LandingImplementation;
    sequenceId?: string;
    setup: unknown;
  },
  actor: string,
) {
  return db.transaction(async (tx) => {
    const [campaign] = await tx
      .select()
      .from(campaignsTable)
      .where(
        and(
          eq(campaignsTable.id, campaignId),
          eq(campaignsTable.workspaceId, workspaceId),
        ),
      )
      .for("update");
    if (!campaign) throw new NotFoundError("Campanha");
    if (canonical(campaign.landingSetupData) !== canonical(input.setup))
      conflict("O plano mudou. Recarregue antes de gerar a revisão.");
    const [page] = await tx
      .select()
      .from(pagesTable)
      .where(
        and(
          eq(pagesTable.campaignId, campaignId),
          eq(pagesTable.workspaceId, workspaceId),
          eq(pagesTable.status, "published"),
        ),
      )
      .orderBy(desc(pagesTable.publishedAt))
      .limit(1)
      .for("update");
    if (!page) throw new NotFoundError("Landing publicada");
    const setup = input.setup as { desiredDomain?: string };
    if (setup.desiredDomain !== new URL(page.publishedUrl!).hostname)
      conflict(
        "A revisão preserva o domínio publicado. Use o domínio atual no plano.",
      );
    const implementation = {
      ...input.implementation,
      tracking: {
        ...input.implementation.tracking,
        pageId: page.id,
        ...(input.implementation.tracking.metaDatasetId &&
        input.implementation.tracking.metaPixelId
          ? { metaEventKey: crypto.randomBytes(32).toString("hex") }
          : {}),
      },
    };
    const snapshot: Snapshot = {
      version: 1,
      baseHash: hash(page.html ?? ""),
      source: input.source,
      implementation,
      sequenceId: input.sequenceId,
      setup: input.setup,
    };
    await validateSnapshot(tx, workspaceId, page, snapshot);
    const [last] = await tx
      .select({ revision: landingRevisionsTable.revision })
      .from(landingRevisionsTable)
      .where(eq(landingRevisionsTable.pageId, page.id))
      .orderBy(desc(landingRevisionsTable.revision))
      .limit(1);
    const html = materializeLandingHtml(
      input.source,
      implementation,
      input.sequenceId,
    );
    const [revision] = await tx
      .insert(landingRevisionsTable)
      .values({
        workspaceId,
        pageId: page.id,
        revision: (last?.revision ?? 0) + 1,
        source: snapshot,
        html,
        contentHash: hash(html),
        status: "validated",
      })
      .returning();
    await tx
      .insert(auditLogsTable)
      .values({
        workspaceId,
        campaignId,
        action: "landing.upgrade.prepared",
        actor,
        data: {
          pageId: page.id,
          revisionId: revision!.id,
          contentHash: revision!.contentHash,
        },
      });
    return {
      pageId: page.id,
      revisionId: revision!.id,
      revision: revision!.revision,
      contentHash: revision!.contentHash,
      html,
      status: "preview",
      url: page.publishedUrl,
    };
  });
}

export async function publishLandingUpgrade(
  workspaceId: string,
  campaignId: string,
  input: { revisionId: string; contentHash: string },
  actor: string,
) {
  return db.transaction(async (tx) => {
    const [campaign] = await tx
      .select()
      .from(campaignsTable)
      .where(
        and(
          eq(campaignsTable.id, campaignId),
          eq(campaignsTable.workspaceId, workspaceId),
        ),
      )
      .for("update");
    if (!campaign) throw new NotFoundError("Campanha");
    const [revision] = await tx
      .select()
      .from(landingRevisionsTable)
      .where(
        and(
          eq(landingRevisionsTable.id, input.revisionId),
          eq(landingRevisionsTable.workspaceId, workspaceId),
        ),
      )
      .limit(1);
    if (!revision) throw new NotFoundError("Revisão");
    const [page] = await tx
      .select()
      .from(pagesTable)
      .where(
        and(
          eq(pagesTable.id, revision.pageId),
          eq(pagesTable.workspaceId, workspaceId),
          eq(pagesTable.campaignId, campaignId),
        ),
      )
      .for("update");
    if (!page) throw new NotFoundError("Landing");
    if (
      revision.status === "published" &&
      revision.contentHash === input.contentHash
    )
      return {
        url: page.publishedUrl,
        pageId: page.id,
        revisionId: revision.id,
        status: "published",
      };
    const snapshot = revision.source as Snapshot;
    if (revision.status !== "validated" || snapshot.version !== 1)
      conflict("Esta revisão não está disponível para aprovação/publicação.");
    assertRevisionSnapshot(page.html, revision, snapshot, input.contentHash);
    if (canonical(campaign.landingSetupData) !== canonical(snapshot.setup))
      conflict("O plano mudou desde a prévia. Gere uma nova revisão.");
    const scheduledAt = (snapshot.setup as { scheduledAt?: string })
      .scheduledAt;
    if (
      !scheduledAt ||
      !Number.isFinite(Date.parse(scheduledAt)) ||
      Date.parse(scheduledAt) > Date.now()
    )
      conflict("A revisão ainda não chegou à data planejada.");
    await validateSnapshot(tx, workspaceId, page, snapshot);
    await tx
      .update(landingRevisionsTable)
      .set({ status: "superseded" })
      .where(
        and(
          eq(landingRevisionsTable.pageId, page.id),
          eq(landingRevisionsTable.status, "published"),
        ),
      );
    await tx
      .update(landingRevisionsTable)
      .set({ status: "published" })
      .where(eq(landingRevisionsTable.id, revision.id));
    await tx
      .update(pagesTable)
      .set({
        html: revision.html,
        metadata: {
          ...(page.metadata as Record<string, unknown>),
          implementation: snapshot.implementation,
        },
        leadCaptureSequenceId: snapshot.sequenceId ?? null,
        publishedAt: new Date(),
      })
      .where(eq(pagesTable.id, page.id));
    await tx
      .update(campaignsTable)
      .set({
        landingSetupData: {
          ...(snapshot.setup as Record<string, unknown>),
          status: "published",
          pageId: page.id,
          publishedAt: new Date().toISOString(),
        },
      })
      .where(eq(campaignsTable.id, campaignId));
    await tx
      .insert(landingDeploymentsTable)
      .values({
        workspaceId,
        pageId: page.id,
        revisionId: revision.id,
        domainId: page.domainId,
        idempotencyKey: `landing-upgrade:${revision.id}`,
        provider: "nexos-app",
        status: "deployed",
        deploymentUrl: page.publishedUrl,
        completedAt: new Date(),
      });
    await tx
      .insert(auditLogsTable)
      .values({
        workspaceId,
        campaignId,
        action: "landing.upgrade.approved_and_published",
        actor,
        data: {
          pageId: page.id,
          revisionId: revision.id,
          contentHash: input.contentHash,
        },
      });
    return {
      url: page.publishedUrl,
      pageId: page.id,
      revisionId: revision.id,
      status: "published",
    };
  });
}
