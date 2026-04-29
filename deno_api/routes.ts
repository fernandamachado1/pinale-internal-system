import type { Hono } from "npm:hono";
import { createClient } from "npm:@supabase/supabase-js@2.101.1";
import { api } from "../shared/routes.ts";
import { DrizzleErpRepository } from "../server/infra/repositories/drizzle-erp-repository.ts";
import { initDb } from "./db.ts";
import { getSupabaseConfig, requireSupabaseUser } from "./auth.ts";
import { ensureProfile, requireRole } from "./authz.ts";
import { ApiError, toErrorResponse } from "./errors.ts";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { profiles, pushSubscriptions, type Profile, type UserRole } from "../shared/schema.ts";
import { getVapidPublicKey, isPushConfigured, sendWebPush, type WebPushSubscription } from "./push.ts";
import {
  CreateMaterialUseCase,
  CreateManyMaterialsUseCase,
  DeleteMaterialUseCase,
  GetMaterialUseCase,
  ListMaterialsUseCase,
  UpdateMaterialUseCase,
} from "../server/application/use-cases/material-use-cases.ts";
import {
  CreateProductUseCase,
  DeleteProductUseCase,
  GetProductUseCase,
  ListCatalogProductsUseCase,
  ListProductsUseCase,
  UpdateProductUseCase,
} from "../server/application/use-cases/product-use-cases.ts";
import {
  CreateProductionOrderUseCase,
  DeleteProductionOrderUseCase,
  GetProductionOrderUseCase,
  ListProductionOrdersUseCase,
  MoveProductionOrderUseCase,
  MarkProductionOrderDeliveredUseCase,
  UpdateProductionOrderFinancialsUseCase,
  UpdateProductionOrderUseCase,
} from "../server/application/use-cases/production-use-cases.ts";
import {
  AdjustProducedStockUseCase,
  ListProducedProductStockSummaryUseCase,
  ListProducedProductStocksUseCase,
  RegisterInitialProducedStockUseCase,
} from "../server/application/use-cases/produced-product-stock-use-cases.ts";
import { ListInventoryMovementsUseCase } from "../server/application/use-cases/inventory-movement-use-cases.ts";
import { CreateSaleUseCase } from "../server/application/use-cases/create-sale-use-case.ts";
import { GetSaleUseCase, ListSalesUseCase } from "../server/application/use-cases/sale-use-cases.ts";
import { CompleteProductionUseCase } from "../server/application/use-cases/complete-production-use-case.ts";
import {
  CancelPurchaseOrderUseCase,
  CreatePurchaseOrderUseCase,
  GetPurchaseOrderUseCase,
  ListPurchaseOrdersUseCase,
  ReorderPurchaseOrdersUseCase,
  ReceivePurchaseOrderUseCase,
  UpdatePurchaseOrderUseCase,
} from "../server/application/use-cases/purchase-order-use-cases.ts";
import {
  DashboardReportUseCase,
  LeatherConsumptionReportUseCase,
  ProductionReportUseCase,
  SalesReportUseCase,
} from "../server/application/use-cases/report-use-cases.ts";

export type AppVariables = {
  user: { id: string; email?: string | null };
  profile: Profile;
};

async function repositoryForOrg(orgId: string): Promise<DrizzleErpRepository> {
  const { db } = await initDb();
  return new DrizzleErpRepository(db, orgId);
}

async function notifyPurchaseOrderCreated(orgId: string, purchaseOrder: any): Promise<void> {
  if (!isPushConfigured()) return;

  const { db } = await initDb();
  const subs = await db
    .select({
      id: pushSubscriptions.id,
      subscription: pushSubscriptions.subscription,
    })
    .from(pushSubscriptions)
    .innerJoin(profiles, and(eq(profiles.id, pushSubscriptions.profileId), eq(profiles.orgId, orgId)))
    .where(
      and(
        eq(pushSubscriptions.orgId, orgId),
        eq(profiles.isActive, true),
        inArray(profiles.role, ["ADMIN", "STAFF"]),
      ),
    );

  if (subs.length === 0) return;

  const itemCount = Array.isArray(purchaseOrder?.items) ? purchaseOrder.items.length : 0;
  const payload = {
    title: "Novo pedido de compra",
    body: `Pedido #${purchaseOrder?.id ?? "—"} criado (${itemCount} ${itemCount === 1 ? "item" : "itens"})`,
    data: { url: "/purchase-orders", purchaseOrderId: purchaseOrder?.id },
  };

  await Promise.allSettled(
    subs.map(async (row) => {
      const result = await sendWebPush(row.subscription as WebPushSubscription, payload);
      if (!result.ok && (result.statusCode === 404 || result.statusCode === 410)) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, row.id));
      }
    }),
  );
}

