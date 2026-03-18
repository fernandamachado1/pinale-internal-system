import { readFileSync } from "fs";
import { resolve } from "path";
import pg from "pg";

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

// Fix legacy unit_of_measure values
const fixes = [
  ["UN", "UNIT"],
  ["M2", "SQUARE_METER"],
  ["M", "METER"],
];

for (const [old, newVal] of fixes) {
  const r = await client.query(
    `UPDATE materials SET unit_of_measure = $2 WHERE unit_of_measure::text = $1`,
    [old, newVal]
  );
  if (r.rowCount > 0) console.log(`✓ Updated ${r.rowCount} row(s): ${old} → ${newVal}`);
}

console.log("Done.");
await client.end();
