DO $$
BEGIN
  CREATE TYPE production_order_type AS ENUM ('NORMAL', 'ENCOMENDA');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE production_orders
  ADD COLUMN IF NOT EXISTS order_type production_order_type NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS amount_paid numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivered_at timestamp;
