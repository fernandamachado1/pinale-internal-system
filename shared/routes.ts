import { z } from "zod";
import {
  concludeProductionOrderSchema,
  markProductionOrderDeliveredSchema,
  registerInitialProducedStockSchema,
  adjustProducedStockSchema,
  createManyMaterialsSchema,
  createPurchaseOrderSchema,
  createProductInputSchema,
  adminInviteUserSchema,
  adminUpdateUserSchema,
  insertMaterialSchema,
  receivePurchaseOrderSchema,
  moveProductionOrderSchema,
  insertProductionOrderSchema,
  updateProductionOrderSchema,
  updateProductionOrderFinancialsSchema,
  insertSaleSchema,
  reorderPurchaseOrdersSchema,
  updatePurchaseOrderSchema,
  updateMaterialSchema,
  updateProductInputSchema,
  updateMyProfileSchema,
  materials,
  products,
  bomItems,
  producedProductStocks,
  productionOrders,
  purchaseOrders,
  purchaseOrderItems,
  sales,
  saleItems,
  inventoryMovements,
  profiles,
} from "./schema.ts";

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  notFound: z.object({ message: z.string() }),
  internal: z.object({ message: z.string(), details: z.string().optional() }),
  badRequest: z.object({ message: z.string() }),
};

const materialSchema = z.custom<typeof materials.$inferSelect>();
const productSchema = z.custom<typeof products.$inferSelect>();
const bomItemSchema = z.custom<typeof bomItems.$inferSelect>();
const producedProductStockSchema = z.custom<typeof producedProductStocks.$inferSelect>();
const productionOrderSchema = z.custom<typeof productionOrders.$inferSelect>();
const purchaseOrderSchema = z.custom<typeof purchaseOrders.$inferSelect>();
const purchaseOrderItemSchema = z.custom<typeof purchaseOrderItems.$inferSelect>();
const saleSchema = z.custom<typeof sales.$inferSelect>();
const saleItemSchema = z.custom<typeof saleItems.$inferSelect>();
const inventoryMovementSchema = z.custom<typeof inventoryMovements.$inferSelect>();
const profileSchema = z.custom<typeof profiles.$inferSelect>();

const productWithBomSchema = productSchema.and(
  z.object({
    bomItems: z.array(bomItemSchema),
  }),
);
const productionOrderWithProductSchema = productionOrderSchema.and(z.object({ product: productSchema }));
const saleListItemSchema = saleItemSchema.and(z.object({ sale: saleSchema, product: productSchema }));
const producedProductStockWithProductSchema = producedProductStockSchema.and(z.object({ product: productSchema }));
const producedProductStockSummarySchema = z.object({
  productId: z.number(),
  inQty: z.number(),
  outQty: z.number(),
  stockQty: z.number(),
});
const catalogProductSchema = productWithBomSchema.and(
  z.object({
    inQty: z.number(),
    outQty: z.number(),
    stockQty: z.number(),
  }),
);
const paginatedCatalogProductsSchema = z.object({
  items: z.array(catalogProductSchema),
  total: z.number(),
});
const catalogProductsQuerySchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
const purchaseOrderWithItemsSchema = purchaseOrderSchema.and(z.object({ items: z.array(purchaseOrderItemSchema) }));
const purchaseOrdersListQuerySchema = z.object({
  includeArchived: z.preprocess((value) => value === true || value === "true", z.boolean()).default(false),
});

const reportProductionSchema = z.object({
  totalOps: z.number(),
  producedByProduct: z.array(z.object({ productId: z.number(), productName: z.string(), qtyProduced: z.number() })),
  fixedMaterialConsumption: z.array(z.object({ materialId: z.number(), materialName: z.string(), qty: z.number() })),
});

const reportLeatherSchema = z.object({
  totalGeneral: z.number(),
  byProduct: z.array(z.object({ productId: z.number(), productName: z.string(), qty: z.number() })),
});

const reportSalesSchema = z.object({
  totalRevenue: z.number(),
  soldByProduct: z.array(z.object({ productId: z.number(), productName: z.string(), qty: z.number(), revenue: z.number() })),
  revenueByPaymentMethod: z.array(z.object({ paymentMethod: z.string(), revenue: z.number() })),
});

