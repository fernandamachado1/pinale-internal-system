import { drizzle } from "npm:drizzle-orm/node-postgres";
import pg from "npm:pg";
import * as schema from "../shared/schema.ts";

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} must be set`);
  return value;
}

function stripOptionalQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseDatabaseUrl(rawUrl: string): URL {
  const normalized = stripOptionalQuotes(rawUrl);
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error("Invalid DATABASE_URL (expected a postgresql://... URL)");
  }

  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error("Invalid DATABASE_URL protocol (expected postgresql://)");
  }

  if (!parsed.hostname) {
    throw new Error("Invalid DATABASE_URL host");
  }

  return parsed;
}

const { Pool } = pg;

function shouldRejectUnauthorized(): boolean {
  // Default to relaxed verification for local dev. In production, set:
  // PG_SSL_REJECT_UNAUTHORIZED=true
  return Deno.env.get("PG_SSL_REJECT_UNAUTHORIZED") === "true";
}

function normalizePgConnectionString(rawUrl: string): string {
  const parsed = parseDatabaseUrl(rawUrl);
  // pg/pg-connection-string currently treats sslmode=require as verify-full.
  // Using `uselibpqcompat=true` restores libpq semantics (require = encrypt, no CA validation),
  // which is useful for local dev where CA roots may be missing.
  if (!shouldRejectUnauthorized()) {
    const sslmode = parsed.searchParams.get("sslmode");
    const hasCompat = parsed.searchParams.get("uselibpqcompat") === "true";
    if (sslmode === "require" && !hasCompat) {
      parsed.searchParams.set("uselibpqcompat", "true");
    }
  }
  return parsed.toString();
}

type DbInfo = {
  host: string;
  port: number;
  database: string;
  user: string;
  hasPassword: boolean;
  sslmode: string | null;
};

let singleton:
  | {
      pool: InstanceType<typeof Pool>;
      db: ReturnType<typeof drizzle<typeof schema>>;
      info: DbInfo;
    }
  | undefined;

let singletonPromise: Promise<NonNullable<typeof singleton>> | undefined;

async function forceIpv4HostIfNeeded(databaseUrl: string): Promise<string> {
  const isDeploy = Boolean(Deno.env.get("DENO_DEPLOYMENT_ID"));
  const forceIpv4 = Deno.env.get("PG_FORCE_IPV4") === "true" || !isDeploy;
  if (!forceIpv4) return databaseUrl;

  const parsed = parseDatabaseUrl(databaseUrl);
  // If it's already an IP literal, leave it.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(parsed.hostname)) return databaseUrl;

  try {
    const addresses = await Deno.resolveDns(parsed.hostname, "A");
    const ipv4 = typeof addresses[0] === "string" ? addresses[0] : null;
    if (!ipv4) return databaseUrl;
    parsed.hostname = ipv4;
    return parsed.toString();
  } catch {
    return databaseUrl;
  }
}

export async function initDb(): Promise<NonNullable<typeof singleton>> {
  if (singleton) return singleton;
  if (singletonPromise) return await singletonPromise;

  singletonPromise = (async () => {
    const rawDatabaseUrl = requiredEnv("DATABASE_URL");
    const databaseUrl = stripOptionalQuotes(rawDatabaseUrl);
    const parsed = parseDatabaseUrl(databaseUrl);

    const info: DbInfo = {
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 5432,
      database: parsed.pathname?.replace(/^\//, "") || "",
      user: decodeURIComponent(parsed.username || ""),
      hasPassword: Boolean(parsed.password),
      sslmode: parsed.searchParams.get("sslmode"),
    };

    const connectionString = await forceIpv4HostIfNeeded(
      normalizePgConnectionString(databaseUrl),
    );

    const pool = new Pool({
      connectionString,
      // Supabase requires SSL; Deno/Node TLS validation can fail in some local setups.
      ssl: { rejectUnauthorized: shouldRejectUnauthorized() },
      max: 10,
      connectionTimeoutMillis: 10_000,
    });

    const db = drizzle(pool, { schema });
    singleton = { pool, db, info };
    return singleton;
  })();

  return await singletonPromise;
}
