import crypto from "crypto";
import { cookies } from "next/headers";
import { db } from "./db";
import { AuthenticatedUser } from "@/types/auth";

export const SESSION_COOKIE_NAME = "dagoeng_session";
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

/**
 * Computes a secure SHA-256 hash of a raw session token string.
 */
export function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Creates a database session, storing only the hashed token.
 * Returns the raw token to be set in the HttpOnly cookie.
 */
export async function createDatabaseSession(
  userId: string,
  userAgent?: string,
  ipAddress?: string
): Promise<{ rawToken: string; expiresAt: Date; sessionId: string }> {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const sessionTokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);

  const session = await db.session.create({
    data: {
      userId,
      sessionTokenHash,
      expiresAt,
      userAgent: userAgent || null,
      ipAddress: ipAddress || null,
    },
  });

  return { rawToken, expiresAt, sessionId: session.id };
}

/**
 * Validates session token from request cookie against the database.
 * Returns the fully hydrated AuthenticatedUser or null.
 */
export async function validateSessionFromCookie(): Promise<AuthenticatedUser | null> {
  const cookieStore = cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!rawToken) return null;

  const sessionTokenHash = hashSessionToken(rawToken);

  const session = await db.session.findUnique({
    where: { sessionTokenHash },
    include: {
      user: {
        include: {
          userRoles: {
            include: {
              role: {
                include: {
                  permissions: {
                    include: {
                      permission: true,
                    },
                  },
                },
              },
              organization: true,
              outlet: true,
            },
          },
        },
      },
    },
  });

  if (!session) return null;

  // Check if session has expired
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  // Check if user is active
  if (!session.user.isActive) {
    return null;
  }

  const primaryUserRole = session.user.userRoles[0];
  if (!primaryUserRole) return null;

  const permissions = primaryUserRole.role.permissions.map((rp) => rp.permission.code);

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    phone: session.user.phone,
    role: {
      id: primaryUserRole.role.id,
      slug: primaryUserRole.role.slug as any,
      name: primaryUserRole.role.name,
    },
    organization: primaryUserRole.organization
      ? {
          id: primaryUserRole.organization.id,
          name: primaryUserRole.organization.name,
          code: primaryUserRole.organization.code,
        }
      : null,
    outlet: primaryUserRole.outlet
      ? {
          id: primaryUserRole.outlet.id,
          name: primaryUserRole.outlet.name,
          code: primaryUserRole.outlet.code,
        }
      : null,
    scopeLevel: primaryUserRole.outlet ? "OUTLET" : primaryUserRole.organization ? "ORGANIZATION" : "PLATFORM",
    allowedModules: ["CORE", "FNB", "CO_WORKING"],
    tenant: null,
    permissions,
  };
}

/**
 * Revokes session by deleting it from database.
 */
export async function revokeCurrentSession(): Promise<void> {
  const cookieStore = cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (rawToken) {
    const sessionTokenHash = hashSessionToken(rawToken);
    await db.session.deleteMany({
      where: { sessionTokenHash },
    }).catch(() => {});
  }
}
