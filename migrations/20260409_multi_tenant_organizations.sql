-- Multi-tenant organizations (single-org per profile for now)
-- Run in Supabase SQL Editor after 20260409_user_profiles_and_rls.sql.

BEGIN;

-- 1) Organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS organizations_name_unique ON public.organizations (name);

-- 2) Helper: ensure and return default org id (for column defaults/backfills)
CREATE OR REPLACE FUNCTION public.ensure_default_org_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing uuid;
BEGIN
  SELECT id INTO existing
  FROM public.organizations
  WHERE name = 'Default'
  LIMIT 1;

  IF existing IS NOT NULL THEN
    RETURN existing;
  END IF;

  INSERT INTO public.organizations (name)
  VALUES ('Default')
  RETURNING id INTO existing;

  RETURN existing;
END;
$$;

-- 3) Add org_id to profiles and ERP tables (default to Default org)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS org_id uuid;

UPDATE public.profiles
SET org_id = public.ensure_default_org_id()
WHERE org_id IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN org_id SET DEFAULT public.ensure_default_org_id();

ALTER TABLE public.profiles
  ALTER COLUMN org_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_org_id_fkey') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_org_id_fkey
      FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- ERP tables (best-effort idempotent)
DO $$
DECLARE
  default_org uuid;
