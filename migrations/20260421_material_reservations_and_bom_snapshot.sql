-- Adds material reservations (reserved_qty) and snapshots production orders to a BOM version (bom_id).

ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS reserved_qty numeric(12, 3) NOT NULL DEFAULT '0';

ALTER TABLE production_orders
  ADD COLUMN IF NOT EXISTS bom_id integer;

-- Optional indexes for faster lookups.
CREATE INDEX IF NOT EXISTS materials_org_id_reserved_qty_idx ON materials (org_id, reserved_qty);
CREATE INDEX IF NOT EXISTS production_orders_org_id_bom_id_idx ON production_orders (org_id, bom_id);

