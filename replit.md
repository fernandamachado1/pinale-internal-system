# Nexus ERP – Ateliê Pinale

## Overview

Nexus ERP is an internal management system built for Ateliê Pinale, a small artisan workshop. It replaces manual paper-and-pen tracking with a centralized web application for managing materials (insumos), products (artigos), production orders, sales, and inventory movements. The entire UI is localized in Brazilian Portuguese (pt-BR).

The system is a full-stack TypeScript monorepo with a React frontend, Express backend, and PostgreSQL database. It follows an MVP scope focused on five core modules: Materials, Products (with technical specs/recipes), Production, Sales, and Inventory Movements. A dashboard aggregates key metrics and charts.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Monorepo Structure

```
client/          → React SPA (Vite)
server/          → Express API server
shared/          → Shared schema, types, and route definitions
migrations/      → Drizzle-generated migration files
script/          → Build tooling
attached_assets/ → Requirements documents
```

### Frontend (client/)

- **Framework**: React 18 with TypeScript
- **Bundler**: Vite with HMR support via a dev middleware proxy
- **Routing**: Wouter (lightweight client-side router)
- **State/Data**: TanStack Query v5 for server state management
- **UI Components**: Shadcn UI (new-york style) built on Radix UI primitives with Tailwind CSS
- **Charts**: Recharts for dashboard visualizations
- **Icons**: Lucide React
- **Dates**: date-fns with pt-BR locale
- **Design system**: Custom CSS variables for theming (light/dark mode support), two font families (Inter for body, Outfit for display headings)

**Key patterns:**
- All pages wrap content in a `<Layout>` component that provides sidebar navigation
- Custom hooks in `client/src/hooks/use-erp.ts` encapsulate all API calls using TanStack Query mutations and queries
- The `@shared/routes` module defines API paths and Zod schemas used by both client and server, ensuring type safety across the stack
- Path aliases: `@/` → `client/src/`, `@shared/` → `shared/`

### Backend (server/)

- **Framework**: Express 5 on Node.js
- **Language**: TypeScript, run with `tsx` in development
- **API design**: RESTful JSON API under `/api/` prefix
- **Route definitions**: Centralized in `shared/routes.ts` with Zod input validation schemas
- **Storage layer**: `server/storage.ts` defines an `IStorage` interface implemented with direct Drizzle ORM queries — this abstraction allows swapping implementations
- **Dev server**: Vite middleware is attached to the Express server for HMR in development; in production, static files are served from `dist/public`

### Database

- **Database**: PostgreSQL (required, via `DATABASE_URL` environment variable)
- **ORM**: Drizzle ORM with `drizzle-zod` for automatic Zod schema generation from table definitions
- **Schema location**: `shared/schema.ts` — single source of truth for all table definitions, relations, and insert/update schemas
- **Schema push**: `npm run db:push` uses `drizzle-kit push` to sync schema to database (no migration files needed for development)
- **Connection**: `pg.Pool` from the `pg` package, configured in `server/db.ts`

**Database tables:**
- `materials` — Raw materials/supplies with name, unit, and quantity
- `products` — Finished goods with name, price, and stock quantity
- `technical_specs` — Join table linking products to materials with required quantities (recipe/bill of materials)
- `productions` — Production orders recording what was produced and how many
- `sales` — Sale records with product, quantity, payment method, and total price
- `inventory_movements` — Audit log of all stock changes (entries, exits, adjustments) for both materials and products

**Key relationships:**
- Products have many technical specs (recipe ingredients)
- Technical specs reference both a product and a material
- Productions and sales reference a product
- Inventory movements track changes to both materials and products

### Build Process

- **Development**: `npm run dev` — runs Express + Vite dev server via `tsx`
- **Production build**: `npm run build` — Vite builds the client to `dist/public`, esbuild bundles the server to `dist/index.cjs`
- **Production start**: `npm start` — runs the bundled server which serves static files

### API Structure

All API routes follow the pattern `/api/{resource}` and are defined in `shared/routes.ts`:

- `GET /api/materials` — List all materials
- `GET /api/materials/:id` — Get single material
- `POST /api/materials` — Create material
- `PUT /api/materials/:id` — Update material
- `POST /api/materials/:id/adjust` — Adjust material stock
- `GET /api/products` — List products with technical specs
- `GET /api/products/:id` — Get product with specs
- `POST /api/products` — Create product with specs
- `PUT /api/products/:id` — Update product
- `GET /api/productions` — List productions with product details
- `POST /api/productions` — Create production (auto-deducts materials, increases product stock)
- `GET /api/sales` — List sales with product details
- `POST /api/sales` — Create sale (auto-deducts product stock)
- `GET /api/movements` — List all inventory movements

## External Dependencies

### Required Services
- **PostgreSQL**: Primary database, connected via `DATABASE_URL` environment variable. Must be provisioned before the app can start.

### Key NPM Packages
- **drizzle-orm** + **drizzle-kit** + **drizzle-zod**: Database ORM, schema management, and Zod integration
- **express** (v5): HTTP server framework
- **pg**: PostgreSQL client driver
- **connect-pg-simple**: PostgreSQL session store (available but sessions not yet implemented)
- **zod**: Runtime validation for API inputs and shared type definitions
- **@tanstack/react-query**: Server state management on the client
- **recharts**: Dashboard charting library
- **date-fns**: Date formatting and manipulation
- **wouter**: Client-side routing
- **Radix UI** (multiple packages): Accessible UI primitives for Shadcn components
- **tailwindcss**: Utility-first CSS framework
- **vite**: Frontend build tool and dev server
- **tsx**: TypeScript execution for Node.js
- **esbuild**: Server bundling for production