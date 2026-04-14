-- Push subscription storage (Web Push) + RLS hardening
-- Safe to run multiple times (best-effort idempotent guards).

BEGIN;

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id serial PRIMARY KEY,
  org_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  endpoint text NOT NULL,
  subscription jsonb NOT NULL,
  user_agent text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_endpoint_unique
  ON public.push_subscriptions (endpoint);

-- Harden against direct browser access via Supabase client (RLS enabled, no policies).
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

COMMIT;

