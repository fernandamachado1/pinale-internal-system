import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const productAttachmentSchema = z.object({
  url: z.string().url(),
  name: z.string().min(1),
  mimeType: z.string().nullable().default(null),
  thumbnailUrl: z.string().url().nullable().default(null),
  driveFileId: z.string().nullable().default(null),
});
export type ProductAttachment = z.infer<typeof productAttachmentSchema>;

export const productColorVariantSchema = z.object({
  name: z.string().trim().min(1),
  qty: z.number().int().min(0),
});
export type ProductColorVariant = z.infer<typeof productColorVariantSchema>;

export const productCategoryValues = ["ACCESSORIES", "STATIONERY", "WALLETS", "TRAVEL", "BAGS"] as const;
export const productCategoryEnum = pgEnum("product_category", productCategoryValues);
export const productCategorySchema = z.enum(productCategoryValues);
export type ProductCategory = z.infer<typeof productCategorySchema>;

export const materialCategoryEnum = pgEnum("material_category", ["PACKAGING", "NOTIONS", "RAW_MATERIAL"]);
export const unitOfMeasureEnum = pgEnum("unit_of_measure", ["UNIT", "SQUARE_METER", "METER"]);
export const productionOrderStatusEnum = pgEnum("production_order_status", ["BACKLOG", "IN_PROGRESS", "DONE"]);
export const productionOrderSalesChannelEnum = pgEnum("production_order_sales_channel", ["ONLINE", "PHYSICAL"]);
export const movementEntityTypeEnum = pgEnum("movement_entity_type", ["PRODUCT", "MATERIAL"]);
export const movementDirectionEnum = pgEnum("movement_direction", ["IN", "OUT"]);
export const movementReasonEnum = pgEnum("movement_reason", ["PRODUCTION_CONSUMPTION", "PRODUCTION_OUTPUT", "SALE", "PURCHASE", "ADJUSTMENT"]);
export const movementReferenceTypeEnum = pgEnum("movement_reference_type", ["OP", "SALE", "MANUAL"]);
export const purchaseOrderStatusEnum = pgEnum("purchase_order_status", [
  "OPEN",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CANCELED",
]);
export const userRoleEnum = pgEnum("user_role", ["ADMIN", "STAFF", "VIEWER"]);

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    nameUniqueIdx: uniqueIndex("organizations_name_unique").on(table.name),
  }),
);

