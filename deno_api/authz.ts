import { eq, sql } from "drizzle-orm";
import { profiles, type Profile, type UserRole } from "../shared/schema.ts";
import { ApiError } from "./errors.ts";

export function requireRole(profile: Profile, allowed: UserRole[]): void {
  if (!allowed.includes(profile.role as UserRole)) {
    throw new ApiError(403, "Forbidden", "FORBIDDEN");
  }
}

export async function ensureProfile(
  db: any,
  user: { id: string; email?: string | null },
): Promise<Profile> {
  // Fast path: most requests should only need a single SELECT.
  const rows = (await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1)) as Profile[];
  const existing = rows[0];
  if (existing?.orgId) {
    if (!existing.isActive) throw new ApiError(403, "User is inactive", "USER_INACTIVE");
    return existing;
  }

  // Slow path: only when profile is missing or missing orgId.
  // Drizzle's `execute` return shape depends on driver; support the common ones.
  // - node-postgres: { rows: [...] }
  // - some adapters: array of rows
  const result: any = await db.execute(sql`select public.ensure_default_org_id() as id`);
  const resolvedDefaultOrgId =
    (Array.isArray(result) ? result?.[0]?.id : result?.rows?.[0]?.id) ??
    result?.[0]?.id ??
    result?.rows?.[0]?.id;
  if (!resolvedDefaultOrgId) {
    throw new ApiError(500, "Failed to resolve default org id. Did you run migrations?", "ORG_MISSING");
  }

  // Best-effort insert when missing.
  if (!existing) {
    try {
      await db
        .insert(profiles)
        .values({
          id: user.id,
          orgId: resolvedDefaultOrgId,
          email: user.email ?? null,
        })
        .onConflictDoNothing();
    } catch {
      // ignore insert failures; we still try to load below.
    }
  }

  // Backfill orgId if needed.
  if (existing && !existing.orgId) {
    const [updated] = (await db
      .update(profiles)
      .set({ orgId: resolvedDefaultOrgId, updatedAt: new Date() })
      .where(eq(profiles.id, user.id))
      .returning()) as Profile[];
    if (updated) {
      if (!updated.isActive) throw new ApiError(403, "User is inactive", "USER_INACTIVE");
      return updated;
    }
  }

  const rowsAfter = (await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1)) as Profile[];
  const profile = rowsAfter[0];
  if (!profile) throw new ApiError(500, "Profile not found. Did you run migrations?", "PROFILE_MISSING");
  if (!profile.isActive) throw new ApiError(403, "User is inactive", "USER_INACTIVE");
  return profile;
}
