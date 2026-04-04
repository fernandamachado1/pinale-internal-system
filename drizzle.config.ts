import { defineConfig } from "drizzle-kit";
import dns from "node:dns";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

// Supabase often resolves to both A and AAAA records. Many local networks have broken IPv6,
// causing drizzle-kit/pg to intermittently try AAAA and fail with ECONNREFUSED/timeouts.
// Default to IPv4-first for local dev.
try {
  dns.setDefaultResultOrder("ipv4first");
} catch {
  // ignore
}

function parseDatabaseUrl(rawUrl: string): URL {
  try {
    return new URL(rawUrl);
  } catch {
    throw new Error("DATABASE_URL must be a valid postgresql:// URL");
  }
}

const parsed = parseDatabaseUrl(process.env.DATABASE_URL);
const hostOverride = process.env.DRIZZLE_DB_HOST?.trim() || undefined;
const host = hostOverride ?? parsed.hostname;
const port = parsed.port ? Number(parsed.port) : 5432;
const database = parsed.pathname?.replace(/^\//, "") || "postgres";
const forceIpv4 = process.env.DRIZZLE_FORCE_IPV4 !== "false";

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    host,
    port,
    user: decodeURIComponent(parsed.username || "postgres"),
    password: decodeURIComponent(parsed.password || ""),
    database,
    // 'require' disables strict CA validation in drizzle-kit (handy for local dev).
    ssl: "require",
    ...(forceIpv4 ? { family: 4 } : {}),
  },
});
