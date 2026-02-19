import { z } from 'zod';
import { 
  insertMaterialSchema, 
  insertProductSchema, 
  insertTechnicalSpecSchema, 
  insertProductionSchema, 
  insertSaleSchema,
  insertInventoryMovementSchema,
  materials,
  products,
  technicalSpecs,
  productions,
  sales,
  inventoryMovements
} from './schema';

// Shared Error Schemas
export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
    details: z.string().optional(),
  }),
  badRequest: z.object({
    message: z.string(),
  }),
};

// Custom Zod types for joined models (used in responses)
const materialSchema = z.custom<typeof materials.$inferSelect>();
const productSchema = z.custom<typeof products.$inferSelect>();
const technicalSpecSchema = z.custom<typeof technicalSpecs.$inferSelect>();
const productionSchema = z.custom<typeof productions.$inferSelect>();
const saleSchema = z.custom<typeof sales.$inferSelect>();
const inventoryMovementSchema = z.custom<typeof inventoryMovements.$inferSelect>();

const productWithSpecsSchema = productSchema.and(z.object({
  technicalSpecs: z.array(technicalSpecSchema.and(z.object({
    material: materialSchema
  })))
}));

const productionWithProductSchema = productionSchema.and(z.object({
  product: productSchema
}));

const saleWithProductSchema = saleSchema.and(z.object({
  product: productSchema
}));

const movementWithDetailsSchema = inventoryMovementSchema.and(z.object({
  product: productSchema.optional().nullable(),
  material: materialSchema.optional().nullable()
}));

// --- API CONTRACT ---
export const api = {
  materials: {
    list: {
      method: 'GET' as const,
      path: '/api/materials' as const,
      responses: {
        200: z.array(materialSchema),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/materials/:id' as const,
      responses: {
        200: materialSchema,
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/materials' as const,
      input: insertMaterialSchema,
      responses: {
        201: materialSchema,
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/materials/:id' as const,
      input: insertMaterialSchema.partial(),
      responses: {
        200: materialSchema,
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    adjustStock: {
      method: 'POST' as const,
      path: '/api/materials/:id/adjust' as const,
      input: z.object({
        quantityChange: z.string(), // positive to add, negative to remove
        reason: z.string()
      }),
      responses: {
        200: materialSchema,
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      }
    }
  },
  
  products: {
    list: {
      method: 'GET' as const,
      path: '/api/products' as const,
      responses: {
        200: z.array(productWithSpecsSchema),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/products/:id' as const,
      responses: {
        200: productWithSpecsSchema,
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/products' as const,
      input: z.object({
        product: insertProductSchema,
        specs: z.array(z.object({
          materialId: z.number(),
          quantityRequired: z.string()
        })).optional()
      }),
      responses: {
        201: productWithSpecsSchema,
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/products/:id' as const,
      input: z.object({
        product: insertProductSchema.partial(),
        specs: z.array(z.object({
          materialId: z.number(),
          quantityRequired: z.string()
        })).optional()
      }),
      responses: {
        200: productWithSpecsSchema,
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    }
  },

  productions: {
    list: {
      method: 'GET' as const,
      path: '/api/productions' as const,
      responses: {
        200: z.array(productionWithProductSchema),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/productions' as const,
      input: insertProductionSchema,
      responses: {
        201: productionWithProductSchema,
        400: errorSchemas.badRequest, // Emits Bad Request if not enough materials
      },
    },
  },

  sales: {
    list: {
      method: 'GET' as const,
      path: '/api/sales' as const,
      responses: {
        200: z.array(saleWithProductSchema),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/sales' as const,
      input: insertSaleSchema,
      responses: {
        201: saleWithProductSchema,
        400: errorSchemas.badRequest, // Emits Bad Request if not enough products
      },
    },
  },

  inventory: {
    movements: {
      method: 'GET' as const,
      path: '/api/inventory/movements' as const,
      responses: {
        200: z.array(movementWithDetailsSchema),
      },
    }
  }
};

// URL Builder Helper
export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

// Type Helpers
export type MaterialInput = z.infer<typeof api.materials.create.input>;
export type ProductInput = z.infer<typeof api.products.create.input>;
export type ProductionInput = z.infer<typeof api.productions.create.input>;
export type SaleInput = z.infer<typeof api.sales.create.input>;
