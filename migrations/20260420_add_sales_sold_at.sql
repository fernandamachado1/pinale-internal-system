ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS sold_at timestamp;

UPDATE sales
SET sold_at = created_at
WHERE sold_at IS NULL;

ALTER TABLE sales
  ALTER COLUMN sold_at SET NOT NULL,
  ALTER COLUMN sold_at SET DEFAULT now();
