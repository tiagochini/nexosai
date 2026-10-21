import { and, eq } from "drizzle-orm";
import {
  db,
  campaignGroupsTable,
  campaignsTable,
  workspaceIntegrationsTable,
} from "@workspace/db";
import { AppError, NotFoundError, ValidationError } from "../../lib/errors.js";
import { metaGraphFetch } from "../../lib/meta-graph.transport.js";
import { metaGraphUrl } from "../../lib/meta-graph.constants.js";

type MetaErrorBody = {
  error?: { message?: string; type?: string; code?: number; error_subcode?: number };
};

async function getConnectedWhatsApp(workspaceId: string) {
  const [integration] = await db
    .select({
      id: workspaceIntegrationsTable.id,
      accessToken: workspaceIntegrationsTable.accessToken,
      phoneNumberId: workspaceIntegrationsTable.accountId,
      displayPhoneNumber: workspaceIntegrationsTable.accountName,
    })
    .from(workspaceIntegrationsTable)
    .where(and(
      eq(workspaceIntegrationsTable.workspaceId, workspaceId),
      eq(workspaceIntegrationsTable.provider, "whatsapp_business"),
      eq(workspaceIntegrationsTable.status, "connected"),
    ))
    .limit(1);

  if (!integration?.accessToken || !integration.phoneNumberId) {
    throw new ValidationError("Conecte o número WhatsApp Business deste workspace antes de usar grupos.");
  }
  return integration;
}

async function parseMetaError(response: Response): Promise<MetaErrorBody["error"]> {
  try {
    const body = await response.json() as MetaErrorBody;
    return body.error;
  } catch {
    return undefined;
  }
}

/**
 * Checks whether Meta exposes read access to the Groups API for this exact
 * connected phone. Listing groups is read-only. Creation permission is
 * definitively tested only when an explicit create request is made.
 */
export async function checkWhatsAppGroupsEligibility(workspaceId: string) {
  const integration = await getConnectedWhatsApp(workspaceId);
  const response = await metaGraphFetch(metaGraphUrl(`${integration.phoneNumberId}/groups`), {
    method: "GET",
    headers: { Authorization: `Bearer ${integration.accessToken}` },
  });

  if (!response.ok) {
    const error = await parseMetaError(response);
    return {
      connected: true,
      groupsApiReadAccess: false,
      status: "unavailable" as const,
      phoneNumber: integration.displayPhoneNumber,
      code: error?.code ?? null,
      reason: "A Meta não liberou a leitura de grupos para este número. Verifique elegibilidade OBA, permissões e acesso à Groups API no app Meta.",
    };
  }

  const body = await response.json() as { data?: unknown[] };
  return {
    connected: true,
    groupsApiReadAccess: true,
    status: "readable" as const,
    phoneNumber: integration.displayPhoneNumber,
    existingManagedGroups: Array.isArray(body.data) ? body.data.length : 0,
    reason: null,
  };
}

export async function createWhatsAppCampaignGroup(
  workspaceId: string,
  input: {
    campaignId: string;
    groupName: string;
    description?: string;
    approvalRequired?: boolean;
    segment?: string;
  },
) {
  const [campaign] = await db
    .select({ id: campaignsTable.id })
    .from(campaignsTable)
    .where(and(
      eq(campaignsTable.id, input.campaignId),
      eq(campaignsTable.workspaceId, workspaceId),
    ))
    .limit(1);
  if (!campaign) throw new NotFoundError("Campanha");

  const integration = await getConnectedWhatsApp(workspaceId);
  const response = await metaGraphFetch(metaGraphUrl(`${integration.phoneNumberId}/groups`), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${integration.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subject: input.groupName.trim(),
      ...(input.description?.trim() ? { description: input.description.trim() } : {}),
      approval_required: input.approvalRequired ?? true,
    }),
  });

  if (!response.ok) {
    const error = await parseMetaError(response);
    const code = error?.code;
    const message = code === 190
      ? "A autorização do WhatsApp expirou. Reconecte o número e tente novamente."
      : "A Meta recusou a criação do grupo. Confirme a elegibilidade OBA e as permissões da Groups API para este número.";
    throw new AppError(422, message, "WHATSAPP_GROUP_CREATE_REJECTED", {
      providerCode: code ?? null,
      providerSubcode: error?.error_subcode ?? null,
    });
  }

  const body = await response.json() as {
    id?: string;
    group_id?: string;
    invite_link?: string;
    inviteLink?: string;
    request_id?: string;
    status?: string;
  };
  const metaGroupId = body.group_id ?? body.id ?? null;
  const inviteLink = body.invite_link ?? body.inviteLink ?? null;
  const lifecycleStatus = metaGroupId ? "active" : "provisioning";

  const [group] = await db
    .insert(campaignGroupsTable)
    .values({
      campaignId: input.campaignId,
      workspaceId,
      integrationId: integration.id,
      platform: "whatsapp",
      groupName: input.groupName.trim(),
      groupLink: inviteLink,
      groupId: metaGroupId,
      description: input.description?.trim() || null,
      segment: input.segment?.trim() || null,
      memberCount: 0,
      lifecycleStatus,
      lastSyncedAt: new Date(),
      metadata: {
        provider: "meta_whatsapp_groups_api",
        requestId: body.request_id ?? null,
        providerStatus: body.status ?? null,
        approvalRequired: input.approvalRequired ?? true,
      },
    })
    .returning();

  return {
    group,
    providerAccepted: true,
    lifecycleStatus,
    note: metaGroupId
      ? null
      : "A Meta aceitou a solicitação, mas ainda não retornou o ID do grupo. Aguarde a confirmação pelo webhook antes de enviar mensagens.",
  };
}
