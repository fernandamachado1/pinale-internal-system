import { pgTable, text, serial, integer, boolean, timestamp, numeric } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// --- TABLES ---

// Insumos/materiais
export const materials = pgTable("materials", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  unit: text("unit").notNull(), // e.g., 'm', 'kg', 'un'
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Produtos/artigos
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Ficha Técnica (Relacionamento entre Produto e Insumo)
export const technicalSpecs = pgTable("technical_specs", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  materialId: integer("material_id").notNull(),
  quantityRequired: numeric("quantity_required", { precision: 10, scale: 2 }).notNull(),
});

// Produção (Ordens de produção)
export const productions = pgTable("productions", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  quantityProduced: integer("quantity_produced").notNull(),
  status: text("status").notNull().default("completed"), // 'pending', 'completed'
  createdAt: timestamp("created_at").defaultNow(),
});

// Vendas
export const sales = pgTable("sales", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  quantitySold: integer("quantity_sold").notNull(),
  paymentMethod: text("payment_method").notNull(),
  totalPrice: numeric("total_price", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Movimentações de Estoque
export const inventoryMovements = pgTable("inventory_movements", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // 'material_in', 'material_out', 'product_in', 'product_out', 'adjustment'
  sourceId: integer("source_id"), // ID of production, sale, etc.
  materialId: integer("material_id"),
  productId: integer("product_id"),
  quantityChange: numeric("quantity_change", { precision: 10, scale: 2 }).notNull(), // positive or negative
  reason: text("reason").notNull(), // 'purchase', 'production', 'sale', 'adjustment'
  createdAt: timestamp("created_at").defaultNow(),
});

// --- RELATIONS ---

export const productsRelations = relations(products, ({ many }) => ({
  technicalSpecs: many(technicalSpecs),
  productions: many(productions),
  sales: many(sales),
  inventoryMovements: many(inventoryMovements),
}));

export const materialsRelations = relations(materials, ({ many }) => ({
  technicalSpecs: many(technicalSpecs),
  inventoryMovements: many(inventoryMovements),
}));

export const technicalSpecsRelations = relations(technicalSpecs, ({ one }) => ({
  product: one(products, {
    fields: [technicalSpecs.productId],
    references: [products.id],
  }),
  material: one(materials, {
    fields: [technicalSpecs.materialId],
    references: [materials.id],
  }),
}));

export const productionsRelations = relations(productions, ({ one }) => ({
  product: one(products, {
    fields: [productions.productId],
    references: [products.id],
  }),
}));

export const salesRelations = relations(sales, ({ one }) => ({
  product: one(products, {
    fields: [sales.productId],
    references: [products.id],
  }),
}));

export const inventoryMovementsRelations = relations(inventoryMovements, ({ one }) => ({
  product: one(products, {
    fields: [inventoryMovements.productId],
    references: [products.id],
  }),
  material: one(materials, {
    fields: [inventoryMovements.materialId],
    references: [materials.id],
  }),
}));

// --- BASE SCHEMAS ---

export const insertMaterialSchema = createInsertSchema(materials).omit({ id: true, createdAt: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true });
export const insertTechnicalSpecSchema = createInsertSchema(technicalSpecs).omit({ id: true });
export const insertProductionSchema = createInsertSchema(productions).omit({ id: true, createdAt: true, status: true });
export const insertSaleSchema = createInsertSchema(sales).omit({ id: true, createdAt: true });
export const insertInventoryMovementSchema = createInsertSchema(inventoryMovements).omit({ id: true, createdAt: true });

// --- EXPLICIT API CONTRACT TYPES ---

// Models
export type Material = typeof materials.$inferSelect;
export type Product = typeof products.$inferSelect;
export type TechnicalSpec = typeof technicalSpecs.$inferSelect;
export type Production = typeof productions.$inferSelect;
export type Sale = typeof sales.$inferSelect;
export type InventoryMovement = typeof inventoryMovements.$inferSelect;

// Material
export type InsertMaterial = z.infer<typeof insertMaterialSchema>;
export type UpdateMaterialRequest = Partial<InsertMaterial>;
export type MaterialAdjustmentRequest = { quantityChange: string; reason: string };

// Product
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type UpdateProductRequest = Partial<InsertProduct>;
export type ProductWithSpecs = Product & { technicalSpecs: (TechnicalSpec & { material: Material })[] };

// Technical Spec
export type InsertTechnicalSpec = z.infer<typeof insertTechnicalSpecSchema>;

// Production
export type InsertProduction = z.infer<typeof insertProductionSchema>;
export type ProductionWithProduct = Production & { product: Product };

// Sale
export type InsertSale = z.infer<typeof insertSaleSchema>;
export type SaleWithProduct = Sale & { product: Product };

// Inventory Movement
export type InsertInventoryMovement = z.infer<typeof insertInventoryMovementSchema>;
export type MovementWithDetails = InventoryMovement & { product?: Product, material?: Material };

// Reponses
export type PaginatedResponse<T> = { items: T[]; total?: number };
