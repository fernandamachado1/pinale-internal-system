import { createRemoteJWKSet, decodeJwt, jwtVerify } from "npm:jose";

type SupabaseUser = { id: string; email?: string | null };

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} must be set`);
  return value;
}

export function getSupabaseConfig(): { url: string; anonKey: string } {
  const url =
    Deno.env.get("SUPABASE_URL") ??
    Deno.env.get("VITE_SUPABASE_URL") ??
    requiredEnv("SUPABASE_URL");
  const anonKey =
    Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("VITE_SUPABASE_ANON_KEY") ??
    requiredEnv("SUPABASE_ANON_KEY");
  return { url, anonKey };
}

const jwksByUrl = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(url: string) {
  const existing = jwksByUrl.get(url);
  if (existing) return existing;
  const jwksUrl = new URL("/auth/v1/.well-known/jwks.json", url);
  const jwks = createRemoteJWKSet(jwksUrl, {
    headers: { apikey: getSupabaseConfig().anonKey },
  });
  jwksByUrl.set(url, jwks);
  return jwks;
}

export async function requireSupabaseUser(authorizationHeader: string | undefined): Promise<SupabaseUser> {
  if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
    throw new Error("UNAUTHORIZED");
  }

  const token = authorizationHeader.slice("Bearer ".length).trim();
  if (!token) throw new Error("UNAUTHORIZED");

  const { url } = getSupabaseConfig();
  const issuerBase = new URL("/auth/v1", url).toString();
  const issuers = [issuerBase, `${issuerBase}/`];
  try {
    let payload: Record<string, unknown> | null = null;
    try {
      ({ payload } = await jwtVerify(token, getJwks(url), {
        issuer: issuers,
        audience: "authenticated",
      }));
    } catch {
      // Some projects may use a different aud; keep signature+issuer validation.
      ({ payload } = await jwtVerify(token, getJwks(url), {
        issuer: issuers,
      }));
    }

    const sub = typeof payload.sub === "string" ? payload.sub : null;
    if (!sub) throw new Error("UNAUTHORIZED");
    const email = typeof (payload as any).email === "string" ? String((payload as any).email) : null;
    return { id: sub, email };
  } catch {
    try {
      const decoded = decodeJwt(token);
      console.warn("[auth] JWT rejected", {
        iss: decoded.iss,
        aud: decoded.aud,
        sub: decoded.sub,
      });
    } catch {
      console.warn("[auth] JWT rejected (decode failed)");
    }
    throw new Error("UNAUTHORIZED");
  }
}
