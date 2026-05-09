import { eq, and, desc, sql } from "drizzle-orm";
import {
  db,
  agencyClientsTable,
  workspacesTable,
  plansTable,
  campaignsTable,
  type AgencyClient,
  type AgencyPermissions,
  type AgencyClientStatus,
  DEFAULT_AGENCY_PERMISSIONS,
} from "@workspace/db";
import { AppError, NotFoundError, UnauthorizedError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import crypto from "crypto";

// ─── Plan guard ───────────────────────────────────────────────────────────────

export async function requireAgencyPlan(workspaceId: string): Promise<void> {
  const [row] = await db
    .select({ slug: plansTable.slug })
    .from(workspacesTable)
    .innerJoin(plansTable, eq(workspacesTable.planId, plansTable.id))
    .where(eq(workspacesTable.id, workspaceId))
    .limit(1);

  if (!row || row.slug !== "agency") {
    throw new AppError(
      403,
      "Funcionalidade exclusiva do Plano Agency",
      "PLAN_UPGRADE_REQUIRED"
    );
  }
}

// ─── Invite client ────────────────────────────────────────────────────────────

export async function inviteClient(
  agencyWorkspaceId: string,
  opts: {
    clientEmail: string;
    clientName?: string;
    permissions?: Partial<AgencyPermissions>;
    notes?: string;
  }
): Promise<AgencyClient & { inviteUrl: string }> {
  await requireAgencyPlan(agencyWorkspaceId);

  // Check if already invited
  const [existing] = await db
    .select()
    .from(agencyClientsTable)
    .where(
      and(
        eq(agencyClientsTable.agencyWorkspaceId, agencyWorkspaceId),
        eq(agencyClientsTable.clientEmail, opts.clientEmail)
      )
    )
    .limit(1);

  if (existing && existing.status === "active") {
    throw new AppError(409, "Cliente já está ativo nesta agência", "ALREADY_ACTIVE");
  }

  const inviteToken = crypto.randomBytes(32).toString("hex");
  const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const permissions: AgencyPermissions = {
    ...DEFAULT_AGENCY_PERMISSIONS,
    ...opts.permissions,
  };

  let client: AgencyClient;

  if (existing) {
    // Re-invite (update existing record)
    const [updated] = await db
      .update(agencyClientsTable)
      .set({
        status: "pending",
        inviteToken,
        inviteExpiresAt,
        permissions,
        clientName: opts.clientName ?? existing.clientName,
        notes: opts.notes ?? existing.notes,
        updatedAt: new Date(),
      })
      .where(eq(agencyClientsTable.id, existing.id))
      .returning();
    client = updated!;
  } else {
    const [created] = await db
      .insert(agencyClientsTable)
      .values({
        agencyWorkspaceId,
        clientEmail: opts.clientEmail,
        clientName: opts.clientName ?? null,
        status: "pending",
        inviteToken,
        inviteExpiresAt,
        permissions,
        notes: opts.notes ?? null,
        metadata: {},
      })
      .returning();
    client = created!;
  }

  const appUrl = process.env["APP_URL"] ?? "";
  const inviteUrl = `${appUrl}/api/agency/accept?token=${inviteToken}`;

  logger.info(
    { agencyWorkspaceId, clientEmail: opts.clientEmail },
    "Agency client invited"
  );

  return { ...client, inviteUrl };
}

// ─── Accept invite ────────────────────────────────────────────────────────────

export async function acceptInvite(
  token: string,
  clientWorkspaceId: string
): Promise<AgencyClient> {
  const [invite] = await db
    .select()
    .from(agencyClientsTable)
    .where(
      and(
        eq(agencyClientsTable.inviteToken, token),
        eq(agencyClientsTable.status, "pending")
      )
    )
    .limit(1);

  if (!invite) {
    throw new NotFoundError("Convite não encontrado ou já utilizado");
  }

  if (invite.inviteExpiresAt && invite.inviteExpiresAt < new Date()) {
    throw new AppError(410, "Convite expirado", "INVITE_EXPIRED");
  }

  const [updated] = await db
    .update(agencyClientsTable)
    .set({
      status: "active",
      clientWorkspaceId,
      inviteToken: null,
      inviteExpiresAt: null,
      acceptedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(agencyClientsTable.id, invite.id))
    .returning();

  logger.info(
    { agencyWorkspaceId: invite.agencyWorkspaceId, clientWorkspaceId },
    "Agency invite accepted"
  );

  return updated!;
}

// ─── List clients ─────────────────────────────────────────────────────────────

export async function listClients(
  agencyWorkspaceId: string,
  opts: { status?: AgencyClientStatus; limit?: number; offset?: number } = {}
): Promise<Array<AgencyClient & { workspace?: { name: string; slug: string; activeCampaigns: number } }>> {
  await requireAgencyPlan(agencyWorkspaceId);

  const rows = await db
    .select({
      client: agencyClientsTable,
      workspaceName: workspacesTable.name,
      workspaceSlug: workspacesTable.slug,
      activeCampaigns: workspacesTable.activeCampaigns,
    })
    .from(agencyClientsTable)
    .leftJoin(
      workspacesTable,
      eq(agencyClientsTable.clientWorkspaceId, workspacesTable.id)
    )
    .where(eq(agencyClientsTable.agencyWorkspaceId, agencyWorkspaceId))
    .orderBy(desc(agencyClientsTable.createdAt))
    .limit(opts.limit ?? 50)
    .offset(opts.offset ?? 0);

  return rows.map((r) => ({
    ...r.client,
    workspace: r.workspaceName
      ? {
          name: r.workspaceName,
          slug: r.workspaceSlug!,
          activeCampaigns: r.activeCampaigns ?? 0,
        }
      : undefined,
  }));
}

export async function getClient(
  agencyWorkspaceId: string,
  clientId: string
): Promise<AgencyClient> {
  await requireAgencyPlan(agencyWorkspaceId);

  const [client] = await db
    .select()
    .from(agencyClientsTable)
    .where(
      and(
        eq(agencyClientsTable.id, clientId),
        eq(agencyClientsTable.agencyWorkspaceId, agencyWorkspaceId)
      )
    )
    .limit(1);

  if (!client) throw new NotFoundError("Cliente não encontrado");
  return client;
}

export async function updateClient(
  agencyWorkspaceId: string,
  clientId: string,
  data: Partial<{
    status: AgencyClientStatus;
    permissions: Partial<AgencyPermissions>;
    clientName: string;
    notes: string;
  }>
): Promise<AgencyClient> {
  const existing = await getClient(agencyWorkspaceId, clientId);

  const updates: Partial<typeof existing> & { updatedAt: Date } = {
    updatedAt: new Date(),
  };

  if (data.status) updates.status = data.status;
  if (data.clientName) updates.clientName = data.clientName;
  if (data.notes !== undefined) updates.notes = data.notes;
  if (data.permissions) {
    updates.permissions = {
      ...(existing.permissions as AgencyPermissions),
      ...data.permissions,
    };
  }

  const [updated] = await db
    .update(agencyClientsTable)
    .set(updates)
    .where(eq(agencyClientsTable.id, clientId))
    .returning();

  return updated!;
}

export async function revokeClient(
  agencyWorkspaceId: string,
  clientId: string
): Promise<void> {
  const client = await getClient(agencyWorkspaceId, clientId);

  await db
    .update(agencyClientsTable)
    .set({
      status: "revoked",
      clientWorkspaceId: null,
      inviteToken: null,
      updatedAt: new Date(),
    })
    .where(eq(agencyClientsTable.id, client.id));
}

// ─── Client campaigns (agency view) ──────────────────────────────────────────

export async function getClientCampaigns(
  agencyWorkspaceId: string,
  clientId: string
) {
  const client = await getClient(agencyWorkspaceId, clientId);

  if (!client.clientWorkspaceId) {
    return { campaigns: [] };
  }

  const perms = client.permissions as AgencyPermissions;
  if (!perms.canViewCampaigns) {
    throw new UnauthorizedError("Sem permissão para ver campanhas deste cliente");
  }

  const campaigns = await db
    .select()
    .from(campaignsTable)
    .where(eq(campaignsTable.workspaceId, client.clientWorkspaceId))
    .orderBy(desc(campaignsTable.createdAt))
    .limit(20);

  return { campaigns };
}

// ─── Agency aggregate stats ───────────────────────────────────────────────────

export async function getAgencyStats(agencyWorkspaceId: string) {
  await requireAgencyPlan(agencyWorkspaceId);

  const clients = await db
    .select({
      clientId: agencyClientsTable.id,
      clientWorkspaceId: agencyClientsTable.clientWorkspaceId,
      clientName: agencyClientsTable.clientName,
      clientEmail: agencyClientsTable.clientEmail,
      status: agencyClientsTable.status,
    })
    .from(agencyClientsTable)
    .where(
      and(
        eq(agencyClientsTable.agencyWorkspaceId, agencyWorkspaceId),
        eq(agencyClientsTable.status, "active")
      )
    );

  const clientWorkspaceIds = clients
    .map((c) => c.clientWorkspaceId)
    .filter(Boolean) as string[];

  let totalCampaigns = 0;
  let totalActiveCampaigns = 0;

  if (clientWorkspaceIds.length > 0) {
    const campaignCounts = await db
      .select({
        workspaceId: campaignsTable.workspaceId,
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${campaignsTable.status} in ('live','executing','generating','analyzing'))::int`,
      })
      .from(campaignsTable)
      .where(
        sql`${campaignsTable.workspaceId} = any(${sql.raw(`ARRAY[${clientWorkspaceIds.map((id) => `'${id}'`).join(",")}]::uuid[]`)})`
      )
      .groupBy(campaignsTable.workspaceId);

    for (const row of campaignCounts) {
      totalCampaigns += row.total;
      totalActiveCampaigns += row.active;
    }
  }

  return {
    totalClients: clients.length,
    activeClients: clients.filter((c) => c.status === "active").length,
    pendingClients: clients.filter((c) => c.status === "pending").length,
    totalCampaigns,
    totalActiveCampaigns,
    clients: clients.map((c) => ({
      id: c.clientId,
      name: c.clientName ?? c.clientEmail,
      email: c.clientEmail,
      status: c.status,
      workspaceId: c.clientWorkspaceId,
    })),
  };
}
