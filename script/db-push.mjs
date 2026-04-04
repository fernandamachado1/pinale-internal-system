import { spawnSync } from "node:child_process";
import dns from "node:dns";
import fs from "node:fs";
import path from "node:path";

function parseDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, "utf8");
  const env = {};
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function requiredEnv(name, env) {
  const value = env[name] ?? process.env[name];
  if (!value) {
    console.error(`[db:push] Missing ${name}. Put it in .env or export it.`);
    process.exit(1);
  }
  return value;
}

const root = process.cwd();
const dotEnv = parseDotEnv(path.join(root, ".env"));
const databaseUrl = requiredEnv("DATABASE_URL", dotEnv);

let url;
try {
  url = new URL(databaseUrl);
} catch {
  console.error("[db:push] DATABASE_URL must be a valid postgresql:// URL");
  process.exit(1);
}

// Force IPv4 for Supabase hosts (avoids ECONNREFUSED on broken IPv6 networks).
let ipv4;
try {
  const addresses = await dns.promises.resolve4(url.hostname);
  ipv4 = addresses[0];
  if (!ipv4) throw new Error("No A record");
} catch (err) {
  console.warn("[db:push] Could not resolve IPv4, falling back to hostname:", err?.message ?? err);
}

const env = {
  ...process.env,
  ...dotEnv,
  ...(ipv4 ? { DRIZZLE_DB_HOST: ipv4 } : {}),
};

const result = spawnSync("yarn", ["drizzle-kit", "push"], {
  stdio: "inherit",
  env,
});

process.exit(result.status ?? 1);

