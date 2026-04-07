# Extractable Components

## Layout
- Source: `client/src/components/Layout.tsx`
- Category: layout
- Description: App shell with responsive sidebar, mobile sheet navigation, and a padded content area that animates into view.
- Extractable props:
  - `hideMobileMenu` (boolean, default: false)
  - `fullBleed` (boolean, default: false)
  - `innerClassName` (string, default: undefined)
- Hardcoded: Logo, menu labels, lucide icons, Slack-like palette, sheet trigger structure, logout button.

## StatCard
- Source: `client/src/components/StatCard.tsx`
- Category: basic
- Description: KPI card that surfaces a title, value, optional description, and icon container with theme-aware background.
- Extractable props:
  - `title` (string, default: "status")
  - `value` (string, default: "0")
  - `iconClassName` (string, default: "bg-primary/10 text-primary")
- Hardcoded: Container layout, text styles, `Card` usage.
