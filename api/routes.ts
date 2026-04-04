import type { Hono } from "npm:hono";
import { api } from "../shared/routes.ts";
import { DrizzleErpRepository } from "../server/infra/repositories/drizzle-erp-repository.ts";
import { initDb } from "./db.ts";
import { requireSupabaseUser } from "./auth.ts";
import { toErrorResponse } from "./errors.ts";
import { sql } from "drizzle-orm";
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
  ListProductsUseCase,
  UpdateProductUseCase,
} from "../server/application/use-cases/product-use-cases.ts";
import {
  CreateProductionOrderUseCase,
  GetProductionOrderUseCase,
  ListProductionOrdersUseCase,
  MoveProductionOrderUseCase,
} from "../server/application/use-cases/production-use-cases.ts";
import { ListProducedProductStocksUseCase } from "../server/application/use-cases/produced-product-stock-use-cases.ts";
import { ListInventoryMovementsUseCase } from "../server/application/use-cases/inventory-movement-use-cases.ts";
import { CreateSaleUseCase } from "../server/application/use-cases/create-sale-use-case.ts";
import { GetSaleUseCase, ListSalesUseCase } from "../server/application/use-cases/sale-use-cases.ts";
import { CompleteProductionUseCase } from "../server/application/use-cases/complete-production-use-case.ts";
import {
  CancelPurchaseOrderUseCase,
  CreatePurchaseOrderUseCase,
  GetPurchaseOrderUseCase,
  ListPurchaseOrdersUseCase,
  ReceivePurchaseOrderUseCase,
  UpdatePurchaseOrderUseCase,
} from "../server/application/use-cases/purchase-order-use-cases.ts";
import {
  DashboardReportUseCase,
  LeatherConsumptionReportUseCase,
  ProductionReportUseCase,
  SalesReportUseCase,
} from "../server/application/use-cases/report-use-cases.ts";

export type AppVariables = { user: { id: string; email?: string | null } };

