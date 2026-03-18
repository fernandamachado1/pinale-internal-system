import { readFileSync } from "fs";
import { resolve } from "path";
import pg from "pg";

// Load .env manually (same as drizzle-kit does internally)
try {
  const env = readFileSync(resolve(process.cwd(), ".env"), "utf-8");
  for (const line of env.split("\n")) {
    const match = line.match(/^([^#\s][^=]*)=(.*)$/);
    if (match) process.env[match[1].trim()] ??= match[2].trim();
  }
} catch {
  // no .env file, use existing env vars
}

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL not set");
  process.exit(1);
}

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const result = await client.query(
  `UPDATE inventory_movements SET entity_type = 'MATERIAL' WHERE entity_type::text = 'LEATHER'`
);
console.log(`✓ Updated ${result.rowCount} row(s): LEATHER → MATERIAL`);

await client.end();
