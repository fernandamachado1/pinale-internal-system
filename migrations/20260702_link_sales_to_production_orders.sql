-- Link automatically generated sales to production orders.
-- This allows encomenda payments to create a sale once, without duplicates.

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS origin_production_order_id integer;

CREATE UNIQUE INDEX IF NOT EXISTS sales_origin_production_order_id_unique
  ON sales (origin_production_order_id);
