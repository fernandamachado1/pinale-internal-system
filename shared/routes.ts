import { z } from "zod";
import {
  concludeProductionOrderSchema,
  createProductInputSchema,
  insertMaterialSchema,
  insertProductionOrderSchema,
  insertSaleSchema,
  updateProductInputSchema,
  materials,
  products,
  bomItems,
  productionOrders,
  sales,
  saleItems,
  inventoryMovements,
  productionVariableConsumptions,
} from "./schema";

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  notFound: z.object({ message: z.string() }),
  internal: z.object({ message: z.string(), details: z.string().optional() }),
  badRequest: z.object({ message: z.string() }),
};

const materialSchema = z.custom<typeof materials.$inferSelect>();
const productSchema = z.custom<typeof products.$inferSelect>();
const bomItemSchema = z.custom<typeof bomItems.$inferSelect>();
const productionOrderSchema = z.custom<typeof productionOrders.$inferSelect>();
const productionVariableConsumptionSchema = z.custom<typeof productionVariableConsumptions.$inferSelect>();
const saleSchema = z.custom<typeof sales.$inferSelect>();
const saleItemSchema = z.custom<typeof saleItems.$inferSelect>();
const inventoryMovementSchema = z.custom<typeof inventoryMovements.$inferSelect>();

const productWithBomSchema = productSchema.and(z.object({ bomItems: z.array(bomItemSchema) }));
const productionOrderWithProductSchema = productionOrderSchema.and(z.object({ product: productSchema }));
const saleListItemSchema = saleItemSchema.and(z.object({ sale: saleSchema, product: productSchema }));

const reportProductionSchema = z.object({
  totalOps: z.number(),
  producedByProduct: z.array(z.object({ productId: z.number(), productName: z.string(), qtyProduced: z.number() })),
  fixedMaterialConsumption: z.array(z.object({ materialId: z.number(), materialName: z.string(), qty: z.number() })),
});

const reportLeatherSchema = z.object({
  totalGeneral: z.number(),
  byThickness: z.array(z.object({ thicknessMm: z.string(), qty: z.number() })),
  byProduct: z.array(z.object({ productId: z.number(), productName: z.string(), qty: z.number() })),
});

const reportSalesSchema = z.object({
  totalRevenue: z.number(),
  soldByProduct: z.array(z.object({ productId: z.number(), productName: z.string(), qty: z.number(), revenue: z.number() })),
  revenueByPaymentMethod: z.array(z.object({ paymentMethod: z.string(), revenue: z.number() })),
});

const periodQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const api = {
  materials: {
    list: { method: "GET" as const, path: "/api/materials" as const, responses: { 200: z.array(materialSchema) } },
    get: { method: "GET" as const, path: "/api/materials/:id" as const, responses: { 200: materialSchema, 404: errorSchemas.notFound } },
    create: {
      method: "POST" as const,
      path: "/api/materials" as const,
      input: insertMaterialSchema,
      responses: { 201: materialSchema, 400: errorSchemas.validation },
    },
    update: {
      method: "PUT" as const,
      path: "/api/materials/:id" as const,
      input: insertMaterialSchema.partial(),
      responses: { 200: materialSchema, 400: errorSchemas.validation, 404: errorSchemas.notFound },
    },
    delete: { method: "DELETE" as const, path: "/api/materials/:id" as const, responses: { 204: z.void(), 404: errorSchemas.notFound } },
  },

  products: {
    list: { method: "GET" as const, path: "/api/products" as const, responses: { 200: z.array(productWithBomSchema) } },
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
        200: productionOrderWithProductSchema.and(z.object({ consumptions: z.array(productionVariableConsumptionSchema) })),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/production-orders" as const,
      input: insertProductionOrderSchema,
      responses: { 201: productionOrderWithProductSchema, 400: errorSchemas.badRequest },
    },
    conclude: {
      method: "POST" as const,
      path: "/api/production-orders/:id/conclude" as const,
      input: concludeProductionOrderSchema,
      responses: { 200: productionOrderWithProductSchema, 400: errorSchemas.badRequest, 404: errorSchemas.notFound },
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
