import { eq, and } from "drizzle-orm";
import dns from "dns/promises";
import {
  db,
  whitelabelConfigsTable,
  workspacesTable,
  plansTable,
  domainsTable,
  type WhitelabelConfig,
  type WhiteLabelTheme,
  DEFAULT_THEME,
} from "@workspace/db";
import { AppError, NotFoundError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { env } from "../../lib/env.js";
import crypto from "crypto";

// ─── Plan guard ───────────────────────────────────────────────────────────────

async function requireAgencyPlan(workspaceId: string): Promise<void> {
  const [row] = await db
    .select({ slug: plansTable.slug })
    .from(workspacesTable)
    .innerJoin(plansTable, eq(workspacesTable.planId, plansTable.id))
    .where(eq(workspacesTable.id, workspaceId))
    .limit(1);

  if (!row || row.slug !== "agency") {
    throw new AppError(
      403,
      "White-label é exclusivo do Plano Agency",
      "PLAN_UPGRADE_REQUIRED"
    );
  }
}

// ─── Get or create config ─────────────────────────────────────────────────────

export async function getWhitelabelConfig(
  workspaceId: string
): Promise<WhitelabelConfig | null> {
  const [config] = await db
    .select()
    .from(whitelabelConfigsTable)
    .where(eq(whitelabelConfigsTable.workspaceId, workspaceId))
    .limit(1);

  return config ?? null;
}

export async function getWhitelabelConfigByDomain(
  domain: string
): Promise<WhitelabelConfig | null> {
  const [config] = await db
    .select()
    .from(whitelabelConfigsTable)
    .where(
      and(
        eq(whitelabelConfigsTable.customDomain, domain),
        eq(whitelabelConfigsTable.domainVerified, true),
        eq(whitelabelConfigsTable.isActive, true)
      )
    )
    .limit(1);

  return config ?? null;
}

export async function upsertWhitelabelConfig(
  workspaceId: string,
  data: {
    brandName?: string;
    tagline?: string;
    logoUrl?: string;
    faviconUrl?: string;
    loginBgUrl?: string;
    theme?: Partial<WhiteLabelTheme>;
    customCss?: string;
    customDomain?: string;
    supportEmail?: string;
    supportUrl?: string;
    termsUrl?: string;
    privacyUrl?: string;
    metaTitle?: string;
    metaDescription?: string;
  }
): Promise<WhitelabelConfig> {
  await requireAgencyPlan(workspaceId);

  const existing = await getWhitelabelConfig(workspaceId);

  if (existing) {
    const mergedTheme: WhiteLabelTheme = {
      ...(existing.theme as WhiteLabelTheme),
      ...data.theme,
    };

    // If domain changed, reset verification
    const domainChanged =
      data.customDomain !== undefined &&
      data.customDomain !== existing.customDomain;

    const [updated] = await db
      .update(whitelabelConfigsTable)
      .set({
        brandName: data.brandName ?? existing.brandName,
        tagline: data.tagline ?? existing.tagline,
        logoUrl: data.logoUrl ?? existing.logoUrl,
        faviconUrl: data.faviconUrl ?? existing.faviconUrl,
        loginBgUrl: data.loginBgUrl ?? existing.loginBgUrl,
        theme: mergedTheme,
        customCss: data.customCss ?? existing.customCss,
        customDomain: data.customDomain ?? existing.customDomain,
        domainVerified: domainChanged ? false : existing.domainVerified,
        domainVerifyToken: domainChanged
          ? crypto.randomBytes(16).toString("hex")
          : existing.domainVerifyToken,
        supportEmail: data.supportEmail ?? existing.supportEmail,
        supportUrl: data.supportUrl ?? existing.supportUrl,
        termsUrl: data.termsUrl ?? existing.termsUrl,
        privacyUrl: data.privacyUrl ?? existing.privacyUrl,
        metaTitle: data.metaTitle ?? existing.metaTitle,
        metaDescription: data.metaDescription ?? existing.metaDescription,
        updatedAt: new Date(),
      })
      .where(eq(whitelabelConfigsTable.id, existing.id))
      .returning();

    return updated!;
  }

  // Create new config
  const workspace = await db
    .select({ name: workspacesTable.name })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId))
    .limit(1);

  const defaultBrandName =
    data.brandName ?? workspace[0]?.name ?? "Minha Plataforma";

  const [created] = await db
    .insert(whitelabelConfigsTable)
    .values({
      workspaceId,
      brandName: defaultBrandName,
      tagline: data.tagline ?? null,
      logoUrl: data.logoUrl ?? null,
      faviconUrl: data.faviconUrl ?? null,
      loginBgUrl: data.loginBgUrl ?? null,
      theme: { ...DEFAULT_THEME, ...data.theme },
      customCss: data.customCss ?? null,
      customDomain: data.customDomain ?? null,
      domainVerified: false,
      domainVerifyToken: data.customDomain
        ? crypto.randomBytes(16).toString("hex")
        : null,
      supportEmail: data.supportEmail ?? null,
      supportUrl: data.supportUrl ?? null,
      termsUrl: data.termsUrl ?? null,
      privacyUrl: data.privacyUrl ?? null,
      metaTitle: data.metaTitle ?? null,
      metaDescription: data.metaDescription ?? null,
      isActive: true,
    })
    .returning();

  if (!created) throw new AppError(500, "Falha ao criar configuração white-label", "DB_ERROR");

  logger.info({ workspaceId }, "White-label config created");
  return created;
}

