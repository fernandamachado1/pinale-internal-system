-- User profiles + roles + RLS hardening for Supabase
-- Safe to run multiple times (best-effort idempotent guards).

BEGIN;

-- 1) Role enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('ADMIN', 'STAFF', 'VIEWER');
  END IF;
END $$;

-- 2) Profiles table (1:1 with auth.users when available)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY,
  email text,
  username text,
  display_name text,
  avatar_url text,
  role user_role NOT NULL DEFAULT 'VIEWER'::user_role,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique ON public.profiles (username);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'auth' AND table_name = 'users'
  ) THEN
    -- Add FK if missing.
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'profiles_id_auth_users_fkey'
    ) THEN
      ALTER TABLE public.profiles
        ADD CONSTRAINT profiles_id_auth_users_fkey
        FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- 3) Helper: admin check (security definer to avoid RLS pitfalls)
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = uid
      AND p.role = 'ADMIN'::user_role
      AND p.is_active = true
  );
$$;

-- 4) Trigger: keep updated_at and prevent non-admin privilege escalation
CREATE OR REPLACE FUNCTION public.profiles_before_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = OLD.id AND NOT public.is_admin(auth.uid()) THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Cannot change role';
    END IF;
    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'Cannot change is_active';
    END IF;
  END IF;

  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'profiles_before_update_trg'
  ) THEN
    CREATE TRIGGER profiles_before_update_trg
      BEFORE UPDATE ON public.profiles
      FOR EACH ROW
      EXECUTE FUNCTION public.profiles_before_update();
  END IF;
END $$;

-- 5) Trigger: create profile row when auth user is created (Supabase only)
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, now(), now())
  ON CONFLICT (id) DO UPDATE
    SET email = COALESCE(EXCLUDED.email, public.profiles.email),
        updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'auth' AND table_name = 'users'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'on_auth_user_created'
    ) THEN
      CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
    END IF;
  END IF;
END $$;

-- 6) RLS policies for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_select') THEN
    CREATE POLICY profiles_select
      ON public.profiles
      FOR SELECT
      USING (auth.uid() = id OR public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_update') THEN
    CREATE POLICY profiles_update
      ON public.profiles
      FOR UPDATE
      USING (auth.uid() = id OR public.is_admin(auth.uid()))
      WITH CHECK (auth.uid() = id OR public.is_admin(auth.uid()));
  END IF;
END $$;

-- 7) Harden ERP tables against direct browser access via Supabase client (RLS enabled, no policies)
ALTER TABLE IF EXISTS public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.boms ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bom_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.produced_product_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.purchase_order_items ENABLE ROW LEVEL SECURITY;

COMMIT;

