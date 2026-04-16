import fs from "node:fs";
import path from "node:path";
import pg from "pg";

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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function requiredEnv(name, env) {
  const value = env[name] ?? process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function stripSslMode(databaseUrl) {
  return databaseUrl.replace(/([?&])sslmode=[^&]+(&?)/, (match, p1, p2) => {
    if (p1 === "?" && p2) return "?";
    if (p1 === "&" && p2) return "&";
    return "";
  });
}

function normalizeText(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value) {
  const smallWords = new Set(["de", "da", "do", "das", "dos", "e", "em", "no", "na", "nos", "nas"]);
  return value
    .split(" ")
    .filter(Boolean)
    .map((word, index) => {
      const normalized = word.toLowerCase();
      if (index > 0 && smallWords.has(normalized)) return normalized;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function composeProductName(product, name) {
  const normalizedProduct = normalizeText(product);
  const normalizedName = normalizeText(name);
  if (normalizedName.startsWith(normalizedProduct)) return titleCase(name);
  return titleCase(`${product} ${name}`);
}

const categoryMap = {
  "Acessórios": "ACCESSORIES",
  Papelaria: "STATIONERY",
  Carteiras: "WALLETS",
  Viagem: "TRAVEL",
  Bolsas: "BAGS",
};

const rows = [
  { product: "Porta Óculos", name: "Raja", category: "Acessórios", qty: 3, price: "255.00" },
  { product: "Chaveiro", name: "Cori", category: "Acessórios", qty: 6, price: "75.00" },
  { product: "Chaveiro", name: "Chaveiro", category: "Acessórios", qty: 5, price: "40.00" },
  { product: "Porta Óculos", name: "Tani", category: "Acessórios", qty: 7, price: "220.00" },
  { product: "Tag de Mala", name: "Tag de mala", category: "Viagem", qty: 2, price: "100.00" },
  { product: "Marca Página", name: "Marcaj", category: "Papelaria", qty: 15, price: "25.00" },
  { product: "Porta Caderno", name: "Pampa A5", category: "Papelaria", qty: 11, price: "350.00" },
  { product: "Porta Caderno", name: "Pampa A6", category: "Papelaria", qty: 8, price: "275.00" },
  { product: "Estojo", name: "Tauk", category: "Papelaria", qty: 6, price: "180.00" },
  { product: "Estojo", name: "Tauk Mini", category: "Papelaria", qty: 7, price: "175.00" },
  { product: "Estojo", name: "Diversos", category: "Papelaria", qty: 20, price: "180.00" },
  { product: "Carteira", name: "Floccus", category: "Carteiras", qty: 2, price: "330.00" },
  { product: "Carteira", name: "Incus", category: "Carteiras", qty: 3, price: "475.00" },
  { product: "Porta Cartão", name: "Fractus", category: "Carteiras", qty: 5, price: "200.00" },
  { product: "Carteira Slim", name: "Pileus", category: "Carteiras", qty: 5, price: "220.00" },
  { product: "Carteira Slim", name: "Stratus", category: "Carteiras", qty: 5, price: "200.00" },
  { product: "Carteira", name: "Tani", category: "Carteiras", qty: 9, price: "150.00" },
  { product: "Carteira", name: "Cirrus", category: "Carteiras", qty: 7, price: "220.00" },
  { product: "Carteira", name: "Castellanus", category: "Carteiras", qty: 8, price: "285.00" },
  { product: "Porta Passaporte", name: "Radiatus", category: "Viagem", qty: 8, price: "310.00" },
  { product: "Bolsa", name: "Ameixa", category: "Bolsas", qty: 4, price: "680.00" },
  { product: "Bolsa", name: "Pitanga", category: "Bolsas", qty: 6, price: "550.00" },
  { product: "Bolsa", name: "Tani", category: "Bolsas", qty: 5, price: "680.00" },
  { product: "Bolsa", name: "Ypê", category: "Bolsas", qty: 1, price: "820.00" },
  { product: "Mochila", name: "Mahogany", category: "Bolsas", qty: 1, price: "2700.00" },
];

const root = process.cwd();
const dotEnv = parseDotEnv(path.join(root, ".env"));
const databaseUrl = stripSslMode(requiredEnv("DATABASE_URL", dotEnv));
const { Client } = pg;
const client = new Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
await client.query("BEGIN");

try {
  const orgRes = await client.query("select id from organizations order by created_at asc limit 1");
  if (orgRes.rowCount === 0) throw new Error("No organization found");
  const orgId = orgRes.rows[0].id;

  const existingRes = await client.query(
    "select id, name from products where org_id = $1 and is_active = 1 order by id",
    [orgId],
  );
  const existingByNormName = new Map(existingRes.rows.map((row) => [normalizeText(row.name), row]));

  const result = [];
  for (const row of rows) {
    const name = composeProductName(row.product, row.name);
    const category = categoryMap[row.category];
    if (!category) throw new Error(`Unknown category: ${row.category}`);

    const normalizedName = normalizeText(name);
    const existing = existingByNormName.get(normalizedName);

    let productId;
    if (existing) {
      const updateRes = await client.query(
        `
        update products
        set name = $2,
            price = $3,
            category = $4,
            description = '',
            attachments = '[]'::jsonb,
            color_variants = '[]'::jsonb,
            updated_at = now()
        where id = $1
        returning id
        `,
        [existing.id, name, row.price, category],
      );
      productId = updateRes.rows[0].id;
      await client.query(
        "update boms set is_active = 0, updated_at = now() where product_id = $1 and is_active = 1 and org_id = $2",
        [productId, orgId],
      );
    } else {
      const insertRes = await client.query(
        `
        insert into products (org_id, name, price, category, description, attachments, color_variants, is_active)
        values ($1, $2, $3, $4, '', '[]'::jsonb, '[]'::jsonb, 1)
        returning id
        `,
        [orgId, name, row.price, category],
      );
      productId = insertRes.rows[0].id;
      await client.query(
        "insert into produced_product_stocks (org_id, product_id, stock_qty) values ($1, $2, 0)",
        [orgId, productId],
      );
    }

    const stockRes = await client.query(
      "select stock_qty from produced_product_stocks where org_id = $1 and product_id = $2 limit 1",
      [orgId, productId],
    );
    if (stockRes.rowCount === 0) {
      await client.query(
        "insert into produced_product_stocks (org_id, product_id, stock_qty) values ($1, $2, 0) on conflict (product_id) do nothing",
        [orgId, productId],
      );
    }
    const currentStock = Number(stockRes.rows[0]?.stock_qty ?? 0);
    const delta = row.qty - currentStock;

    if (delta !== 0) {
      await client.query(
        `
        insert into inventory_movements (org_id, entity_type, entity_id, direction, qty, reason, reference_type, metadata)
        values ($1, 'PRODUCT', $2, $3, $4, 'ADJUSTMENT', 'MANUAL', $5::jsonb)
        `,
        [
          orgId,
          productId,
          delta > 0 ? "IN" : "OUT",
          Math.abs(delta),
          JSON.stringify({
            subtype: "TABLE_IMPORT_ADJUSTMENT",
            source: "SCRIPT_IMPORT_PRODUCTS_FROM_SHEET",
          }),
        ],
      );
      await client.query(
        "update produced_product_stocks set stock_qty = $1, updated_at = now() where org_id = $2 and product_id = $3",
        [row.qty, orgId, productId],
      );
    }

    result.push({ id: productId, name, qty: row.qty, price: row.price, category, delta });
  }

  await client.query("COMMIT");
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
