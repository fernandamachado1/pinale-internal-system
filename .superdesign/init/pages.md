# Page Dependency Trees

## /login
Entry: `client/src/pages/Login.tsx`
Dependencies:
- `client/src/pages/Login.tsx`
  - `client/src/hooks/use-toast.ts`
    - `client/src/components/ui/toast.tsx`
  - `client/src/components/ui/card.tsx`
  - `client/src/components/ui/label.tsx`
  - `client/src/components/ui/input.tsx`
  - `client/src/components/ui/button.tsx`
  - `client/src/lib/supabase.ts`

## /
Entry: `client/src/pages/Dashboard.tsx`
Dependencies:
- `client/src/pages/Dashboard.tsx`
  - `client/src/components/Layout.tsx`
  - `client/src/components/StatCard.tsx`
    - `client/src/components/ui/card.tsx`
  - `client/src/hooks/use-erp.ts`
  - `client/src/hooks/use-mobile.tsx`
  - `client/src/components/ui/card.tsx`
  - `client/src/components/ui/chart.tsx`
  - `client/src/components/ui/button.tsx`
  - `client/src/components/ui/calendar.tsx`
  - `client/src/components/ui/popover.tsx`
  - `client/src/components/ui/alert.tsx`
  - `client/src/components/ui/skeleton.tsx`
  - `client/src/lib/format.ts`
  - `client/src/lib/utils.ts`
