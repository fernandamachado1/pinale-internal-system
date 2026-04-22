-- Adds stable ordering for purchase order items.

ALTER TABLE purchase_order_items
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Backfill existing rows so each purchase order has a deterministic order.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (PARTITION BY purchase_order_id ORDER BY created_at, id) - 1 AS rn
  FROM purchase_order_items
)
UPDATE purchase_order_items poi
SET sort_order = ranked.rn
FROM ranked
WHERE poi.id = ranked.id;

CREATE INDEX IF NOT EXISTS purchase_order_items_order_sort_idx
  ON purchase_order_items (purchase_order_id, sort_order, id);

