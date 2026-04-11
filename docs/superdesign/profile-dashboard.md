# Modern User Profile Dashboard — Implementation Plan

Design source (Superdesign):
- Project ID: `21d52299-25e8-4105-83a3-98cf502063ba`
- Draft ID: `a6c6b70b-f4ec-47d0-93f3-e64f2d0552c8`
- Local snapshot: `.superdesign/drafts/a6c6b70b-f4ec-47d0-93f3-e64f2d0552c8.html`
- Re-fetch HTML: `superdesign get-design --draft-id a6c6b70b-f4ec-47d0-93f3-e64f2d0552c8 --output .superdesign/drafts/a6c6b70b-f4ec-47d0-93f3-e64f2d0552c8.html`

## Goal
Update the existing `/profile` page (`client/src/pages/Profile.tsx`) to match the “Modern User Profile Dashboard” draft **using our current design system** (`.superdesign/design-system.md`) and existing shadcn-style components (Card, Button, Badge, Avatar, Input, Label, Alert, Separator).

## Current state (codebase)
- Route already exists: `/profile` in `client/src/App.tsx`.
- Page exists: `client/src/pages/Profile.tsx` with:
  - Identity card (avatar + email), file upload via `<Input type="file">`, and editable fields.
  - Data layer: `useMeProfile()` + `useUpdateMyProfile()` (`client/src/hooks/use-authz.ts`).
  - Avatar upload already implemented using Supabase Storage bucket `avatars`.

## Target UI (from draft)
Key blocks to implement:
1. **Page header**
   - Left: icon + “Meu perfil”
   - Right: status pill (“Ativo”/“Inativo”) + role pill (ADMIN/STAFF/VIEWER)
   - Secondary header: “Configurações de Perfil” + helper copy
2. **Two-column layout**
   - Left column: identity card with avatar + camera action + upload dropzone + “Permissão” summary
   - Right column: “Editar perfil” card with iconized inputs (Nome, Usuário, Avatar URL) and “Cancelar / Salvar alterações”
3. **Danger zone**
   - “Zona de Perigo” callout with “Excluir conta” action (requires backend decision)
4. **Mobile**
   - Draft shows a bottom nav; the app already uses `Layout` (sidebar + mobile sheet). We should **skip** bottom nav unless we explicitly want a second navigation pattern.

## Implementation steps (recommended order)
### 1) Extract page structure into small components
Keep `Profile.tsx` as orchestrator and split into local components for readability:
- `ProfileHeader` (header + status/role)
- `IdentityCard` (avatar, email, upload)
- `EditProfileCard` (form fields + actions)
- `DangerZone` (optional)

Recommendation: keep these components in the same file first; extract into `client/src/components/profile/*` only if it starts to grow.

### 2) Bring styling closer to the draft using existing tokens
Replace hardcoded slate/orange classes from the HTML draft with our tokens:
- Backgrounds: `bg-background`, `bg-card`, `bg-muted/…`
- Borders: `border`, `border-card-border`, `border-muted-border`
- Emphasis: `text-foreground`, `text-muted-foreground`, `bg-primary/10`, `text-primary`

Use the existing “icon inside input” pattern from `client/src/pages/Login.tsx` (relative wrapper + `lucide-react` icon + `pl-10`).

### 3) Badge variants to support “Ativo” pill
Draft uses a “success” (green) pill. Options:
- Add `success` variant in `client/src/components/ui/badge.tsx` (preferred to avoid repeated emerald classes).
- Or keep `Badge` and pass `className="bg-emerald-50 text-emerald-700 …"` locally (fast, but less consistent).

### 4) Avatar upload UX (dropzone-style)
Keep the existing Supabase upload logic, but swap the UI for:
- A dashed drop area that triggers file picker (simple `<label>` wrapper).
- Optional “camera” button overlay on avatar (it can just trigger the same file input).

Edge cases to preserve:
- `!hasSupabaseEnv` guard
- file type/size validation (already in place)
- loading state for upload (`isUploading`)

### 5) Form actions
Draft includes “Cancelar” and “Salvar alterações”.
- “Cancelar”: reset to `initial` state and clear any local validation errors.
- “Salvar”: keep `useUpdateMyProfile()` and show pending state.

Keep the existing error state UI (Alert) but restyle to match the new page header spacing.

### 6) Danger zone (decision required)
Draft has “Excluir conta”. Today we don’t have an endpoint/hook for deletion.
Pick one:
- **Hide** the section for now (recommended until backend exists), or
- Show it as disabled + tooltip “Ainda não disponível”, or
- Implement backend + hook:
  - `DELETE /api/me` (or similar) to remove user profile and revoke access
  - Supabase auth user deletion constraints must be clarified (admin privileges, service role key, etc.)

## Acceptance checklist
- Matches draft layout at common breakpoints (mobile, md, lg).
- No new fonts/CDN scripts; uses the app’s Tailwind + tokens.
- Loading/error states remain clear and don’t “jump” layout.
- Upload works as before (Supabase configured + bucket `avatars`).
- Keyboard/tab navigation works (file picker, buttons, inputs).

## Follow-ups (nice-to-have)
- Update `.superdesign/init/routes.md` and `.superdesign/init/pages.md` to include `/profile` so future Superdesign iterations get the correct dependency tree.
