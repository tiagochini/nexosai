import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { and, asc, eq, sql } from "drizzle-orm";
import { db, usersTable, workspacesTable, plansTable } from "@workspace/db";
import { env } from "../../lib/env.js";
import {
  UnauthorizedError,
  ConflictError,
  NotFoundError,
} from "../../lib/errors.js";
import { grantCredits } from "../credits/credits.service.js";
import type { Logger } from "pino";

function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(
    { length: 6 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");
}

const REFERRAL_BONUS_CREDITS = 50;

function isUniqueViolation(error: unknown): boolean {
  // Drizzle may expose the PostgreSQL error directly or wrap it in `cause`.
  // Walk the short cause chain so concurrent registrations consistently map
  // the database constraint violation to HTTP 409 instead of leaking a 500.
  let current: unknown = error;
  const visited = new Set<object>();
  while (typeof current === "object" && current !== null && !visited.has(current)) {
    visited.add(current);
    if ("code" in current && (current as { code?: unknown }).code === "23505") {
      return true;
    }
    current = "cause" in current ? (current as { cause?: unknown }).cause : undefined;
  }
  return false;
}

export interface TokenPayload {
  userId: string;
  workspaceId: string;
  email: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  phone?: string;
  locale?: "pt-BR" | "en-US" | "en-AU" | "es-LA";
  referralCode?: string;
  planSlug?: "solo" | "agency";
}

export interface LoginInput {
  email: string;
  password: string;
}

export function signAccess(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

function signRefresh(
  payload: Pick<TokenPayload, "userId" | "workspaceId">,
): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

export function issueTokens(
  user: { id: string; email: string },
  workspaceId: string,
): AuthTokens {
  const payload: TokenPayload = {
    userId: user.id,
    workspaceId,
    email: user.email,
  };
  return {
    accessToken: signAccess(payload),
    refreshToken: signRefresh({ userId: user.id, workspaceId }),
    expiresIn: 8 * 60 * 60,
  };
}

export async function registerUser(
  input: RegisterInput,
  log: Logger,
): Promise<AuthTokens> {
  const normalizedEmail = input.email.toLowerCase();
  const passwordHash = await bcrypt.hash(input.password, 12);

  // User and workspace are one aggregate for authentication purposes. Keeping
  // both inserts in the same transaction prevents an email from becoming
  // permanently unusable when workspace creation fails midway through signup.
  let registration: Awaited<ReturnType<typeof createRegistration>>;
  try {
    registration = await createRegistration();
  } catch (error) {
    // The pre-check gives a friendly fast path, while the unique constraint is
    // still authoritative for concurrent requests with the same email.
    if (isUniqueViolation(error)) {
      throw new ConflictError("Email already registered");
    }
    throw error;
  }
  const { user, workspace } = registration;

  async function createRegistration() {
    return db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.email, normalizedEmail))
        .limit(1);

      if (existing.length > 0) {
        throw new ConflictError("Email already registered");
      }

      const requestedSlug = input.planSlug === "agency" ? "agency" : "solo";
      const requestedPlan = await tx
        .select()
        .from(plansTable)
        .where(eq(plansTable.slug, requestedSlug))
        .limit(1);
      const selectedPlan =
        requestedPlan.length > 0
          ? requestedPlan
          : await tx
              .select()
              .from(plansTable)
              .where(eq(plansTable.slug, "solo"))
              .limit(1);

      if (selectedPlan.length === 0) {
        throw new NotFoundError("Default plan");
      }

      const [createdUser] = await tx
        .insert(usersTable)
        .values({
          email: normalizedEmail,
          passwordHash,
          name: input.name,
          phone: input.phone ?? null,
          locale: input.locale ?? "pt-BR",
        })
        .returning();

      const slug = `${input.name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;
      const myReferralCode = generateReferralCode();
      const [createdWorkspace] = await tx
        .insert(workspacesTable)
        .values({
          ownerId: createdUser.id,
          planId: selectedPlan[0].id,
          name: `${input.name}'s Workspace`,
          slug,
          creditsBalance: selectedPlan[0].creditsMonthly,
          settings: {
            referralCode: myReferralCode,
            referralCount: 0,
            ...(input.referralCode ? { referredBy: input.referralCode } : {}),
          },
        })
        .returning();

      return { user: createdUser, workspace: createdWorkspace };
    });
  }

  log.info({ userId: user.id, workspaceId: workspace.id }, "User registered");

  // Grant bonus credits to referrer (non-blocking)
  if (input.referralCode) {
    setImmediate(async () => {
      try {
        const [referrer] = await db
          .select({
            id: workspacesTable.id,
            settings: workspacesTable.settings,
          })
          .from(workspacesTable)
          .where(
            sql`${workspacesTable.settings}->>'referralCode' = ${input.referralCode}`,
          )
          .limit(1);

        if (referrer) {
          const prevSettings =
            (referrer.settings as Record<string, unknown>) ?? {};
          const prevCount =
            typeof prevSettings.referralCount === "number"
              ? prevSettings.referralCount
              : 0;
          await db
            .update(workspacesTable)
            .set({
              settings: { ...prevSettings, referralCount: prevCount + 1 },
            })
            .where(eq(workspacesTable.id, referrer.id));

          await grantCredits(
            referrer.id,
            REFERRAL_BONUS_CREDITS,
            "referral_bonus",
            log,
            `Bônus de indicação: ${input.name} se cadastrou com seu código`,
          );

          log.info(
            { referrerId: referrer.id, newUserId: user.id },
            "Referral bonus granted",
          );
        }
      } catch (err) {
        log.warn({ err }, "Failed to process referral bonus — non-blocking");
      }
    });
  }

  return issueTokens(user, workspace.id);
}

