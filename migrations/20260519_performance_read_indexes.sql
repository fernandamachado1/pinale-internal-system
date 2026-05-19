-- Read-performance indexes for the most frequent ERP queries.
-- These indexes do not change existing data.

CREATE INDEX IF NOT EXISTS production_orders_org_id_status_created_sort_idx
  ON production_orders (org_id, status, created_at DESC, sort_order);

CREATE INDEX IF NOT EXISTS production_orders_org_id_created_at_idx
  ON production_orders (org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS sales_org_id_sold_at_idx
  ON sales (org_id, sold_at DESC);

CREATE INDEX IF NOT EXISTS sale_items_org_id_sale_id_idx
  ON sale_items (org_id, sale_id);

CREATE INDEX IF NOT EXISTS sale_items_org_id_created_at_idx
  ON sale_items (org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS inventory_movements_org_id_created_at_idx
  ON inventory_movements (org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS inventory_movements_org_id_entity_filters_idx
  ON inventory_movements (org_id, entity_type, direction, reason, created_at DESC);

CREATE INDEX IF NOT EXISTS inventory_movements_org_id_entity_reference_idx
  ON inventory_movements (org_id, entity_type, direction, reason, reference_type, created_at DESC);

CREATE INDEX IF NOT EXISTS products_org_id_is_active_name_idx
  ON products (org_id, is_active, name);

CREATE INDEX IF NOT EXISTS materials_org_id_is_active_name_idx
  ON materials (org_id, is_active, name);
