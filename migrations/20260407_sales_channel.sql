-- Add sales_channel column to sales so we can keep channel data with each sale.

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS sales_channel production_order_sales_channel NOT NULL DEFAULT 'ONLINE';
