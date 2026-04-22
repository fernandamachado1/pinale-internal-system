-- Adds stable ordering for purchase orders (list view drag-and-drop).

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Backfill existing rows deterministically.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (ORDER BY created_at, id) - 1 AS rn
  FROM purchase_orders
  WHERE is_active = 1
)
UPDATE purchase_orders po
SET sort_order = ranked.rn
FROM ranked
WHERE po.id = ranked.id;

CREATE INDEX IF NOT EXISTS purchase_orders_sort_idx
  ON purchase_orders (is_active, sort_order, id);

