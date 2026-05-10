import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db, usersTable, workspacesTable, plansTable } from "@workspace/db";
import { env } from "../../lib/env.js";
import {
  UnauthorizedError,
  ConflictError,
  NotFoundError,
} from "../../lib/errors.js";
import type { Logger } from "pino";

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
  locale?: "pt-BR" | "en-US" | "es-LA";
}

export interface LoginInput {
  email: string;
  password: string;
}

function signAccess(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

function signRefresh(payload: Pick<TokenPayload, "userId">): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

export async function registerUser(
  input: RegisterInput,
  log: Logger,
): Promise<AuthTokens> {
  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, input.email.toLowerCase()))
    .limit(1);

  if (existing.length > 0) {
    throw new ConflictError("Email already registered");
  }

  const soloPlan = await db
    .select()
    .from(plansTable)
    .where(eq(plansTable.slug, "solo"))
    .limit(1);

  if (soloPlan.length === 0) {
    throw new NotFoundError("Default plan");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  const [user] = await db
    .insert(usersTable)
    .values({
      email: input.email.toLowerCase(),
      passwordHash,
      name: input.name,
      phone: input.phone ?? null,
      locale: input.locale ?? "pt-BR",
    })
    .returning();

  const slug = `${input.name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;

  const [workspace] = await db
    .insert(workspacesTable)
    .values({
      ownerId: user.id,
      planId: soloPlan[0].id,
      name: `${input.name}'s Workspace`,
      slug,
      creditsBalance: soloPlan[0].creditsMonthly,
    })
    .returning();

  log.info({ userId: user.id, workspaceId: workspace.id }, "User registered");

  const payload: TokenPayload = {
    userId: user.id,
    workspaceId: workspace.id,
    email: user.email,
  };

  return {
    accessToken: signAccess(payload),
    refreshToken: signRefresh({ userId: user.id }),
    expiresIn: 15 * 60,
  };
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
    .where(eq(workspacesTable.ownerId, user.id))
    .limit(1);

  if (!workspace) {
    throw new NotFoundError("Workspace");
  }

  log.info({ userId: user.id }, "User logged in");

  const payload: TokenPayload = {
    userId: user.id,
    workspaceId: workspace.id,
    email: user.email,
  };

  return {
    accessToken: signAccess(payload),
    refreshToken: signRefresh({ userId: user.id }),
    expiresIn: 15 * 60,
  };
}

export async function refreshTokens(
  refreshToken: string,
  log: Logger,
): Promise<AuthTokens> {
  let decoded: { userId: string };
  try {
    decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as {
      userId: string;
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

  const [workspace] = await db
    .select()
    .from(workspacesTable)
    .where(eq(workspacesTable.ownerId, user.id))
    .limit(1);

  if (!workspace) {
    throw new NotFoundError("Workspace");
  }

  const payload: TokenPayload = {
    userId: user.id,
    workspaceId: workspace.id,
    email: user.email,
  };

  return {
    accessToken: signAccess(payload),
    refreshToken: signRefresh({ userId: user.id }),
    expiresIn: 15 * 60,
  };
}

export function verifyAccessToken(token: string): TokenPayload {
  try {
    return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
  } catch {
    throw new UnauthorizedError("Invalid or expired token");
  }
}
