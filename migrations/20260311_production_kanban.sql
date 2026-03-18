-- Add kanban stages and persistent ordering to production orders.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumtypid = 'production_order_status'::regtype
      AND enumlabel = 'OPEN'
  ) THEN
    ALTER TYPE production_order_status RENAME VALUE 'OPEN' TO 'BACKLOG';
  END IF;
END $$;

ALTER TYPE production_order_status ADD VALUE IF NOT EXISTS 'IN_PROGRESS';

ALTER TABLE production_orders
  ALTER COLUMN status SET DEFAULT 'BACKLOG';

ALTER TABLE production_orders
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

WITH ranked_orders AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY status
      ORDER BY created_at DESC, id DESC
    ) - 1 AS next_sort_order
  FROM production_orders
)
UPDATE production_orders AS orders
SET sort_order = ranked_orders.next_sort_order
FROM ranked_orders
WHERE ranked_orders.id = orders.id;
