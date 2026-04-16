ALTER TABLE products
  ADD COLUMN IF NOT EXISTS color_variants jsonb NOT NULL DEFAULT '[]'::jsonb;
