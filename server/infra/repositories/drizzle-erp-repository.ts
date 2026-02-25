import { and, desc, eq } from "drizzle-orm";
import {
  boms,
  bomItems,
  inventoryMovements,
  materials,
  products,
  productionOrders,
  productionVariableConsumptions,
  saleItems,
  sales,
  type BomItem,
  type BomItemInput,
  type InsertInventoryMovement,
  type InsertMaterial,
  type InsertProduct,
  type InsertProductionOrder,
  type InventoryMovement,
  type Material,
  type MovementWithDetails,
  type Product,
  type ProductWithBom,
  type ProductionOrder,
  type ProductionOrderWithProduct,
  type ProductionVariableConsumption,
  type Sale,
  type SaleItem,
  type SaleListItem,
  type UpdateMaterialRequest,
  type UpdateProductInput,
  type VariableConsumptionInput,
} from "@shared/schema";
import type { IErpRepository } from "../../application/contracts/erp-repository";
import { db } from "../../db";

export class DrizzleErpRepository implements IErpRepository {
  constructor(private readonly database: any = db) {}

  async withTransaction<T>(callback: (repository: IErpRepository) => Promise<T>): Promise<T> {
    return this.database.transaction(async (tx: any) => {
      const repository = new DrizzleErpRepository(tx);
      return callback(repository);
    });
  }

  async getMaterials(): Promise<Material[]> {
    return (await this.database.select().from(materials).orderBy(materials.name)) as Material[];
  }

  async getMaterial(id: number): Promise<Material | undefined> {
    const [material] = (await this.database.select().from(materials).where(eq(materials.id, id))) as Material[];
    return material;
  }

  async getMaterialByName(name: string): Promise<Material | undefined> {
    const [material] = (await this.database.select().from(materials).where(eq(materials.name, name))) as Material[];
    return material;
  }

  async createMaterial(material: InsertMaterial): Promise<Material> {
    const [created] = (await this.database.insert(materials).values(material).returning()) as Material[];
    return created;
  }