let repositorySingleton: DrizzleErpRepository | undefined;
async function repository(): Promise<DrizzleErpRepository> {
  if (repositorySingleton) return repositorySingleton;
  const { db } = await initDb();
  repositorySingleton = new DrizzleErpRepository(db);
  return repositorySingleton;
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
      if (c.req.path === "/api/health/db") {
        return await next();
      }
      if (c.req.path === "/api/health/dbinfo") {
        return await next();
      }
      if (c.req.path === "/api/health/net") {
        return await next();
      }
      const user = await requireSupabaseUser(c.req.header("Authorization"));
      c.set("user", user);
      await next();
    } catch (err) {
      if (err instanceof Error && err.message === "UNAUTHORIZED") {
        return c.json({ message: "Unauthorized" }, 401);
      }
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.get("/api/whoami", (c) => c.json(c.get("user"), 200));

  // Materials
  app.get(api.materials.list.path, async (c) => {
    try {
      const useCase = new ListMaterialsUseCase(await repository());
      return c.json(await useCase.execute(), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.get(api.materials.get.path, async (c) => {
    try {
      const useCase = new GetMaterialUseCase(await repository());
      return c.json(await useCase.execute(Number(c.req.param("id"))), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.post(api.materials.create.path, async (c) => {
    try {
      const input = api.materials.create.input.parse(await c.req.json());
      const useCase = new CreateMaterialUseCase(await repository());
      return c.json(await useCase.execute(input), 201);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.post(api.materials.createMany.path, async (c) => {
    try {
      const input = api.materials.createMany.input.parse(await c.req.json());
      const useCase = new CreateManyMaterialsUseCase(await repository());
      return c.json(await useCase.execute(input), 201);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.put(api.materials.update.path, async (c) => {
    try {
      const input = api.materials.update.input.parse(await c.req.json());
      const useCase = new UpdateMaterialUseCase(await repository());
      return c.json(await useCase.execute(Number(c.req.param("id")), input), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.delete(api.materials.delete.path, async (c) => {
    try {
      const useCase = new DeleteMaterialUseCase(await repository());
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
      const useCase = new ListProductsUseCase(await repository());
      return c.json(await useCase.execute(), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.get(api.products.get.path, async (c) => {
    try {
      const useCase = new GetProductUseCase(await repository());
      return c.json(await useCase.execute(Number(c.req.param("id"))), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.post(api.products.create.path, async (c) => {
    try {
      const input = api.products.create.input.parse(await c.req.json());
      const useCase = new CreateProductUseCase(await repository());
      return c.json(await useCase.execute(input), 201);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.put(api.products.update.path, async (c) => {
    try {
      const input = api.products.update.input.parse(await c.req.json());
      const useCase = new UpdateProductUseCase(await repository());
      return c.json(await useCase.execute(Number(c.req.param("id")), input), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.delete(api.products.delete.path, async (c) => {
    try {
      const useCase = new DeleteProductUseCase(await repository());
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
      const useCase = new ListProducedProductStocksUseCase(await repository());
      return c.json(await useCase.execute(), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  // Production orders
  app.get(api.productionOrders.list.path, async (c) => {
    try {
      const useCase = new ListProductionOrdersUseCase(await repository());
      return c.json(await useCase.execute(), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.get(api.productionOrders.get.path, async (c) => {
    try {
      const useCase = new GetProductionOrderUseCase(await repository());
      return c.json(await useCase.execute(Number(c.req.param("id"))), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.post(api.productionOrders.create.path, async (c) => {
    try {
      const input = api.productionOrders.create.input.parse(await c.req.json());
      const useCase = new CreateProductionOrderUseCase(await repository());
      return c.json(await useCase.execute(input), 201);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.post(api.productionOrders.move.path, async (c) => {
    try {
      const input = api.productionOrders.move.input.parse(await c.req.json());
      const useCase = new MoveProductionOrderUseCase(await repository());
      return c.json(await useCase.execute(Number(c.req.param("id")), input), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.post(api.productionOrders.conclude.path, async (c) => {
    try {
      const input = api.productionOrders.conclude.input.parse(await c.req.json());
      const repo = await repository();
      const completeUseCase = new CompleteProductionUseCase(repo);
      const getUseCase = new GetProductionOrderUseCase(repo);
      await completeUseCase.execute(Number(c.req.param("id")), input);
      return c.json(await getUseCase.execute(Number(c.req.param("id"))), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  // Sales
  app.get(api.sales.list.path, async (c) => {
    try {
      const useCase = new ListSalesUseCase(await repository());
      return c.json(await useCase.execute(), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.get(api.sales.get.path, async (c) => {
    try {
      const useCase = new GetSaleUseCase(await repository());
      return c.json(await useCase.execute(Number(c.req.param("id"))), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.post(api.sales.create.path, async (c) => {
    try {
      const input = api.sales.create.input.parse(await c.req.json());
      const repo = await repository();
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
      const useCase = new ListInventoryMovementsUseCase(await repository());
      return c.json(await useCase.execute(), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  // Purchase orders
  app.get(api.purchaseOrders.list.path, async (c) => {
    try {
      const useCase = new ListPurchaseOrdersUseCase(await repository());
      return c.json(await useCase.execute(), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.get(api.purchaseOrders.get.path, async (c) => {
    try {
      const useCase = new GetPurchaseOrderUseCase(await repository());
      return c.json(await useCase.execute(Number(c.req.param("id"))), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.post(api.purchaseOrders.create.path, async (c) => {
    try {
      const input = api.purchaseOrders.create.input.parse(await c.req.json());
      const useCase = new CreatePurchaseOrderUseCase(await repository());
      return c.json(await useCase.execute(input), 201);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.put(api.purchaseOrders.update.path, async (c) => {
    try {
      const input = api.purchaseOrders.update.input.parse(await c.req.json());
      const useCase = new UpdatePurchaseOrderUseCase(await repository());
      return c.json(await useCase.execute(Number(c.req.param("id")), input), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.post(api.purchaseOrders.receive.path, async (c) => {
    try {
      const input = api.purchaseOrders.receive.input.parse(await c.req.json());
      const useCase = new ReceivePurchaseOrderUseCase(await repository());
      return c.json(await useCase.execute(Number(c.req.param("id")), input), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.delete(api.purchaseOrders.cancel.path, async (c) => {
    try {
      const useCase = new CancelPurchaseOrderUseCase(await repository());
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
      const useCase = new ProductionReportUseCase(await repository());
      const period = periodFromQuery(c.req.query());
      return c.json(await useCase.execute(period), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.get(api.reports.leatherConsumption.path, async (c) => {
    try {
      const useCase = new LeatherConsumptionReportUseCase(await repository());
      const period = periodFromQuery(c.req.query());
      return c.json(await useCase.execute(period), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.get(api.reports.sales.path, async (c) => {
    try {
      const useCase = new SalesReportUseCase(await repository());
      const period = periodFromQuery(c.req.query());
      return c.json(await useCase.execute(period), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });

  app.get(api.reports.dashboard.path, async (c) => {
    try {
      const useCase = new DashboardReportUseCase(await repository());
      const period = periodFromQuery(c.req.query());
      return c.json(await useCase.execute(period), 200);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      return c.json(body, status);
    }
  });
}