export async function loginUser(
  input: LoginInput,
  log: Logger,
): Promise<AuthTokens> {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, input.email.toLowerCase()))
    .limit(1);

  if (!user) {
    throw new UnauthorizedError("Invalid credentials");
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new UnauthorizedError("Invalid credentials");
  }

  const [workspace] = await db
    .select()
    .from(workspacesTable)
    .where(
      and(
        eq(workspacesTable.ownerId, user.id),
        eq(workspacesTable.status, "active"),
      ),
    )
    .orderBy(asc(workspacesTable.createdAt), asc(workspacesTable.id))
    .limit(1);

  if (!workspace) {
    throw new NotFoundError("Workspace");
  }

  log.info({ userId: user.id }, "User logged in");

  // Auto-guarantee unlimited credits for founder/admin accounts on every login (idempotent).
  // This is the authoritative gate — does not depend on frontend effects.
  const ADMIN_EMAILS = new Set([
    "admin@nexos.ai",
    "founder@nexos.ai",
    "admin@agencianexos.vip",
    "founder@agencianexos.vip",
  ]);
  if (ADMIN_EMAILS.has(user.email)) {
    const currentSettings = (workspace.settings ?? {}) as Record<
      string,
      unknown
    >;
    if (!currentSettings["unlimitedCredits"]) {
      setImmediate(async () => {
        try {
          await db
            .update(workspacesTable)
            .set({
              settings: { ...currentSettings, unlimitedCredits: true } as any,
            })
            .where(eq(workspacesTable.id, workspace.id));
          log.info(
            { userId: user.id, workspaceId: workspace.id },
            "Unlimited credits auto-set for admin on login",
          );
        } catch (e) {
          log.warn(
            { err: e },
            "Failed to auto-set unlimited credits for admin",
          );
        }
      });
    }
  }

  return issueTokens(user, workspace.id);
}

export async function refreshTokens(
  refreshToken: string,
  log: Logger,
): Promise<AuthTokens> {
  let decoded: { userId: string; workspaceId?: string };
  try {
    decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as {
      userId: string;
      workspaceId?: string;
    };
  } catch {
    throw new UnauthorizedError("Invalid refresh token");
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, decoded.userId))
    .limit(1);

  if (!user) {
    throw new UnauthorizedError("User not found");
  }

  const ownedWorkspaces = await db
    .select()
    .from(workspacesTable)
    .where(
      and(
        eq(workspacesTable.ownerId, user.id),
        eq(workspacesTable.status, "active"),
      ),
    )
    .orderBy(asc(workspacesTable.createdAt), asc(workspacesTable.id));
  // Legacy refresh tokens had no workspace claim. Their deterministic fallback
  // is the oldest active owned workspace. Scoped tokens never silently move.
  const workspace = decoded.workspaceId
    ? ownedWorkspaces.find((candidate) => candidate.id === decoded.workspaceId)
    : ownedWorkspaces[0];

  if (!workspace) {
    throw new UnauthorizedError("Selected workspace is no longer available");
  }

  return issueTokens(user, workspace.id);
}

export function verifyAccessToken(token: string): TokenPayload {
  try {
    return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
  } catch {
    throw new UnauthorizedError("Invalid or expired token");
  }
}