export const materials = pgTable("materials", {
  id: serial("id").primaryKey(),
  orgId: uuid("org_id").notNull(),
  name: text("name").notNull(),
  unitOfMeasure: unitOfMeasureEnum("unit_of_measure").notNull().default("UNIT"),
  stockTracked: boolean("stock_tracked").notNull().default(true),
  stockQty: numeric("stock_qty", { precision: 12, scale: 3 }).notNull().default("0"),
  reservedQty: numeric("reserved_qty", { precision: 12, scale: 3 }).notNull().default("0"),
  category: materialCategoryEnum("category").notNull().default("NOTIONS"),
  purchasePrice: numeric("purchase_price", { precision: 12, scale: 2 }).notNull().default("0"),
  pricePerSquareMeter: numeric("price_per_square_meter", { precision: 12, scale: 2 }),
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  orgId: uuid("org_id").notNull(),
  name: text("name").notNull(),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  category: productCategoryEnum("category").notNull().default("ACCESSORIES"),
  description: text("description").notNull().default(""),
  attachments: jsonb("attachments").$type<ProductAttachment[]>().notNull().default([]),
  colorVariants: jsonb("color_variants").$type<ProductColorVariant[]>().notNull().default([]),
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const boms = pgTable("boms", {
  id: serial("id").primaryKey(),
  orgId: uuid("org_id").notNull(),
  productId: integer("product_id").notNull(),
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const bomItems = pgTable("bom_items", {
  id: serial("id").primaryKey(),
  orgId: uuid("org_id").notNull(),
  bomId: integer("bom_id").notNull(),
  materialId: integer("material_id").notNull(),
  qtyPerUnit: numeric("qty_per_unit", { precision: 12, scale: 3 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const producedProductStocks = pgTable(
  "produced_product_stocks",
  {
    id: serial("id").primaryKey(),
    orgId: uuid("org_id").notNull(),
    productId: integer("product_id").notNull(),
    stockQty: integer("stock_qty").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    productIdUniqueIdx: uniqueIndex("produced_product_stocks_product_id_idx").on(table.productId),
  }),
);

export const productionOrders = pgTable("production_orders", {
  id: serial("id").primaryKey(),
  orgId: uuid("org_id").notNull(),
  productId: integer("product_id").notNull(),
  bomId: integer("bom_id"),
  qtyPlanned: integer("qty_planned").notNull(),
  measureCm: numeric("measure_cm", { precision: 8, scale: 2 }),
  customizationNotes: text("customization_notes"),
  status: productionOrderStatusEnum("status").notNull().default("BACKLOG"),
  salesChannel: productionOrderSalesChannelEnum("sales_channel").notNull().default("ONLINE"),
  dueAt: timestamp("due_at"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const sales = pgTable("sales", {
  id: serial("id").primaryKey(),
  orgId: uuid("org_id").notNull(),
  paymentMethod: text("payment_method").notNull(),
  description: text("description"),
  salesChannel: productionOrderSalesChannelEnum("sales_channel").notNull().default("ONLINE"),
  soldAt: timestamp("sold_at").notNull().defaultNow(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const saleItems = pgTable("sale_items", {
  id: serial("id").primaryKey(),
  orgId: uuid("org_id").notNull(),
  saleId: integer("sale_id").notNull(),
  productId: integer("product_id").notNull(),
  qty: integer("qty").notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  totalPrice: numeric("total_price", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const inventoryMovements = pgTable("inventory_movements", {
  id: serial("id").primaryKey(),
  orgId: uuid("org_id").notNull(),
  entityType: movementEntityTypeEnum("entity_type").notNull(),
  entityId: integer("entity_id"),
  direction: movementDirectionEnum("direction").notNull(),
  qty: numeric("qty", { precision: 12, scale: 3 }).notNull(),
  reason: movementReasonEnum("reason").notNull(),
  referenceType: movementReferenceTypeEnum("reference_type").notNull(),
  referenceId: integer("reference_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const purchaseOrders = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
  orgId: uuid("org_id").notNull(),
  status: purchaseOrderStatusEnum("status").notNull().default("OPEN"),
  isActive: integer("is_active").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
  receivedAt: timestamp("received_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: serial("id").primaryKey(),
  orgId: uuid("org_id").notNull(),
  purchaseOrderId: integer("purchase_order_id").notNull(),
  materialId: integer("material_id"),
  materialName: text("material_name").notNull(),
  description: text("description"),
  qtyOrdered: numeric("qty_ordered", { precision: 12, scale: 3 }).notNull(),
  qtyReceived: numeric("qty_received", { precision: 12, scale: 3 }).notNull().default("0"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey(),
    orgId: uuid("org_id").notNull(),
    email: text("email"),
    username: text("username"),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    role: userRoleEnum("role").notNull().default("VIEWER"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    usernameUniqueIdx: uniqueIndex("profiles_username_unique").on(table.username),
  }),
);

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: serial("id").primaryKey(),
    orgId: uuid("org_id").notNull(),
    profileId: uuid("profile_id").notNull(),
    endpoint: text("endpoint").notNull(),
    subscription: jsonb("subscription").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    endpointUniqueIdx: uniqueIndex("push_subscriptions_endpoint_unique").on(table.endpoint),
  }),
);

export const userRoleSchema = z.enum(["ADMIN", "STAFF", "VIEWER"]);
export type UserRole = z.infer<typeof userRoleSchema>;

const baseInsertMaterialSchema = createInsertSchema(materials).omit({
  id: true,
  orgId: true,
  reservedQty: true,
  createdAt: true,
  updatedAt: true,
});
export const insertMaterialSchema = baseInsertMaterialSchema.extend({
  category: z.enum(["PACKAGING", "NOTIONS", "RAW_MATERIAL"]).default("NOTIONS"),
  stockTracked: z.boolean().default(true),
  stockQty: z.string().optional(),
  purchasePrice: z.string(),
  pricePerSquareMeter: z.string().optional().nullable(),
  unitOfMeasure: z.enum(["UNIT", "SQUARE_METER", "METER"]).default("UNIT"),
}).superRefine((value, ctx) => {
  if (value.stockQty !== undefined && Number(value.stockQty) < 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "stockQty cannot be negative", path: ["stockQty"] });
  }
  if (value.stockTracked !== false && value.stockQty === undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "stockQty is required when stock control is enabled", path: ["stockQty"] });
  }

  if (Number(value.purchasePrice) < 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "purchasePrice cannot be negative", path: ["purchasePrice"] });
  }

  if (value.category === "RAW_MATERIAL") {
    if (!value.pricePerSquareMeter || Number(value.pricePerSquareMeter) < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "pricePerSquareMeter is required for raw materials",
        path: ["pricePerSquareMeter"],
      });
    }
  }
});
export const updateMaterialSchema = baseInsertMaterialSchema
  .partial()
  .extend({
    stockTracked: z.boolean().optional(),
    stockQty: z.string().optional(),
    purchasePrice: z.string().optional(),
    pricePerSquareMeter: z.string().optional().nullable(),
    unitOfMeasure: z.enum(["UNIT", "SQUARE_METER", "METER"]).optional(),
    category: z.enum(["PACKAGING", "NOTIONS", "RAW_MATERIAL"]).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.stockTracked !== false && value.stockQty !== undefined && Number(value.stockQty) < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "stockQty cannot be negative", path: ["stockQty"] });
    }
    if (value.purchasePrice !== undefined && Number(value.purchasePrice) < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "purchasePrice cannot be negative", path: ["purchasePrice"] });
    }
    if (value.category === "RAW_MATERIAL" && (!value.pricePerSquareMeter || Number(value.pricePerSquareMeter) < 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "pricePerSquareMeter is required for raw materials",
        path: ["pricePerSquareMeter"],
      });
    }
  });

export const insertProductSchema = createInsertSchema(products)
  .omit({ id: true, orgId: true, createdAt: true, updatedAt: true })
  .extend({
    price: z.string(),
    isActive: z.number().int().default(1),
    category: productCategorySchema,
    attachments: z.array(productAttachmentSchema).default([]),
    colorVariants: z.array(productColorVariantSchema).default([]),
    description: z.string().default(""),
  });

export const bomItemInputSchema = z.object({
  materialId: z.number().int().positive(),
  qtyPerUnit: z.string(),
});

const technicalSpecSchema = z.object({ bomItems: z.array(bomItemInputSchema).default([]) });

export const createProductInputSchema = z.object({
  product: insertProductSchema,
  technicalSpec: technicalSpecSchema.optional(),
  initialStockQty: z.number().int().min(0).default(0),
});

export const updateProductInputSchema = z.object({
  product: insertProductSchema.partial(),
  technicalSpec: technicalSpecSchema.partial().optional(),
});

const saleChannelEnum = z.enum(["ONLINE", "PHYSICAL"]);

export const insertProductionOrderSchema = z.object({
  productId: z.number().int().positive(),
  bomId: z.number().int().positive().optional(),
  qtyPlanned: z.number().int().positive(),
  measureCm: z.number().positive().max(9999).optional().nullable(),
  customizationNotes: z.string().trim().max(500).optional().nullable(),
  salesChannel: saleChannelEnum,
  dueAt: z.string().datetime().optional().nullable(),
});

export const moveProductionOrderSchema = z.object({
  status: z.enum(["BACKLOG", "IN_PROGRESS"]),
  orderedIds: z.array(z.number().int().positive()).min(1),
});

export const concludeProductionOrderSchema = z.object({});
export const registerInitialProducedStockSchema = z.object({
  productId: z.number().int().positive(),
  qty: z.number().int().positive(),
  note: z.string().trim().max(280).optional().nullable(),
});
export const adjustProducedStockSchema = z.object({
  productId: z.number().int().positive(),
  qtyChange: z.number().int().refine((value) => value !== 0, "qtyChange must not be zero"),
  note: z.string().trim().max(280).optional().nullable(),
});
export const createManyMaterialsSchema = z.object({
  items: z.array(insertMaterialSchema).min(1),
});

export const insertSaleSchema = z.object({
  paymentMethod: z.string().min(1),
  description: z.string().trim().max(500).optional().nullable(),
  salesChannel: saleChannelEnum,
  soldAt: z.string().datetime().optional().nullable(),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        qty: z.number().int().positive(),
      }),
    )
    .min(1),
});

