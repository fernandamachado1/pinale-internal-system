-- Split OPEN purchase orders that have multiple items into multiple purchase orders
-- (one item per purchase order). This enables per-item rows in the list, with no linkage.

DO $$
DECLARE
  r RECORD;
  new_order_id integer;
BEGIN
  -- For each extra item (rn > 1) in an OPEN purchase order, create a new purchase order
  -- and move that item to it.
  FOR r IN
    SELECT
      po.org_id,
      po.status,
      po.is_active,
      po.created_at,
      po.received_at,
      poi.id AS item_id
    FROM purchase_orders po
    JOIN LATERAL (
      SELECT
        id,
        qty_received,
        row_number() OVER (ORDER BY sort_order, id) AS rn
      FROM purchase_order_items
      WHERE purchase_order_id = po.id
    ) poi ON true
    WHERE
      po.is_active = 1
      AND po.status = 'OPEN'
      AND poi.rn > 1
      AND COALESCE(poi.qty_received, 0) = 0
    ORDER BY po.org_id, po.id, poi.rn
  LOOP
    INSERT INTO purchase_orders (org_id, status, is_active, sort_order, created_at, updated_at, received_at)
    VALUES (r.org_id, r.status, r.is_active, 0, r.created_at, NOW(), r.received_at)
    RETURNING id INTO new_order_id;

    UPDATE purchase_order_items
      SET purchase_order_id = new_order_id,
          sort_order = 0
      WHERE id = r.item_id;
  END LOOP;

  -- Make sure remaining OPEN order items have a single, stable sort order.
  UPDATE purchase_order_items poi
  SET sort_order = 0
  FROM purchase_orders po
  WHERE
    poi.purchase_order_id = po.id
    AND po.is_active = 1
    AND po.status = 'OPEN';

  -- Re-rank purchase orders per org so list ordering is stable after the split.
  WITH ranked AS (
    SELECT
      id,
      row_number() OVER (PARTITION BY org_id ORDER BY created_at, id) - 1 AS rn
    FROM purchase_orders
    WHERE is_active = 1
  )
  UPDATE purchase_orders po
  SET sort_order = ranked.rn
  FROM ranked
  WHERE po.id = ranked.id;
END $$;

