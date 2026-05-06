DO $$ BEGIN
  CREATE TYPE sale_discount_type AS ENUM ('PERCENT', 'AMOUNT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE sale_items
ADD COLUMN IF NOT EXISTS discount_type sale_discount_type NOT NULL DEFAULT 'PERCENT';

ALTER TABLE sale_items
ADD COLUMN IF NOT EXISTS discount_value numeric(12, 2) NOT NULL DEFAULT 0;