// ─── Domain verification ──────────────────────────────────────────────────────

export async function initiateDomainVerification(
  workspaceId: string,
  domain: string
): Promise<{ verifyToken: string; dnsRecord: { type: string; name: string; value: string } }> {
  await requireAgencyPlan(workspaceId);

  const config = await getWhitelabelConfig(workspaceId);
  if (!config) {
    throw new NotFoundError("Configure o white-label antes de verificar um domínio");
  }

  const verifyToken = config.domainVerifyToken ?? crypto.randomBytes(16).toString("hex");

  // Keep the legacy white-label configuration and the domain lifecycle model
  // bound to the same tenant. This is intentionally not a DNS mutation.
  const [existingDomain] = await db
    .select()
    .from(domainsTable)
    .where(eq(domainsTable.domain, domain))
    .limit(1);
  if (existingDomain && existingDomain.workspaceId !== workspaceId) {
    throw new AppError(409, "Domínio já pertence a outro workspace", "DOMAIN_OWNERSHIP_CONFLICT");
  }
  if (!existingDomain) {
    await db.insert(domainsTable).values({
      workspaceId,
      domain,
      type: "custom",
      lifecycleStatus: "active",
    });
  }

  await db
    .update(whitelabelConfigsTable)
    .set({
      customDomain: domain,
      domainVerified: false,
      domainVerifyToken: verifyToken,
      updatedAt: new Date(),
    })
    .where(eq(whitelabelConfigsTable.workspaceId, workspaceId));

  const nexosDomain = env.NEXOS_BASE_DOMAIN;

  return {
    verifyToken,
    dnsRecord: {
      type: "CNAME",
      name: domain,
      value: `proxy.${nexosDomain}`,
    },
  };
}

export async function verifyDomain(workspaceId: string): Promise<{
  verified: boolean;
  domain: string | null;
  error?: string;
}> {
  await requireAgencyPlan(workspaceId);

  const config = await getWhitelabelConfig(workspaceId);
  if (!config?.customDomain) {
    throw new AppError(400, "Nenhum domínio configurado para verificar", "NO_DOMAIN");
  }

  if (config.domainVerified) {
    return { verified: true, domain: config.customDomain };
  }

  try {
    const nexosDomain = env.NEXOS_BASE_DOMAIN;
    const expectedCname = `proxy.${nexosDomain}`;

    const addresses = await dns.resolveCname(config.customDomain).catch(() => []);

    const isVerified = addresses.some(
      (addr) =>
        addr === expectedCname ||
        addr.endsWith(`.${nexosDomain}`) ||
        addr.includes("replit")
    );

    if (isVerified) {
      await db
        .update(whitelabelConfigsTable)
        .set({ domainVerified: true, updatedAt: new Date() })
        .where(eq(whitelabelConfigsTable.workspaceId, workspaceId));

      // Also update the workspace's customDomain field
      await db
        .update(workspacesTable)
        .set({ customDomain: config.customDomain })
        .where(eq(workspacesTable.id, workspaceId));

      await db
        .update(domainsTable)
        .set({ dnsVerified: true, sslStatus: "pending" })
        .where(and(eq(domainsTable.workspaceId, workspaceId), eq(domainsTable.domain, config.customDomain)));

      logger.info({ workspaceId, domain: config.customDomain }, "Domain verified");
    }

    return {
      verified: isVerified,
      domain: config.customDomain,
      error: isVerified
        ? undefined
        : `CNAME não aponta para ${expectedCname}. Encontrado: ${addresses[0] ?? "nenhum"}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      verified: false,
      domain: config.customDomain,
      error: `Erro ao verificar DNS: ${msg}`,
    };
  }
}

export async function removeDomain(workspaceId: string): Promise<void> {
  await requireAgencyPlan(workspaceId);

  await db
    .update(whitelabelConfigsTable)
    .set({
      customDomain: null,
      domainVerified: false,
      domainVerifyToken: null,
      updatedAt: new Date(),
    })
    .where(eq(whitelabelConfigsTable.workspaceId, workspaceId));

  await db
    .update(workspacesTable)
    .set({ customDomain: null })
    .where(eq(workspacesTable.id, workspaceId));
}

// ─── Public brand resolution (used by frontend) ───────────────────────────────

export async function resolveBrandByDomain(host: string): Promise<{
  branded: boolean;
  config: Pick<
    WhitelabelConfig,
    | "brandName"
    | "tagline"
    | "logoUrl"
    | "faviconUrl"
    | "loginBgUrl"
    | "theme"
    | "customCss"
    | "supportEmail"
    | "supportUrl"
    | "metaTitle"
    | "metaDescription"
  > | null;
}> {
  const config = await getWhitelabelConfigByDomain(host);
  if (!config) return { branded: false, config: null };

  return {
    branded: true,
    config: {
      brandName: config.brandName,
      tagline: config.tagline,
      logoUrl: config.logoUrl,
      faviconUrl: config.faviconUrl,
      loginBgUrl: config.loginBgUrl,
      theme: config.theme,
      customCss: config.customCss,
      supportEmail: config.supportEmail,
      supportUrl: config.supportUrl,
      metaTitle: config.metaTitle,
      metaDescription: config.metaDescription,
    },
  };
}
