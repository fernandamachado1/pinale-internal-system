DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'unit_of_measure') THEN
    CREATE TYPE unit_of_measure AS ENUM ('UNIT', 'SQUARE_METER', 'METER');
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'material_category')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_enum
       WHERE enumlabel = 'RAW_MATERIAL'
         AND enumtypid = 'material_category'::regtype
     ) THEN
    ALTER TYPE material_category ADD VALUE 'RAW_MATERIAL';
  END IF;
END $$;

ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS unit_of_measure unit_of_measure;

UPDATE materials
SET unit_of_measure = CASE
  WHEN upper(COALESCE("unit", '')) IN ('M2', 'M²', 'SQUARE_METER') THEN 'SQUARE_METER'::unit_of_measure
  WHEN upper(COALESCE("unit", '')) IN ('M', 'METER') THEN 'METER'::unit_of_measure
  ELSE 'UNIT'::unit_of_measure
END
WHERE unit_of_measure IS NULL;

ALTER TABLE materials
  ALTER COLUMN unit_of_measure SET DEFAULT 'UNIT'::unit_of_measure;

ALTER TABLE materials
  ALTER COLUMN unit_of_measure SET NOT NULL;

ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS purchase_price numeric(12, 2);

UPDATE materials
SET purchase_price = COALESCE(purchase_price, 0);

ALTER TABLE materials
  ALTER COLUMN purchase_price SET DEFAULT 0;

ALTER TABLE materials
  ALTER COLUMN purchase_price SET NOT NULL;

ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS price_per_square_meter numeric(12, 2);

CREATE TABLE IF NOT EXISTS produced_product_stocks (
  id serial PRIMARY KEY,
  product_id integer NOT NULL,
  stock_qty integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS produced_product_stocks_product_id_idx
  ON produced_product_stocks(product_id);

INSERT INTO produced_product_stocks (product_id, stock_qty, created_at, updated_at)
SELECT p.id, COALESCE(p.stock_qty, 0), now(), now()
FROM products p
WHERE NOT EXISTS (
  SELECT 1
  FROM produced_product_stocks s
  WHERE s.product_id = p.id
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'boms' AND column_name = 'leather_qty_m2'
  ) THEN
    INSERT INTO materials (
      name,
      unit_of_measure,
      stock_qty,
      category,
      purchase_price,
      price_per_square_meter,
      is_active,
      created_at,
      updated_at
    )
    SELECT
      'Couro - ' || p.name,
      'SQUARE_METER'::unit_of_measure,
      0,
      'RAW_MATERIAL'::material_category,
      0,
      0,
      1,
      now(),
      now()
    FROM boms b
    JOIN products p ON p.id = b.product_id
    WHERE COALESCE(b.leather_qty_m2, 0) > 0
      AND NOT EXISTS (
        SELECT 1
        FROM materials m
        WHERE m.name = 'Couro - ' || p.name
      );

    INSERT INTO bom_items (bom_id, material_id, qty_per_unit, created_at)
    SELECT
      b.id,
      m.id,
      b.leather_qty_m2,
      now()
    FROM boms b
    JOIN products p ON p.id = b.product_id
    JOIN materials m ON m.name = 'Couro - ' || p.name
    WHERE COALESCE(b.leather_qty_m2, 0) > 0
      AND NOT EXISTS (
        SELECT 1
        FROM bom_items bi
        WHERE bi.bom_id = b.id
          AND bi.material_id = m.id
      );

    ALTER TABLE boms DROP COLUMN leather_qty_m2;
  END IF;
END $$;
