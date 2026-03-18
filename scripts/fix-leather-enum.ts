import pg from "pg";

const { Client } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL not set");
}

const client = new Client({ connectionString: process.env.DATABASE_URL });

await client.connect();

const result = await client.query(
  `UPDATE inventory_movements SET entity_type = 'MATERIAL' WHERE entity_type::text = 'LEATHER'`
);

console.log(`Updated ${result.rowCount} row(s): LEATHER → MATERIAL`);

await client.end();