const dashboardReportSchema = z.object({
  producedValue: z.number(),
  soldValue: z.number(),
  distinctSaleCount: z.number(),
  openOrdersCount: z.number(),
  topProduced: z.array(z.object({ productId: z.number(), productName: z.string(), qty: z.number(), value: z.number() })),
  topSold: z.array(z.object({ productId: z.number(), productName: z.string(), qty: z.number(), revenue: z.number() })),
  chartSeries: z.array(z.object({ date: z.string(), producedValue: z.number(), soldValue: z.number() })),
  openOrders: z.array(z.object({ id: z.number(), productName: z.string(), qtyPlanned: z.number(), createdAt: z.string() })),
  productStock: z.array(z.object({ productId: z.number(), productName: z.string(), stockQty: z.number() })),
});

export type DashboardReport = z.infer<typeof dashboardReportSchema>;

const periodQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const webPushSubscriptionSchema = z
  .object({
    endpoint: z.string().min(1),
    expirationTime: z.number().nullable().optional(),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  })
  .passthrough();

export const api = {
  me: {
    profile: {
      get: {
        method: "GET" as const,
        path: "/api/me/profile" as const,
        responses: { 200: profileSchema },
      },
      update: {
        method: "PATCH" as const,
        path: "/api/me/profile" as const,
        input: updateMyProfileSchema,
        responses: { 200: profileSchema, 400: errorSchemas.validation },
      },
    },
  },

  push: {
    publicKey: {
      method: "GET" as const,
      path: "/api/push/public-key" as const,
      responses: { 200: z.object({ publicKey: z.string() }), 400: errorSchemas.badRequest },
    },
    test: {
      method: "POST" as const,
      path: "/api/push/test" as const,
      input: z.object({}).passthrough(),
      responses: {
        200: z.object({
          attempted: z.number(),
          sent: z.number(),
          failed: z.number(),
          failureStatusCodes: z.array(z.number()),
          failureReasons: z.array(z.string()),
        }),
        400: errorSchemas.validation,
      },
    },
    subscribe: {
      method: "POST" as const,
      path: "/api/push/subscribe" as const,
      input: webPushSubscriptionSchema,
      responses: { 204: z.void(), 400: errorSchemas.validation },
    },
    unsubscribe: {
      method: "POST" as const,
      path: "/api/push/unsubscribe" as const,
      input: z.object({ endpoint: z.string().min(1) }),
      responses: { 204: z.void(), 400: errorSchemas.validation },
    },
  },

  admin: {
    users: {
      list: {
        method: "GET" as const,
        path: "/api/admin/users" as const,
        responses: { 200: z.array(profileSchema) },
      },
      invite: {
        method: "POST" as const,
        path: "/api/admin/users/invite" as const,
        input: adminInviteUserSchema,
        responses: { 201: profileSchema, 400: errorSchemas.validation },
      },
      update: {
        method: "PATCH" as const,
        path: "/api/admin/users/:id" as const,
        input: adminUpdateUserSchema,
        responses: { 200: profileSchema, 400: errorSchemas.validation, 404: errorSchemas.notFound },
      },
    },
  },

  materials: {
    list: { method: "GET" as const, path: "/api/materials" as const, responses: { 200: z.array(materialSchema) } },
    get: { method: "GET" as const, path: "/api/materials/:id" as const, responses: { 200: materialSchema, 404: errorSchemas.notFound } },
    create: {
      method: "POST" as const,
      path: "/api/materials" as const,
      input: insertMaterialSchema,
      responses: { 201: materialSchema, 400: errorSchemas.validation },
    },
    createMany: {
      method: "POST" as const,
      path: "/api/materials/bulk" as const,
      input: createManyMaterialsSchema,
      responses: { 201: z.array(materialSchema), 400: errorSchemas.validation },
    },
    update: {
      method: "PUT" as const,
      path: "/api/materials/:id" as const,
      input: updateMaterialSchema,
      responses: { 200: materialSchema, 400: errorSchemas.validation, 404: errorSchemas.notFound },
    },
    delete: { method: "DELETE" as const, path: "/api/materials/:id" as const, responses: { 204: z.void(), 404: errorSchemas.notFound } },
  },

  producedProductStocks: {
    list: {
      method: "GET" as const,
      path: "/api/produced-product-stocks" as const,
      responses: { 200: z.array(producedProductStockWithProductSchema) },
    },
    summary: {
      method: "GET" as const,
      path: "/api/produced-product-stocks/summary" as const,
      responses: { 200: z.array(producedProductStockSummarySchema) },
    },
    registerInitial: {
      method: "POST" as const,
      path: "/api/produced-product-stocks/register-initial" as const,
      input: registerInitialProducedStockSchema,
      responses: { 200: producedProductStockWithProductSchema, 400: errorSchemas.badRequest, 404: errorSchemas.notFound },
    },
    adjust: {
      method: "POST" as const,
      path: "/api/produced-product-stocks/adjust" as const,
      input: adjustProducedStockSchema,
      responses: { 200: producedProductStockWithProductSchema, 400: errorSchemas.badRequest, 404: errorSchemas.notFound },
    },
  },

  products: {
    list: { method: "GET" as const, path: "/api/products" as const, responses: { 200: z.array(productWithBomSchema) } },
    catalog: {
      method: "GET" as const,
      path: "/api/products/catalog" as const,
      query: catalogProductsQuerySchema,
      responses: { 200: paginatedCatalogProductsSchema },
    },
    get: {
      method: "GET" as const,
      path: "/api/products/:id" as const,
      responses: { 200: productWithBomSchema, 404: errorSchemas.notFound },
    },
    create: {
      method: "POST" as const,
      path: "/api/products" as const,
      input: createProductInputSchema,
      responses: { 201: productWithBomSchema, 400: errorSchemas.validation },
    },
    update: {
      method: "PUT" as const,
      path: "/api/products/:id" as const,
      input: updateProductInputSchema,
      responses: { 200: productWithBomSchema, 400: errorSchemas.validation, 404: errorSchemas.notFound },
    },
    delete: { method: "DELETE" as const, path: "/api/products/:id" as const, responses: { 204: z.void(), 404: errorSchemas.notFound } },
  },

  productionOrders: {
    list: { method: "GET" as const, path: "/api/production-orders" as const, responses: { 200: z.array(productionOrderWithProductSchema) } },
    get: {
      method: "GET" as const,
      path: "/api/production-orders/:id" as const,
      responses: {
        200: productionOrderWithProductSchema,
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/production-orders" as const,
      input: insertProductionOrderSchema,
      responses: { 201: productionOrderWithProductSchema, 400: errorSchemas.badRequest },
    },
    update: {
      method: "PUT" as const,
      path: "/api/production-orders/:id" as const,
      input: updateProductionOrderSchema,
      responses: { 200: productionOrderWithProductSchema, 400: errorSchemas.badRequest, 404: errorSchemas.notFound },
    },
    move: {
      method: "POST" as const,
      path: "/api/production-orders/:id/move" as const,
      input: moveProductionOrderSchema,
      responses: { 200: productionOrderWithProductSchema, 400: errorSchemas.badRequest, 404: errorSchemas.notFound },
    },
    updateFinancials: {
      method: "PATCH" as const,
      path: "/api/production-orders/:id/financials" as const,
      input: updateProductionOrderFinancialsSchema,
      responses: { 200: productionOrderWithProductSchema, 400: errorSchemas.badRequest, 404: errorSchemas.notFound },
    },
    conclude: {
      method: "POST" as const,
      path: "/api/production-orders/:id/conclude" as const,
      input: concludeProductionOrderSchema,
      responses: { 200: productionOrderWithProductSchema, 400: errorSchemas.badRequest, 404: errorSchemas.notFound },
    },
    deliver: {
      method: "POST" as const,
      path: "/api/production-orders/:id/deliver" as const,
      input: markProductionOrderDeliveredSchema,
      responses: { 200: productionOrderWithProductSchema, 400: errorSchemas.badRequest, 404: errorSchemas.notFound },
    },
    delete: {
      method: "DELETE" as const,
      path: "/api/production-orders/:id" as const,
      responses: { 204: z.void(), 400: errorSchemas.badRequest, 404: errorSchemas.notFound },
    },
  },

  purchaseOrders: {
    list: {
      method: "GET" as const,
      path: "/api/purchase-orders" as const,
      query: purchaseOrdersListQuerySchema,
      responses: { 200: z.array(purchaseOrderWithItemsSchema) },
    },
    get: {
      method: "GET" as const,
      path: "/api/purchase-orders/:id" as const,
      responses: { 200: purchaseOrderWithItemsSchema, 404: errorSchemas.notFound },
    },
    reorder: {
      method: "POST" as const,
      path: "/api/purchase-orders/reorder" as const,
      input: reorderPurchaseOrdersSchema,
      responses: { 204: z.void(), 400: errorSchemas.validation },
    },
    create: {
      method: "POST" as const,
      path: "/api/purchase-orders" as const,
      input: createPurchaseOrderSchema,
      responses: { 201: purchaseOrderWithItemsSchema, 400: errorSchemas.validation },
    },
    update: {
      method: "PUT" as const,
      path: "/api/purchase-orders/:id" as const,
      input: updatePurchaseOrderSchema,
      responses: { 200: purchaseOrderWithItemsSchema, 400: errorSchemas.validation, 404: errorSchemas.notFound },
    },
    receive: {
      method: "POST" as const,
      path: "/api/purchase-orders/:id/receive" as const,
      input: receivePurchaseOrderSchema,
      responses: { 200: purchaseOrderWithItemsSchema, 400: errorSchemas.badRequest, 404: errorSchemas.notFound },
    },
    cancel: {
      method: "DELETE" as const,
      path: "/api/purchase-orders/:id" as const,
      responses: { 204: z.void(), 404: errorSchemas.notFound },
    },
    delete: {
      method: "DELETE" as const,
      path: "/api/purchase-orders/:id/delete" as const,
      responses: { 204: z.void(), 404: errorSchemas.notFound },
    },
  },

  sales: {
    list: { method: "GET" as const, path: "/api/sales" as const, responses: { 200: z.array(saleListItemSchema) } },
    get: {
      method: "GET" as const,
      path: "/api/sales/:id" as const,
      responses: {
        200: saleSchema.and(z.object({ items: z.array(saleItemSchema.and(z.object({ product: productSchema }))) })),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/sales" as const,
      input: insertSaleSchema,
      responses: { 201: saleSchema.and(z.object({ items: z.array(saleItemSchema) })), 400: errorSchemas.badRequest },
    },
    update: {
      method: "PUT" as const,
      path: "/api/sales/:id" as const,
      input: insertSaleSchema,
      responses: { 200: saleSchema.and(z.object({ items: z.array(saleItemSchema) })), 400: errorSchemas.badRequest, 404: errorSchemas.notFound },
    },
    delete: {
      method: "DELETE" as const,
      path: "/api/sales/:id" as const,
      responses: { 204: z.void(), 404: errorSchemas.notFound },
    },
  },

  inventory: {
    movements: {
      method: "GET" as const,
      path: "/api/inventory/movements" as const,
      responses: {
        200: z.array(inventoryMovementSchema.and(z.object({ product: productSchema.optional().nullable(), material: materialSchema.optional().nullable() }))),
      },
    },
  },

  reports: {
    production: {
      method: "GET" as const,
      path: "/api/reports/production" as const,
      query: periodQuerySchema,
      responses: { 200: reportProductionSchema },
    },
    leatherConsumption: {
      method: "GET" as const,
      path: "/api/reports/leather-consumption" as const,
      query: periodQuerySchema,
      responses: { 200: reportLeatherSchema },
    },
    sales: {
      method: "GET" as const,
      path: "/api/reports/sales" as const,
      query: periodQuerySchema,
      responses: { 200: reportSalesSchema },
    },
    dashboard: {
      method: "GET" as const,
      path: "/api/reports/dashboard" as const,
      query: periodQuerySchema,
      responses: { 200: dashboardReportSchema },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    }
  }
  return url;
}
