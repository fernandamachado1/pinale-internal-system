ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS stock_tracked boolean NOT NULL DEFAULT true;
