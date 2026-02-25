import {
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const materialPolicyEnum = pgEnum("material_policy", ["STOCK_CONTROLLED", "CONSUMPTION_TRACKED"]);
export const materialGroupEnum = pgEnum("material_group", ["LEATHER", "HARDWARE", "ADHESIVE", "THREAD", "OTHER"]);
export const bomItemTypeEnum = pgEnum("bom_item_type", ["FIXED_MATERIAL", "VARIABLE_MATERIAL"]);
export const productionOrderStatusEnum = pgEnum("production_order_status", ["OPEN", "DONE"]);
export const movementEntityTypeEnum = pgEnum("movement_entity_type", ["PRODUCT", "MATERIAL", "MATERIAL_GROUP"]);
export const movementDirectionEnum = pgEnum("movement_direction", ["IN", "OUT"]);
export const movementReasonEnum = pgEnum("movement_reason", ["PRODUCTION_CONSUMPTION", "PRODUCTION_OUTPUT", "SALE", "PURCHASE", "ADJUSTMENT"]);
export const movementReferenceTypeEnum = pgEnum("movement_reference_type", ["OP", "SALE", "MANUAL"]);

export const materials = pgTable("materials", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  unit: text("unit").notNull(),
  policy: materialPolicyEnum("policy").notNull(),
  stockQty: numeric("stock_qty", { precision: 12, scale: 3 }),
  group: materialGroupEnum("group").notNull().default("OTHER"),
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  stockQty: integer("stock_qty").notNull().default(0),
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const boms = pgTable("boms", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const bomItems = pgTable("bom_items", {
  id: serial("id").primaryKey(),
  bomId: integer("bom_id").notNull(),
  itemType: bomItemTypeEnum("item_type").notNull(),
  materialId: integer("material_id"),
  materialGroup: materialGroupEnum("material_group"),
  qtyPerUnit: numeric("qty_per_unit", { precision: 12, scale: 3 }),
  plannedQtyPerUnit: numeric("planned_qty_per_unit", { precision: 12, scale: 3 }),
  unit: text("unit"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const productionOrders = pgTable("production_orders", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  qtyPlanned: integer("qty_planned").notNull(),
  status: productionOrderStatusEnum("status").notNull().default("OPEN"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const productionVariableConsumptions = pgTable("production_variable_consumptions", {
  id: serial("id").primaryKey(),
  productionOrderId: integer("production_order_id").notNull(),
  materialGroup: materialGroupEnum("material_group").notNull(),
  quantityUsed: numeric("quantity_used", { precision: 12, scale: 3 }).notNull(),
  thicknessMm: numeric("thickness_mm", { precision: 8, scale: 3 }).notNull(),
  panelsCount: integer("panels_count"),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sales = pgTable("sales", {
  id: serial("id").primaryKey(),
  paymentMethod: text("payment_method").notNull(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const saleItems = pgTable("sale_items", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id").notNull(),
  productId: integer("product_id").notNull(),
  qty: integer("qty").notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  totalPrice: numeric("total_price", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const inventoryMovements = pgTable("inventory_movements", {
  id: serial("id").primaryKey(),
  entityType: movementEntityTypeEnum("entity_type").notNull(),
  entityId: integer("entity_id"),
  group: materialGroupEnum("group"),
  direction: movementDirectionEnum("direction").notNull(),
  qty: numeric("qty", { precision: 12, scale: 3 }).notNull(),
  reason: movementReasonEnum("reason").notNull(),
  referenceType: movementReferenceTypeEnum("reference_type").notNull(),
  referenceId: integer("reference_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

const baseInsertMaterialSchema = createInsertSchema(materials).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMaterialSchema = baseInsertMaterialSchema.extend({
  policy: z.enum(["STOCK_CONTROLLED", "CONSUMPTION_TRACKED"]),
  group: z.enum(["LEATHER", "HARDWARE", "ADHESIVE", "THREAD", "OTHER"]).default("OTHER"),
});

export const insertProductSchema = createInsertSchema(products)
  .omit({ id: true, createdAt: true, updatedAt: true, stockQty: true })
  .extend({
    price: z.string(),
    isActive: z.number().int().default(1),
  });

export const bomItemInputSchema = z.discriminatedUnion("itemType", [
  z.object({
    itemType: z.literal("FIXED_MATERIAL"),
    materialId: z.number().int().positive(),
    qtyPerUnit: z.string(),
  }),
  z.object({
    itemType: z.literal("VARIABLE_MATERIAL"),
    materialGroup: z.enum(["LEATHER", "HARDWARE", "ADHESIVE", "THREAD", "OTHER"]),
    plannedQtyPerUnit: z.string(),
    unit: z.string().min(1),
  }),
]);

export const createProductInputSchema = z.object({
  product: insertProductSchema,
  bomItems: z.array(bomItemInputSchema).default([]),
});

export const updateProductInputSchema = z.object({
  product: insertProductSchema.partial(),
  bomItems: z.array(bomItemInputSchema).optional(),
});

export const insertProductionOrderSchema = z.object({
  productId: z.number().int().positive(),
  qtyPlanned: z.number().int().positive(),
});

export const variableConsumptionInputSchema = z.object({
  materialGroup: z.enum(["LEATHER", "HARDWARE", "ADHESIVE", "THREAD", "OTHER"]),
  quantityUsed: z.string(),
  thicknessMm: z.string(),
  panelsCount: z.number().int().positive().optional(),
  note: z.string().optional(),
});

export const concludeProductionOrderSchema = z.object({
  consumptions: z.array(variableConsumptionInputSchema).default([]),
});

export const insertSaleSchema = z.object({
  paymentMethod: z.string().min(1),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        qty: z.number().int().positive(),
      }),
    )
    .min(1),
});

export const insertInventoryMovementSchema = createInsertSchema(inventoryMovements).omit({ id: true, createdAt: true });

export type Material = typeof materials.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Bom = typeof boms.$inferSelect;
export type BomItem = typeof bomItems.$inferSelect;
export type ProductionOrder = typeof productionOrders.$inferSelect;
export type ProductionVariableConsumption = typeof productionVariableConsumptions.$inferSelect;
export type Sale = typeof sales.$inferSelect;
export type SaleItem = typeof saleItems.$inferSelect;
export type InventoryMovement = typeof inventoryMovements.$inferSelect;

export type InsertMaterial = z.input<typeof insertMaterialSchema>;
export type UpdateMaterialRequest = Partial<InsertMaterial>;

export type InsertProduct = z.input<typeof insertProductSchema>;
export type CreateProductInput = z.input<typeof createProductInputSchema>;
export type UpdateProductInput = z.input<typeof updateProductInputSchema>;

export type BomItemInput = z.input<typeof bomItemInputSchema>;

export type InsertProductionOrder = z.input<typeof insertProductionOrderSchema>;
export type ConcludeProductionOrderInput = z.input<typeof concludeProductionOrderSchema>;
export type VariableConsumptionInput = z.input<typeof variableConsumptionInputSchema>;

export type InsertSale = z.input<typeof insertSaleSchema>;

export type InsertInventoryMovement = z.input<typeof insertInventoryMovementSchema>;

export type ProductWithBom = Product & { bomItems: BomItem[] };
export type ProductionOrderWithProduct = ProductionOrder & { product: Product };
export type SaleListItem = SaleItem & { sale: Sale; product: Product };

export type MovementWithDetails = InventoryMovement & {
  product?: Product | null;
  material?: Material | null;
};

export type PaginatedResponse<T> = { items: T[]; total?: number };