BEGIN
  default_org := public.ensure_default_org_id();

  -- materials
  ALTER TABLE IF EXISTS public.materials ADD COLUMN IF NOT EXISTS org_id uuid;
  UPDATE public.materials SET org_id = default_org WHERE org_id IS NULL;
  ALTER TABLE public.materials ALTER COLUMN org_id SET DEFAULT public.ensure_default_org_id();
  ALTER TABLE public.materials ALTER COLUMN org_id SET NOT NULL;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'materials_org_id_fkey') THEN
    ALTER TABLE public.materials ADD CONSTRAINT materials_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;
  END IF;
  CREATE INDEX IF NOT EXISTS materials_org_id_idx ON public.materials (org_id);

  -- products
  ALTER TABLE IF EXISTS public.products ADD COLUMN IF NOT EXISTS org_id uuid;
  UPDATE public.products SET org_id = default_org WHERE org_id IS NULL;
  ALTER TABLE public.products ALTER COLUMN org_id SET DEFAULT public.ensure_default_org_id();
  ALTER TABLE public.products ALTER COLUMN org_id SET NOT NULL;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_org_id_fkey') THEN
    ALTER TABLE public.products ADD CONSTRAINT products_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;
  END IF;
  CREATE INDEX IF NOT EXISTS products_org_id_idx ON public.products (org_id);

  -- boms
  ALTER TABLE IF EXISTS public.boms ADD COLUMN IF NOT EXISTS org_id uuid;
  UPDATE public.boms SET org_id = default_org WHERE org_id IS NULL;
  ALTER TABLE public.boms ALTER COLUMN org_id SET DEFAULT public.ensure_default_org_id();
  ALTER TABLE public.boms ALTER COLUMN org_id SET NOT NULL;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'boms_org_id_fkey') THEN
    ALTER TABLE public.boms ADD CONSTRAINT boms_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;
  END IF;
  CREATE INDEX IF NOT EXISTS boms_org_id_idx ON public.boms (org_id);

  -- bom_items
  ALTER TABLE IF EXISTS public.bom_items ADD COLUMN IF NOT EXISTS org_id uuid;
  UPDATE public.bom_items SET org_id = default_org WHERE org_id IS NULL;
  ALTER TABLE public.bom_items ALTER COLUMN org_id SET DEFAULT public.ensure_default_org_id();
  ALTER TABLE public.bom_items ALTER COLUMN org_id SET NOT NULL;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bom_items_org_id_fkey') THEN
    ALTER TABLE public.bom_items ADD CONSTRAINT bom_items_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;
  END IF;
  CREATE INDEX IF NOT EXISTS bom_items_org_id_idx ON public.bom_items (org_id);

  -- produced_product_stocks
  ALTER TABLE IF EXISTS public.produced_product_stocks ADD COLUMN IF NOT EXISTS org_id uuid;
  UPDATE public.produced_product_stocks SET org_id = default_org WHERE org_id IS NULL;
  ALTER TABLE public.produced_product_stocks ALTER COLUMN org_id SET DEFAULT public.ensure_default_org_id();
  ALTER TABLE public.produced_product_stocks ALTER COLUMN org_id SET NOT NULL;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'produced_product_stocks_org_id_fkey') THEN
    ALTER TABLE public.produced_product_stocks ADD CONSTRAINT produced_product_stocks_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;
  END IF;
  CREATE INDEX IF NOT EXISTS produced_product_stocks_org_id_idx ON public.produced_product_stocks (org_id);

  -- production_orders
  ALTER TABLE IF EXISTS public.production_orders ADD COLUMN IF NOT EXISTS org_id uuid;
  UPDATE public.production_orders SET org_id = default_org WHERE org_id IS NULL;
  ALTER TABLE public.production_orders ALTER COLUMN org_id SET DEFAULT public.ensure_default_org_id();
  ALTER TABLE public.production_orders ALTER COLUMN org_id SET NOT NULL;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'production_orders_org_id_fkey') THEN
    ALTER TABLE public.production_orders ADD CONSTRAINT production_orders_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;
  END IF;
  CREATE INDEX IF NOT EXISTS production_orders_org_id_idx ON public.production_orders (org_id);

  -- sales
  ALTER TABLE IF EXISTS public.sales ADD COLUMN IF NOT EXISTS org_id uuid;
  UPDATE public.sales SET org_id = default_org WHERE org_id IS NULL;
  ALTER TABLE public.sales ALTER COLUMN org_id SET DEFAULT public.ensure_default_org_id();
  ALTER TABLE public.sales ALTER COLUMN org_id SET NOT NULL;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_org_id_fkey') THEN
    ALTER TABLE public.sales ADD CONSTRAINT sales_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;
  END IF;
  CREATE INDEX IF NOT EXISTS sales_org_id_idx ON public.sales (org_id);

  -- sale_items
  ALTER TABLE IF EXISTS public.sale_items ADD COLUMN IF NOT EXISTS org_id uuid;
  UPDATE public.sale_items SET org_id = default_org WHERE org_id IS NULL;
  ALTER TABLE public.sale_items ALTER COLUMN org_id SET DEFAULT public.ensure_default_org_id();
  ALTER TABLE public.sale_items ALTER COLUMN org_id SET NOT NULL;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sale_items_org_id_fkey') THEN
    ALTER TABLE public.sale_items ADD CONSTRAINT sale_items_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;
  END IF;
  CREATE INDEX IF NOT EXISTS sale_items_org_id_idx ON public.sale_items (org_id);

  -- inventory_movements
  ALTER TABLE IF EXISTS public.inventory_movements ADD COLUMN IF NOT EXISTS org_id uuid;
  UPDATE public.inventory_movements SET org_id = default_org WHERE org_id IS NULL;
  ALTER TABLE public.inventory_movements ALTER COLUMN org_id SET DEFAULT public.ensure_default_org_id();
  ALTER TABLE public.inventory_movements ALTER COLUMN org_id SET NOT NULL;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_movements_org_id_fkey') THEN
    ALTER TABLE public.inventory_movements ADD CONSTRAINT inventory_movements_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;
  END IF;
  CREATE INDEX IF NOT EXISTS inventory_movements_org_id_idx ON public.inventory_movements (org_id);

  -- purchase_orders
  ALTER TABLE IF EXISTS public.purchase_orders ADD COLUMN IF NOT EXISTS org_id uuid;
  UPDATE public.purchase_orders SET org_id = default_org WHERE org_id IS NULL;
  ALTER TABLE public.purchase_orders ALTER COLUMN org_id SET DEFAULT public.ensure_default_org_id();
  ALTER TABLE public.purchase_orders ALTER COLUMN org_id SET NOT NULL;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_orders_org_id_fkey') THEN
    ALTER TABLE public.purchase_orders ADD CONSTRAINT purchase_orders_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;
  END IF;
  CREATE INDEX IF NOT EXISTS purchase_orders_org_id_idx ON public.purchase_orders (org_id);

  -- purchase_order_items
  ALTER TABLE IF EXISTS public.purchase_order_items ADD COLUMN IF NOT EXISTS org_id uuid;
  UPDATE public.purchase_order_items SET org_id = default_org WHERE org_id IS NULL;
  ALTER TABLE public.purchase_order_items ALTER COLUMN org_id SET DEFAULT public.ensure_default_org_id();
  ALTER TABLE public.purchase_order_items ALTER COLUMN org_id SET NOT NULL;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_order_items_org_id_fkey') THEN
    ALTER TABLE public.purchase_order_items ADD CONSTRAINT purchase_order_items_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;
  END IF;
  CREATE INDEX IF NOT EXISTS purchase_order_items_org_id_idx ON public.purchase_order_items (org_id);
END $$;

COMMIT;

