# Pinale ERP Design System

## Brand Context
Pinale is an atelier-focused ERP. The UI should feel professional yet warm, balancing ivory backgrounds with the bold orange of the Pinale icon so that designers feel confident organizing production data.

## Colors
| Token | Value | Use |
| --- | --- | --- |
| `--background` | `#F1F1F6` (HSL 231 27% 96%) | Page surfaces, default canvas
| `--foreground` | `#050505` (HSL 222.2 84% 4.9%) | Primary text
| `--primary` | `#F8931F` (HSL 32 93% 55%) | Accent buttons, highlights
| `--secondary` | `#D5E5F5` (HSL 210 40% 96.1%) | Secondary buttons, cards
| `--muted` | `#D5E5F5` | Muted labels, dividers
| `--card` | `#FFFFFF` | Card backgrounds
| `--border` | `#D6D6E8` (HSL 214 24% 86%) | Borders and outlines
| `--sidebar` | `#F7F5F0` | Fixed sidebar background

## Typography
- Font stack: `var(--font-sans)` → ‘Inter’/system sans. Bold for headings, medium for labels, regular for body copy.
- `card` titles use `text-2xl font-semibold`, descriptions `text-sm`, buttons `text-sm font-medium`.

## Spacing
- Base gap increments: 6 px / 0.375 rem, 8 px / 0.5 rem, 24 px / 1.5 rem.
- Inputs/h buttons are 36-40 px tall, cards use 24 px padding.

## Elevation & Radius
- Standard border radius: `0.5rem` for cards, `0.375rem` smaller elements, `0.1875rem` for tiny controls.
- Shadows: soft `shadow-sm` default, `shadow-md` on hover for CTA cards.

## Layout Patterns
- Sidebar: fixed 64px wide, uses icon-label pairings with 18px lucide icons.
- Content area: `max-w-7xl mx-auto gap-6`, `px-4 py-6` inside layout wrapper.
- Responsive: mobile sheet triggered by menu icon, drawer uses 16 px padding.

## Component Tokens
- Buttons: `rounded-md`, `gap-2`, `px-4 py-2`, `hover-elevate`, `focus-visible:ring-1 ring-ring`.
- Inputs: `h-9`, `px-3 py-2`, `rounded-md`, `border-input`, focus ring `ring-2 ring-ring`.
- Cards: `rounded-xl`, `border-card-border`, `bg-card`, `shadow-sm`, header padding `p-6`.

## Motion
- Animate-in classes: `animate-in fade-in duration-500 slide-in-from-bottom-2` for page containers.
- Button interactions rely on `hover-elevate active-elevate-2` utilities defined in CSS.