export const insertInventoryMovementSchema = createInsertSchema(inventoryMovements).omit({ id: true, orgId: true, createdAt: true });

export const reorderPurchaseOrdersSchema = z.object({
  orderedIds: z.array(z.number().int().positive()).min(1),
});

export const updateMyProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  avatarUrl: z.string().trim().url().nullable().optional(),
  username: z.string().trim().min(3).max(30).regex(/^[a-z0-9_]+$/i).optional(),
});
export type UpdateMyProfileInput = z.infer<typeof updateMyProfileSchema>;

export const adminInviteUserSchema = z.object({
  email: z.string().trim().email(),
  role: userRoleSchema.default("VIEWER"),
});
export type AdminInviteUserInput = z.infer<typeof adminInviteUserSchema>;

export const adminUpdateUserSchema = z.object({
  role: userRoleSchema.optional(),
  isActive: z.boolean().optional(),
});
export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;

export type Material = typeof materials.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Bom = typeof boms.$inferSelect;
export type BomItem = typeof bomItems.$inferSelect;
export type ProducedProductStock = typeof producedProductStocks.$inferSelect;
export type ProductionOrder = typeof productionOrders.$inferSelect;
export type Sale = typeof sales.$inferSelect;
export type SaleItem = typeof saleItems.$inferSelect;
export type InventoryMovement = typeof inventoryMovements.$inferSelect;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type Organization = typeof organizations.$inferSelect;

