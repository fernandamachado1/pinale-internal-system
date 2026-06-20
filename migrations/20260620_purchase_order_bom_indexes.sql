-- Additional read-performance indexes for purchase orders and BOM lookups.
-- These support the main ERP list and join paths without changing data.

CREATE INDEX IF NOT EXISTS purchase_orders_org_id_is_active_sort_idx
  ON purchase_orders (org_id, is_active, sort_order, id);

CREATE INDEX IF NOT EXISTS purchase_order_items_org_id_purchase_order_id_sort_idx
  ON purchase_order_items (org_id, purchase_order_id, sort_order, id);

CREATE INDEX IF NOT EXISTS boms_org_id_is_active_product_id_idx
  ON boms (org_id, is_active, product_id);

CREATE INDEX IF NOT EXISTS bom_items_org_id_bom_id_idx
  ON bom_items (org_id, bom_id);
