-- Pre-migration for legacy data to new business rules
-- Run this script BEFORE `yarn db:push`.
-- Safe to run multiple times (idempotent guards included where possible).

BEGIN;

-- 1) New enum used by materials.category
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'material_category') THEN
    CREATE TYPE material_category AS ENUM ('PACKAGING', 'NOTIONS');
  END IF;
END $$;

-- 2) Materials: remove policy model, map group -> category, ensure stock is always numeric and not null
DO $$
DECLARE
  has_group boolean;
  has_category boolean;
  has_policy boolean;
  has_stock_qty boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'materials' AND column_name = 'group'
  ) INTO has_group;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'materials' AND column_name = 'category'
  ) INTO has_category;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'materials' AND column_name = 'policy'
  ) INTO has_policy;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'materials' AND column_name = 'stock_qty'
  ) INTO has_stock_qty;

  IF has_group AND NOT has_category THEN
    ALTER TABLE materials ADD COLUMN category material_category;

    -- conservative mapping:
    -- if material name suggests packaging -> PACKAGING; everything else -> NOTIONS
    UPDATE materials
    SET category = CASE
      WHEN lower(name) LIKE '%embalag%' OR lower(name) LIKE '%caixa%' OR lower(name) LIKE '%saco%' THEN 'PACKAGING'::material_category
      ELSE 'NOTIONS'::material_category
    END;
  END IF;

  IF has_category THEN
    UPDATE materials
    SET category = COALESCE(category, 'NOTIONS'::material_category);
    ALTER TABLE materials ALTER COLUMN category SET DEFAULT 'NOTIONS'::material_category;
    ALTER TABLE materials ALTER COLUMN category SET NOT NULL;
  END IF;

  IF has_stock_qty THEN
    UPDATE materials SET stock_qty = '0' WHERE stock_qty IS NULL;
    ALTER TABLE materials ALTER COLUMN stock_qty SET DEFAULT '0';
    ALTER TABLE materials ALTER COLUMN stock_qty SET NOT NULL;
  END IF;

  IF has_policy THEN
    ALTER TABLE materials DROP COLUMN policy;
  END IF;

  IF has_group THEN
    ALTER TABLE materials DROP COLUMN "group";
  END IF;
END $$;

-- 3) BOM: add mold/leather fields and backfill leather from legacy variable item (LEATHER), if legacy columns exist
DO $$
DECLARE
  has_bom_mold boolean;
  has_bom_leather boolean;
  has_bom_item_type boolean;
  has_bom_material_group boolean;
  has_bom_planned_qty boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'boms' AND column_name = 'mold_measure'
  ) INTO has_bom_mold;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'boms' AND column_name = 'leather_qty_m2'
  ) INTO has_bom_leather;

  IF NOT has_bom_mold THEN
    ALTER TABLE boms ADD COLUMN mold_measure numeric(12,3) NOT NULL DEFAULT 0;
  END IF;

  IF NOT has_bom_leather THEN
    ALTER TABLE boms ADD COLUMN leather_qty_m2 numeric(12,3) NOT NULL DEFAULT 0;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bom_items' AND column_name = 'item_type'
  ) INTO has_bom_item_type;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bom_items' AND column_name = 'material_group'
  ) INTO has_bom_material_group;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bom_items' AND column_name = 'planned_qty_per_unit'
  ) INTO has_bom_planned_qty;

  IF has_bom_item_type AND has_bom_material_group AND has_bom_planned_qty THEN
    UPDATE boms b
    SET leather_qty_m2 = COALESCE(src.leather_qty_m2, b.leather_qty_m2)
    FROM (
      SELECT bi.bom_id, MAX(bi.planned_qty_per_unit)::numeric(12,3) AS leather_qty_m2
      FROM bom_items bi
      WHERE bi.item_type = 'VARIABLE_MATERIAL' AND bi.material_group = 'LEATHER'
      GROUP BY bi.bom_id
    ) src
    WHERE src.bom_id = b.id;
  END IF;

  -- remove legacy variable BOM lines; new model keeps only fixed material lines
  IF has_bom_item_type THEN
    DELETE FROM bom_items WHERE item_type = 'VARIABLE_MATERIAL';
  END IF;
END $$;

-- 4) Inventory movements: map legacy MATERIAL_GROUP/LEATHER to entity_type LEATHER
DO $$
DECLARE
  has_group_column boolean;
  has_entity_type boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_movements' AND column_name = 'group'
  ) INTO has_group_column;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_movements' AND column_name = 'entity_type'
  ) INTO has_entity_type;

  IF has_group_column AND has_entity_type THEN
    UPDATE inventory_movements
    SET entity_type = 'LEATHER',
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('legacyGroup', "group"),
        "group" = NULL
    WHERE entity_type = 'MATERIAL_GROUP' AND "group" = 'LEATHER';

    -- Any other legacy MATERIAL_GROUP values are kept as MATERIAL_GROUP until schema push.
    -- You can decide later if they should be archived or deleted.
  END IF;
END $$;

COMMIT;