export type InsertMaterial = z.input<typeof insertMaterialSchema>;
export type UpdateMaterialRequest = z.input<typeof updateMaterialSchema>;
export type CreateManyMaterialsInput = z.input<typeof createManyMaterialsSchema>;

export type InsertProduct = z.input<typeof insertProductSchema>;
export type CreateProductInput = z.input<typeof createProductInputSchema>;
export type UpdateProductInput = z.input<typeof updateProductInputSchema>;

export type BomItemInput = z.input<typeof bomItemInputSchema>;

export type InsertProductionOrder = z.input<typeof insertProductionOrderSchema>;
export type MoveProductionOrderInput = z.input<typeof moveProductionOrderSchema>;
export type ConcludeProductionOrderInput = z.input<typeof concludeProductionOrderSchema>;
export type RegisterInitialProducedStockInput = z.input<typeof registerInitialProducedStockSchema>;
export type AdjustProducedStockInput = z.input<typeof adjustProducedStockSchema>;

export type InsertSale = z.input<typeof insertSaleSchema>;

export type InsertInventoryMovement = z.input<typeof insertInventoryMovementSchema>;

export type ProductWithBom = Product & {
  bomItems: BomItem[];
};

export type ProductionOrderWithProduct = ProductionOrder & { product: Product };
export type SaleListItem = SaleItem & { sale: Sale; product: Product };
export type ProducedProductStockWithProduct = ProducedProductStock & { product: Product };
export type ProducedProductStockSummary = {
  productId: number;
  inQty: number;
  outQty: number;
  stockQty: number;
};

export type CatalogProduct = ProductWithBom & {
  inQty: number;
  outQty: number;
  stockQty: number;
};
export type PurchaseOrderWithItems = PurchaseOrder & { items: PurchaseOrderItem[] };

export type MovementWithDetails = InventoryMovement & {
  product?: Product | null;
  material?: Material | null;
};

export const createPurchaseOrderSchema = z.object({
  items: z
    .array(
      z.object({
        materialId: z.number().int().positive().optional().nullable(),
        materialName: z.string().min(1),
        description: z.string().trim().max(800).optional().nullable(),
        qtyOrdered: z.string().optional(),
      }),
    )
    .min(1),
});

export const updatePurchaseOrderSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.number().int().positive().optional(),
        materialId: z.number().int().positive().optional().nullable(),
        materialName: z.string().min(1),
        description: z.string().trim().max(800).optional().nullable(),
        qtyOrdered: z.string().optional(),
      }),
    )
    .min(1),
});

export const receivePurchaseOrderSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.number().int().positive(),
        qtyReceiveNow: z.string().min(1),
        materialId: z.number().int().positive().optional().nullable(),
        materialName: z.string().optional(),
        qtyOrdered: z.string().optional(),
      }),
    )
    .min(1),
});

export type CreatePurchaseOrderInput = z.input<typeof createPurchaseOrderSchema>;
export type UpdatePurchaseOrderInput = z.input<typeof updatePurchaseOrderSchema>;
export type ReceivePurchaseOrderInput = z.input<typeof receivePurchaseOrderSchema>;
export type ReorderPurchaseOrdersInput = z.input<typeof reorderPurchaseOrdersSchema>;

export type PaginatedResponse<T> = { items: T[]; total?: number };