function periodFromQuery(query: Record<string, string | string[] | undefined>): { from?: Date; to?: Date } {
  const fromValue = typeof query.from === "string" ? query.from : undefined;
  const toValue = typeof query.to === "string" ? query.to : undefined;
  return {
    from: fromValue ? new Date(fromValue) : undefined,
    to: toValue ? new Date(toValue) : undefined,
  };
}

export function registerApiRoutes(app: Hono<{ Variables: AppVariables }>) {
  // Basic health endpoint (no auth) for debugging connectivity.
  app.get("/api/health", (c) => c.json({ ok: true }, 200));
  app.get("/api/health/env", (c) =>
    c.json(
      {
        ok: true,
        hasDatabaseUrl: Boolean(Deno.env.get("DATABASE_URL")),
        hasSupabaseUrl: Boolean(Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL")),
        hasSupabaseAnonKey: Boolean(Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("VITE_SUPABASE_ANON_KEY")),
      },
      200,
    ),
  );
  app.get("/api/health/static", async (c) => {
    const indexHtmlPath = `${Deno.cwd()}/dist/public/index.html`;
    try {
      await Deno.stat(indexHtmlPath);
      return c.json({ ok: true, hasStaticBuild: true, indexHtmlPath }, 200);
    } catch {
      return c.json({ ok: true, hasStaticBuild: false, indexHtmlPath }, 200);
    }
  });
  app.get("/api/health/db", async (c) => {
    try {
      const { db } = await initDb();
      await db.execute(sql`select 1`);
      return c.json({ ok: true }, 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json({ ok: false, ...body }, status);
    }
  });
  app.get("/api/health/dbinfo", async (c) => {
    const { info } = await initDb();
    return c.json({ ok: true, ...info }, 200);
  });
  app.get("/api/health/net", async (c) => {
    try {
      const host = (await initDb()).info.host;
      const [a, aaaa] = await Promise.allSettled([
        Deno.resolveDns(host, "A"),
        Deno.resolveDns(host, "AAAA"),
      ]);
      return c.json(
        {
          ok: true,
          host,
          hasA: a.status === "fulfilled" && a.value.length > 0,
          hasAAAA: aaaa.status === "fulfilled" && aaaa.value.length > 0,
          a: a.status === "fulfilled" ? a.value : null,
          aaaa: aaaa.status === "fulfilled" ? aaaa.value : null,
        },
        200,
      );
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json({ ok: false, ...body }, status);
    }
  });

  app.use("/api/*", async (c, next) => {
    try {
      if (c.req.path === "/api/health") {
        return await next();
      }
      if (c.req.path === "/api/health/env") {
        return await next();
      }
      if (c.req.path === "/api/health/static") {
        return await next();
      }
      if (c.req.path === "/api/health/db") {
        return await next();
      }
      if (c.req.path === "/api/health/dbinfo") {
        return await next();
      }
      if (c.req.path === "/api/health/net") {
        return await next();
      }
      const debugPerf = Deno.env.get("DEBUG_PERF") === "true";
      const t0 = debugPerf ? performance.now() : 0;
      const user = await requireSupabaseUser(c.req.header("Authorization"));
      const t1 = debugPerf ? performance.now() : 0;
      c.set("user", user);
      const { db } = await initDb();
      const t2 = debugPerf ? performance.now() : 0;
      const profile = await ensureProfile(db, user);
      const t3 = debugPerf ? performance.now() : 0;
      c.set("profile", profile);

      if (debugPerf) {
        const authMs = t1 - t0;
        const dbMs = t2 - t1;
        const profileMs = t3 - t2;
        c.header(
          "Server-Timing",
          `auth;dur=${authMs.toFixed(1)},db;dur=${dbMs.toFixed(1)},profile;dur=${profileMs.toFixed(1)}`,
        );
      }
      await next();
    } catch (err) {
      if (err instanceof Error && err.message === "UNAUTHORIZED") {
        return c.json({ message: "Unauthorized" }, 401);
      }
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.use("/api/*", async (c, next) => {
    const path = c.req.path;
    const method = c.req.method.toUpperCase();
    if (path.startsWith("/api/health")) {
      return await next();
    }

    const profile = c.get("profile");

    // Self-service profile endpoints (any active user).
    if (path === api.me.profile.get.path || path === api.me.profile.update.path) {
      return await next();
    }

    if (path === "/api/whoami") {
      return await next();
    }

    // Push notifications: any active user can opt-in/out.
    if (path === api.push.publicKey.path || path === api.push.subscribe.path || path === api.push.unsubscribe.path) {
      return await next();
    }

    if (path.startsWith("/api/admin/")) {
      requireRole(profile, ["ADMIN"]);
      return await next();
    }

    // Default ERP authz: GET is readable; everything else requires write access.
    if (method === "GET") {
      requireRole(profile, ["VIEWER", "STAFF", "ADMIN"]);
      return await next();
    }

    requireRole(profile, ["STAFF", "ADMIN"]);
    return await next();
  });

  app.get("/api/whoami", (c) => c.json({ ...c.get("user"), profile: c.get("profile") }, 200));

  // Push notifications
  app.get(api.push.publicKey.path, (c) => {
    try {
      return c.json({ publicKey: getVapidPublicKey() }, 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.post(api.push.subscribe.path, async (c) => {
    try {
      const input = api.push.subscribe.input.parse(await c.req.json());
      const profile = c.get("profile");
      const { db } = await initDb();
      const userAgent = c.req.header("User-Agent") ?? null;
      const now = new Date();

      await db
        .insert(pushSubscriptions)
        .values({
          orgId: profile.orgId,
          profileId: profile.id,
          endpoint: input.endpoint,
          subscription: input,
          userAgent,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: pushSubscriptions.endpoint,
          set: {
            orgId: profile.orgId,
            profileId: profile.id,
            subscription: input,
            userAgent,
            updatedAt: now,
          },
        });

      return c.body(null, 204);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.post(api.push.unsubscribe.path, async (c) => {
    try {
      const input = api.push.unsubscribe.input.parse(await c.req.json());
      const profile = c.get("profile");
      const { db } = await initDb();

      await db
        .delete(pushSubscriptions)
        .where(and(eq(pushSubscriptions.orgId, profile.orgId), eq(pushSubscriptions.profileId, profile.id), eq(pushSubscriptions.endpoint, input.endpoint)));

      return c.body(null, 204);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  // Me
  app.get(api.me.profile.get.path, (c) => c.json(c.get("profile"), 200));
  app.patch(api.me.profile.update.path, async (c) => {
    try {
      const input = api.me.profile.update.input.parse(await c.req.json());
      const user = c.get("user");
      const currentProfile = c.get("profile");
      const { db } = await initDb();

      const updates: Record<string, unknown> = {};
      if (input.displayName !== undefined) updates.displayName = input.displayName;
      if (input.avatarUrl !== undefined) updates.avatarUrl = input.avatarUrl;
      if (input.username !== undefined) updates.username = input.username;
      // Keep email mirrored when available.
      if (user.email) updates.email = user.email;

      const [updated] = (await db
        .update(profiles)
        .set({ ...updates, updatedAt: new Date() })
        .where(and(eq(profiles.id, user.id), eq(profiles.orgId, currentProfile.orgId)))
        .returning()) as Profile[];

      return c.json(updated ?? c.get("profile"), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  // Admin - Users
  app.get(api.admin.users.list.path, async (c) => {
    try {
      const { db } = await initDb();
      const orgId = c.get("profile").orgId;
      const items = (await db
        .select()
        .from(profiles)
        .where(eq(profiles.orgId, orgId))
        .orderBy(desc(profiles.createdAt))) as Profile[];
      return c.json(items, 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.post(api.admin.users.invite.path, async (c) => {
    try {
      const input = api.admin.users.invite.input.parse(await c.req.json());
      const orgId = c.get("profile").orgId;
      const serviceRoleKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
      if (!serviceRoleKey) throw new ApiError(500, "SUPABASE_SERVICE_ROLE_KEY must be set");

      const { url } = getSupabaseConfig();
      const admin = createClient(url, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });

      const { data, error } = await admin.auth.admin.inviteUserByEmail(input.email);
      if (error) throw new ApiError(400, error.message, "BAD_REQUEST");
      const invited = data.user;
      if (!invited?.id) throw new ApiError(500, "Invite succeeded but no user returned", "INVITE_FAILED");

      const { db } = await initDb();
      try {
        await db
          .insert(profiles)
          .values({ id: invited.id, orgId, email: invited.email ?? input.email, role: input.role as UserRole })
          .onConflictDoNothing();
      } catch {
        // ignore and update below
      }

      const [updated] = (await db
        .update(profiles)
        .set({ orgId, email: invited.email ?? input.email, role: input.role as UserRole, updatedAt: new Date() })
        .where(and(eq(profiles.id, invited.id), eq(profiles.orgId, orgId)))
        .returning()) as Profile[];

      return c.json(updated, 201);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.patch(api.admin.users.update.path, async (c) => {
    try {
      const userId = c.req.param("id");
      const input = api.admin.users.update.input.parse(await c.req.json());
      const orgId = c.get("profile").orgId;
      const isSelf = userId === c.get("profile").id;
      if (isSelf && (input.role !== undefined || input.isActive !== undefined)) {
        throw new ApiError(400, "Cannot update own role/isActive", "BAD_REQUEST");
      }
      const { db } = await initDb();

      const updates: Record<string, unknown> = {};
      if (input.role !== undefined) updates.role = input.role as UserRole;
      if (input.isActive !== undefined) updates.isActive = input.isActive;

      const [updated] = (await db
        .update(profiles)
        .set({ ...updates, updatedAt: new Date() })
        .where(and(eq(profiles.id, userId), eq(profiles.orgId, orgId)))
        .returning()) as Profile[];

      if (!updated) {
        return c.json({ message: "Not found", code: "NOT_FOUND" }, 404);
      }

      return c.json(updated, 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  // Materials
  app.get(api.materials.list.path, async (c) => {
    try {
      const useCase = new ListMaterialsUseCase(await repositoryForOrg(c.get("profile").orgId));
      return c.json(await useCase.execute(), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.get(api.materials.get.path, async (c) => {
    try {
      const useCase = new GetMaterialUseCase(await repositoryForOrg(c.get("profile").orgId));
      return c.json(await useCase.execute(Number(c.req.param("id"))), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.post(api.materials.create.path, async (c) => {
    try {
      const input = api.materials.create.input.parse(await c.req.json());
      const useCase = new CreateMaterialUseCase(await repositoryForOrg(c.get("profile").orgId));
      return c.json(await useCase.execute(input), 201);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.post(api.materials.createMany.path, async (c) => {
    try {
      const input = api.materials.createMany.input.parse(await c.req.json());
      const useCase = new CreateManyMaterialsUseCase(await repositoryForOrg(c.get("profile").orgId));
      return c.json(await useCase.execute(input), 201);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.put(api.materials.update.path, async (c) => {
    try {
      const input = api.materials.update.input.parse(await c.req.json());
      const useCase = new UpdateMaterialUseCase(await repositoryForOrg(c.get("profile").orgId));
      return c.json(await useCase.execute(Number(c.req.param("id")), input), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.delete(api.materials.delete.path, async (c) => {
    try {
      const useCase = new DeleteMaterialUseCase(await repositoryForOrg(c.get("profile").orgId));
      await useCase.execute(Number(c.req.param("id")));
      return c.body(null, 204);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  // Products
  app.get(api.products.list.path, async (c) => {
    try {
      const useCase = new ListProductsUseCase(await repositoryForOrg(c.get("profile").orgId));
      return c.json(await useCase.execute(), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.get(api.products.catalog.path, async (c) => {
    try {
      const query = api.products.catalog.query.parse(c.req.query());
      const useCase = new ListCatalogProductsUseCase(await repositoryForOrg(c.get("profile").orgId));
      return c.json(await useCase.execute(query), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.get(api.products.get.path, async (c) => {
    try {
      const useCase = new GetProductUseCase(await repositoryForOrg(c.get("profile").orgId));
      return c.json(await useCase.execute(Number(c.req.param("id"))), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.post(api.products.create.path, async (c) => {
    try {
      const input = api.products.create.input.parse(await c.req.json());
      const useCase = new CreateProductUseCase(await repositoryForOrg(c.get("profile").orgId));
      return c.json(await useCase.execute(input), 201);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.put(api.products.update.path, async (c) => {
    try {
      const input = api.products.update.input.parse(await c.req.json());
      const useCase = new UpdateProductUseCase(await repositoryForOrg(c.get("profile").orgId));
      return c.json(await useCase.execute(Number(c.req.param("id")), input), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.delete(api.products.delete.path, async (c) => {
    try {
      const useCase = new DeleteProductUseCase(await repositoryForOrg(c.get("profile").orgId));
      await useCase.execute(Number(c.req.param("id")));
      return c.body(null, 204);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  // Produced product stocks
  app.get(api.producedProductStocks.list.path, async (c) => {
    try {
      const useCase = new ListProducedProductStocksUseCase(await repositoryForOrg(c.get("profile").orgId));
      return c.json(await useCase.execute(), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.get(api.producedProductStocks.summary.path, async (c) => {
    try {
      const useCase = new ListProducedProductStockSummaryUseCase(await repositoryForOrg(c.get("profile").orgId));
      return c.json(await useCase.execute(), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.post(api.producedProductStocks.registerInitial.path, async (c) => {
    try {
      const input = api.producedProductStocks.registerInitial.input.parse(await c.req.json());
      const useCase = new RegisterInitialProducedStockUseCase(await repositoryForOrg(c.get("profile").orgId));
      return c.json(await useCase.execute(input), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.post(api.producedProductStocks.adjust.path, async (c) => {
    try {
      const input = api.producedProductStocks.adjust.input.parse(await c.req.json());
      const useCase = new AdjustProducedStockUseCase(await repositoryForOrg(c.get("profile").orgId));
      return c.json(await useCase.execute(input), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  // Production orders
  app.get(api.productionOrders.list.path, async (c) => {
    try {
      const useCase = new ListProductionOrdersUseCase(await repositoryForOrg(c.get("profile").orgId));
      return c.json(await useCase.execute(), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.get(api.productionOrders.get.path, async (c) => {
    try {
      const useCase = new GetProductionOrderUseCase(await repositoryForOrg(c.get("profile").orgId));
      return c.json(await useCase.execute(Number(c.req.param("id"))), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.post(api.productionOrders.create.path, async (c) => {
    try {
      const input = api.productionOrders.create.input.parse(await c.req.json());
      const useCase = new CreateProductionOrderUseCase(await repositoryForOrg(c.get("profile").orgId));
      return c.json(await useCase.execute(input), 201);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.put(api.productionOrders.update.path, async (c) => {
    try {
      const input = api.productionOrders.update.input.parse(await c.req.json());
      const useCase = new UpdateProductionOrderUseCase(await repositoryForOrg(c.get("profile").orgId));
      return c.json(await useCase.execute(Number(c.req.param("id")), input), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.patch(api.productionOrders.updateFinancials.path, async (c) => {
    try {
      const input = api.productionOrders.updateFinancials.input.parse(await c.req.json());
      const useCase = new UpdateProductionOrderFinancialsUseCase(await repositoryForOrg(c.get("profile").orgId));
      return c.json(await useCase.execute(Number(c.req.param("id")), input), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.post(api.productionOrders.move.path, async (c) => {
    try {
      const input = api.productionOrders.move.input.parse(await c.req.json());
      const useCase = new MoveProductionOrderUseCase(await repositoryForOrg(c.get("profile").orgId));
      return c.json(await useCase.execute(Number(c.req.param("id")), input), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.post(api.productionOrders.conclude.path, async (c) => {
    try {
      const input = api.productionOrders.conclude.input.parse(await c.req.json());
      const repo = await repositoryForOrg(c.get("profile").orgId);
      const completeUseCase = new CompleteProductionUseCase(repo);
      const getUseCase = new GetProductionOrderUseCase(repo);
      await completeUseCase.execute(Number(c.req.param("id")), input);
      return c.json(await getUseCase.execute(Number(c.req.param("id"))), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.post(api.productionOrders.deliver.path, async (c) => {
    try {
      const input = api.productionOrders.deliver.input.parse(await c.req.json());
      const repo = await repositoryForOrg(c.get("profile").orgId);
      const useCase = new MarkProductionOrderDeliveredUseCase(repo);
      const deliveredAt = input.deliveredAt ? new Date(input.deliveredAt) : new Date();
      return c.json(await useCase.execute(Number(c.req.param("id")), deliveredAt), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.delete(api.productionOrders.delete.path, async (c) => {
    try {
      const useCase = new DeleteProductionOrderUseCase(await repositoryForOrg(c.get("profile").orgId));
      await useCase.execute(Number(c.req.param("id")));
      return c.body(null, 204);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  // Sales
  app.get(api.sales.list.path, async (c) => {
    try {
      const useCase = new ListSalesUseCase(await repositoryForOrg(c.get("profile").orgId));
      return c.json(await useCase.execute(), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.get(api.sales.get.path, async (c) => {
    try {
      const useCase = new GetSaleUseCase(await repositoryForOrg(c.get("profile").orgId));
      return c.json(await useCase.execute(Number(c.req.param("id"))), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.post(api.sales.create.path, async (c) => {
    try {
      const input = api.sales.create.input.parse(await c.req.json());
      const repo = await repositoryForOrg(c.get("profile").orgId);
      const createUseCase = new CreateSaleUseCase(repo);
      const getUseCase = new GetSaleUseCase(repo);
      const result = await createUseCase.execute(input);
      return c.json(await getUseCase.execute(result.saleId), 201);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  // Inventory movements
  app.get(api.inventory.movements.path, async (c) => {
    try {
      const useCase = new ListInventoryMovementsUseCase(await repositoryForOrg(c.get("profile").orgId));
      return c.json(await useCase.execute(), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  // Purchase orders
  app.get(api.purchaseOrders.list.path, async (c) => {
    try {
      const useCase = new ListPurchaseOrdersUseCase(await repositoryForOrg(c.get("profile").orgId));
      return c.json(await useCase.execute(), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.get(api.purchaseOrders.get.path, async (c) => {
    try {
      const useCase = new GetPurchaseOrderUseCase(await repositoryForOrg(c.get("profile").orgId));
      return c.json(await useCase.execute(Number(c.req.param("id"))), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.post(api.purchaseOrders.reorder.path, async (c) => {
    try {
      const input = api.purchaseOrders.reorder.input.parse(await c.req.json());
      const useCase = new ReorderPurchaseOrdersUseCase(await repositoryForOrg(c.get("profile").orgId));
      await useCase.execute(input);
      return c.body(null, 204);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.post(api.purchaseOrders.create.path, async (c) => {
    try {
      const input = api.purchaseOrders.create.input.parse(await c.req.json());
      const useCase = new CreatePurchaseOrderUseCase(await repositoryForOrg(c.get("profile").orgId));
      const created = await useCase.execute(input);
      notifyPurchaseOrderCreated(c.get("profile").orgId, created).catch((err) => {
        console.error("[push] purchase order created notification failed", err);
      });
      return c.json(created, 201);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.put(api.purchaseOrders.update.path, async (c) => {
    try {
      const input = api.purchaseOrders.update.input.parse(await c.req.json());
      const useCase = new UpdatePurchaseOrderUseCase(await repositoryForOrg(c.get("profile").orgId));
      return c.json(await useCase.execute(Number(c.req.param("id")), input), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.post(api.purchaseOrders.receive.path, async (c) => {
    try {
      const input = api.purchaseOrders.receive.input.parse(await c.req.json());
      const useCase = new ReceivePurchaseOrderUseCase(await repositoryForOrg(c.get("profile").orgId));
      return c.json(await useCase.execute(Number(c.req.param("id")), input), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.delete(api.purchaseOrders.cancel.path, async (c) => {
    try {
      const useCase = new CancelPurchaseOrderUseCase(await repositoryForOrg(c.get("profile").orgId));
      await useCase.execute(Number(c.req.param("id")));
      return c.body(null, 204);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  // Reports
  app.get(api.reports.production.path, async (c) => {
    try {
      const useCase = new ProductionReportUseCase(await repositoryForOrg(c.get("profile").orgId));
      const period = periodFromQuery(c.req.query());
      return c.json(await useCase.execute(period), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.get(api.reports.leatherConsumption.path, async (c) => {
    try {
      const useCase = new LeatherConsumptionReportUseCase(await repositoryForOrg(c.get("profile").orgId));
      const period = periodFromQuery(c.req.query());
      return c.json(await useCase.execute(period), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.get(api.reports.sales.path, async (c) => {
    try {
      const useCase = new SalesReportUseCase(await repositoryForOrg(c.get("profile").orgId));
      const period = periodFromQuery(c.req.query());
      return c.json(await useCase.execute(period), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.get(api.reports.dashboard.path, async (c) => {
    try {
      const useCase = new DashboardReportUseCase(await repositoryForOrg(c.get("profile").orgId));
      const period = periodFromQuery(c.req.query());
      return c.json(await useCase.execute(period), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });
}