  async updateMaterial(id: number, updates: UpdateMaterialRequest): Promise<Material> {
    const [updated] = (await this.database
      .update(materials)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(materials.id, id))
      .returning()) as Material[];
    return updated;
  }

  async deactivateMaterial(id: number): Promise<void> {
    await this.database.update(materials).set({ isActive: 0, updatedAt: new Date() }).where(eq(materials.id, id));
  }

  async updateMaterialStockQty(id: number, stockQty: string | null): Promise<void> {
    await this.database.update(materials).set({ stockQty, updatedAt: new Date() }).where(eq(materials.id, id));
  }

  async getProducts(): Promise<ProductWithBom[]> {
    const allProducts = (await this.database.select().from(products).orderBy(products.name)) as Product[];
    const activeBoms = (await this.database.select().from(boms).where(eq(boms.isActive, 1))) as Array<typeof boms.$inferSelect>;
    const allBomItems = (await this.database.select().from(bomItems)) as BomItem[];

    return allProducts.map((product) => {
      const activeBom = activeBoms.find((bom) => bom.productId === product.id);
      return {
        ...product,
        bomItems: activeBom ? allBomItems.filter((item) => item.bomId === activeBom.id) : [],
      };
    });
  }

  async getProduct(id: number): Promise<ProductWithBom | undefined> {
    const [product] = (await this.database.select().from(products).where(eq(products.id, id))) as Product[];
    if (!product) return undefined;

    const [activeBom] = (await this.database
      .select()
      .from(boms)
      .where(and(eq(boms.productId, id), eq(boms.isActive, 1)))) as Array<typeof boms.$inferSelect>;

    const items =
      activeBom === undefined
        ? []
        : ((await this.database.select().from(bomItems).where(eq(bomItems.bomId, activeBom.id))) as BomItem[]);

    return { ...product, bomItems: items };
  }

  async getProductByName(name: string): Promise<Product | undefined> {
    const [product] = (await this.database.select().from(products).where(eq(products.name, name))) as Product[];
    return product;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [created] = (await this.database.insert(products).values(product).returning()) as Product[];
    return created;
  }

  async updateProductBase(id: number, input: UpdateProductInput["product"]): Promise<Product> {
    const [updated] = (await this.database
      .update(products)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning()) as Product[];
    return updated;
  }

  async deactivateProduct(id: number): Promise<void> {
    await this.database.update(products).set({ isActive: 0, updatedAt: new Date() }).where(eq(products.id, id));
  }

  async updateProductStockQty(id: number, stockQty: number): Promise<void> {
    await this.database.update(products).set({ stockQty, updatedAt: new Date() }).where(eq(products.id, id));
  }

  async getActiveBomByProductId(productId: number): Promise<{ id: number; items: BomItem[] } | undefined> {
    const [activeBom] = (await this.database
      .select()
      .from(boms)
      .where(and(eq(boms.productId, productId), eq(boms.isActive, 1)))) as Array<typeof boms.$inferSelect>;

    if (!activeBom) return undefined;

    const items = (await this.database.select().from(bomItems).where(eq(bomItems.bomId, activeBom.id))) as BomItem[];

    return { id: activeBom.id, items };
  }

  async replaceActiveBom(productId: number, items: BomItemInput[]): Promise<{ id: number; items: BomItem[] }> {
    await this.database.update(boms).set({ isActive: 0, updatedAt: new Date() }).where(and(eq(boms.productId, productId), eq(boms.isActive, 1)));

    const [createdBom] = (await this.database
      .insert(boms)
      .values({ productId, isActive: 1, updatedAt: new Date() })
      .returning()) as Array<typeof boms.$inferSelect>;

    if (items.length === 0) {
      return { id: createdBom.id, items: [] };
    }

    const values = items.map((item) => {
      if (item.itemType === "FIXED_MATERIAL") {
        return {
          bomId: createdBom.id,
          itemType: item.itemType,
          materialId: item.materialId,
          materialGroup: null,
          qtyPerUnit: item.qtyPerUnit,
          plannedQtyPerUnit: null,
          unit: null,
        };
      }

      return {
        bomId: createdBom.id,
        itemType: item.itemType,
        materialId: null,
        materialGroup: item.materialGroup,
        qtyPerUnit: null,
        plannedQtyPerUnit: item.plannedQtyPerUnit,
        unit: item.unit,
      };
    });

    const createdItems = (await this.database.insert(bomItems).values(values).returning()) as BomItem[];
    return { id: createdBom.id, items: createdItems };
  }

  async getProductionOrders(): Promise<ProductionOrderWithProduct[]> {
    const allOrders = (await this.database.select().from(productionOrders).orderBy(desc(productionOrders.createdAt))) as ProductionOrder[];
    const allProducts = (await this.database.select().from(products)) as Product[];

    return allOrders
      .map((order) => {
        const product = allProducts.find((entry) => entry.id === order.productId);
        if (!product) return undefined;
        return { ...order, product };
      })
      .filter((item): item is ProductionOrderWithProduct => item !== undefined);
  }

  async getProductionOrder(id: number): Promise<ProductionOrderWithProduct | undefined> {
    const [order] = (await this.database.select().from(productionOrders).where(eq(productionOrders.id, id))) as ProductionOrder[];
    if (!order) return undefined;

    const [product] = (await this.database.select().from(products).where(eq(products.id, order.productId))) as Product[];
    if (!product) return undefined;

    return { ...order, product };
  }

  async createProductionOrder(data: InsertProductionOrder): Promise<ProductionOrder> {
    const [created] = (await this.database
      .insert(productionOrders)
      .values({ productId: data.productId, qtyPlanned: data.qtyPlanned, status: "OPEN" })
      .returning()) as ProductionOrder[];
    return created;
  }

  async markProductionOrderDone(id: number, completedAt: Date): Promise<ProductionOrder> {
    const [updated] = (await this.database
      .update(productionOrders)
      .set({ status: "DONE", completedAt })
      .where(eq(productionOrders.id, id))
      .returning()) as ProductionOrder[];
    return updated;
  }

  async createProductionVariableConsumptions(opId: number, consumptions: VariableConsumptionInput[]): Promise<ProductionVariableConsumption[]> {
    if (consumptions.length === 0) return [];

    const rows = consumptions.map((consumption) => ({
      productionOrderId: opId,
      materialGroup: consumption.materialGroup,
      quantityUsed: consumption.quantityUsed,
      thicknessMm: consumption.thicknessMm,
      panelsCount: consumption.panelsCount ?? null,
      note: consumption.note ?? null,
    }));

    return (await this.database.insert(productionVariableConsumptions).values(rows).returning()) as ProductionVariableConsumption[];
  }

  async getProductionVariableConsumptions(opId: number): Promise<ProductionVariableConsumption[]> {
    return (await this.database
      .select()
      .from(productionVariableConsumptions)
      .where(eq(productionVariableConsumptions.productionOrderId, opId))) as ProductionVariableConsumption[];
  }

  async createSale(data: { paymentMethod: string; totalAmount: string }): Promise<Sale> {
    const [created] = (await this.database
      .insert(sales)
      .values({ paymentMethod: data.paymentMethod, totalAmount: data.totalAmount })
      .returning()) as Sale[];
    return created;
  }

  async createSaleItems(saleId: number, items: Array<{ productId: number; qty: number; unitPrice: string; totalPrice: string }>): Promise<SaleItem[]> {
    const rows = items.map((item) => ({
      saleId,
      productId: item.productId,
      qty: item.qty,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
    }));

    return (await this.database.insert(saleItems).values(rows).returning()) as SaleItem[];
  }

  async getSales(): Promise<SaleListItem[]> {
    const allSaleItems = (await this.database.select().from(saleItems).orderBy(desc(saleItems.createdAt))) as SaleItem[];
    const allSales = (await this.database.select().from(sales)) as Sale[];
    const allProducts = (await this.database.select().from(products)) as Product[];

    return allSaleItems
      .map((item) => {
        const sale = allSales.find((entry) => entry.id === item.saleId);
        const product = allProducts.find((entry) => entry.id === item.productId);
        if (!sale || !product) return undefined;
        return { ...item, sale, product };
      })
      .filter((item): item is SaleListItem => item !== undefined);
  }

  async getSaleWithItems(id: number): Promise<{ sale: Sale; items: Array<SaleItem & { product: Product }> } | undefined> {
    const [sale] = (await this.database.select().from(sales).where(eq(sales.id, id))) as Sale[];
    if (!sale) return undefined;

    const entries = (await this.database.select().from(saleItems).where(eq(saleItems.saleId, id))) as SaleItem[];
    const allProducts = (await this.database.select().from(products)) as Product[];

    const items = entries
      .map((item) => {
        const product = allProducts.find((entry) => entry.id === item.productId);
        if (!product) return undefined;
        return { ...item, product };
      })
      .filter((item): item is SaleItem & { product: Product } => item !== undefined);

    return { sale, items };
  }

  async getInventoryMovements(): Promise<MovementWithDetails[]> {
    const allMovements = (await this.database.select().from(inventoryMovements).orderBy(desc(inventoryMovements.createdAt))) as MovementWithDetails[];
    const allProducts = (await this.database.select().from(products)) as Product[];
    const allMaterials = (await this.database.select().from(materials)) as Material[];

    return allMovements.map((movement) => ({
      ...movement,
      product: movement.entityType === "PRODUCT" && movement.entityId ? allProducts.find((entry) => entry.id === movement.entityId) ?? null : null,
      material: movement.entityType === "MATERIAL" && movement.entityId ? allMaterials.find((entry) => entry.id === movement.entityId) ?? null : null,
    }));
  }

  async createInventoryMovement(movement: InsertInventoryMovement): Promise<InventoryMovement> {
    const [created] = (await this.database.insert(inventoryMovements).values(movement).returning()) as InventoryMovement[];
    return created;
  }
}
