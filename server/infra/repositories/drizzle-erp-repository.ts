import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import {
  boms,
  bomItems,
  inventoryMovements,
  materials,
  products,
  producedProductStocks,
  productionOrders,
  purchaseOrders,
  purchaseOrderItems,
  saleItems,
  sales,
  type BomItem,
  type BomItemInput,
  type CreateManyMaterialsInput,
  type InsertInventoryMovement,
  type InsertMaterial,
  type InsertProduct,
  type InsertProductionOrder,
  type InventoryMovement,
  type Material,
  type MovementWithDetails,
  type MoveProductionOrderInput,
  type Product,
  type ProductWithBom,
  type ProducedProductStock,
  type ProducedProductStockWithProduct,
  type ProductionOrder,
  type ProductionOrderWithProduct,
  type PurchaseOrder,
  type PurchaseOrderItem,
  type PurchaseOrderWithItems,
  type Sale,
  type SaleItem,
  type SaleListItem,
  type UpdateMaterialRequest,
  type UpdateProductInput,
} from "@shared/schema.ts";
import type { IErpRepository } from "../../application/contracts/erp-repository.ts";
import type { CreateInventoryMovementData } from "../../application/contracts/sales-repository.ts";

export class DrizzleErpRepository implements IErpRepository {
  constructor(private readonly database: any) {}

  private async getNextProductionSortOrder(status: "BACKLOG" | "IN_PROGRESS" | "DONE"): Promise<number> {
    const [result] = (await this.database
      .select({ maxSortOrder: sql<number>`coalesce(max(${productionOrders.sortOrder}), -1)` })
      .from(productionOrders)
      .where(eq(productionOrders.status, status))) as Array<{ maxSortOrder: number }>;

    return Number(result?.maxSortOrder ?? -1) + 1;
  }

  async withTransaction<T>(callback: (repository: IErpRepository) => Promise<T>): Promise<T> {
    return this.database.transaction(async (tx: any) => {
      const repository = new DrizzleErpRepository(tx);
      return callback(repository);
    });
  }

  async getMaterials(): Promise<Material[]> {
    return (await this.database
      .select()
      .from(materials)
      .where(eq(materials.isActive, 1))
      .orderBy(materials.name)) as Material[];
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

  async createManyMaterials(input: CreateManyMaterialsInput): Promise<Material[]> {
    return (await this.database.insert(materials).values(input.items).returning()) as Material[];
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

  async updateMaterialStockQty(id: number, stockQty: string): Promise<void> {
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

    return {
      ...product,
      bomItems: items,
    };
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

  async getProducedProductStocks(): Promise<ProducedProductStockWithProduct[]> {
    const allStocks = (await this.database.select().from(producedProductStocks).orderBy(producedProductStocks.productId)) as ProducedProductStock[];
    const allProducts = (await this.database.select().from(products).orderBy(products.name)) as Product[];

    return allStocks
      .map((stock) => {
        const product = allProducts.find((entry) => entry.id === stock.productId);
        if (!product) return undefined;
        return { ...stock, product };
      })
      .filter((item): item is ProducedProductStockWithProduct => item !== undefined);
  }

  async getProducedProductStockByProductId(productId: number): Promise<ProducedProductStockWithProduct | undefined> {
    const [stock] = (await this.database.select().from(producedProductStocks).where(eq(producedProductStocks.productId, productId))) as ProducedProductStock[];
    if (!stock) return undefined;

    const [product] = (await this.database.select().from(products).where(eq(products.id, productId))) as Product[];
    if (!product) return undefined;

    return { ...stock, product };
  }

  async createProducedProductStock(productId: number): Promise<ProducedProductStock> {
    const [created] = (await this.database.insert(producedProductStocks).values({ productId, stockQty: 0 }).returning()) as ProducedProductStock[];
    return created;
  }

  async updateProducedProductStockQty(productId: number, stockQty: number): Promise<void> {
    await this.database
      .update(producedProductStocks)
      .set({ stockQty, updatedAt: new Date() })
      .where(eq(producedProductStocks.productId, productId));
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

  async replaceActiveBom(
    productId: number,
    technicalSpec: { bomItems: BomItemInput[] },
  ): Promise<{ id: number; items: BomItem[] }> {
    await this.database.update(boms).set({ isActive: 0, updatedAt: new Date() }).where(and(eq(boms.productId, productId), eq(boms.isActive, 1)));

    const [createdBom] = (await this.database
      .insert(boms)
      .values({
        productId,
        isActive: 1,
        updatedAt: new Date(),
      })
      .returning()) as Array<typeof boms.$inferSelect>;

    if (technicalSpec.bomItems.length === 0) {
      return {
        id: createdBom.id,
        items: [],
      };
    }

    const values = technicalSpec.bomItems.map((item) => ({
      bomId: createdBom.id,
      materialId: item.materialId,
      qtyPerUnit: item.qtyPerUnit,
    }));

    const createdItems = (await this.database.insert(bomItems).values(values).returning()) as BomItem[];

    return {
      id: createdBom.id,
      items: createdItems,
    };
  }

  async getProductionOrders(): Promise<ProductionOrderWithProduct[]> {
    const allOrders = (await this.database.select().from(productionOrders).orderBy(asc(productionOrders.sortOrder), desc(productionOrders.createdAt), desc(productionOrders.id))) as ProductionOrder[];
    const allProducts = (await this.database.select().from(products)) as Product[];
    const statusOrder = new Map([
      ["BACKLOG", 0],
      ["IN_PROGRESS", 1],
      ["DONE", 2],
    ]);

    return allOrders
      .map((order) => {
        const product = allProducts.find((entry) => entry.id === order.productId);
        if (!product) return undefined;
        return { ...order, product };
      })
      .filter((item): item is ProductionOrderWithProduct => item !== undefined)
      .sort((left, right) => {
        const leftOrder = statusOrder.get(left.status) ?? 0;
        const rightOrder = statusOrder.get(right.status) ?? 0;
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
        if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      });
  }

  async getProductionOrder(id: number): Promise<ProductionOrderWithProduct | undefined> {
    const [order] = (await this.database.select().from(productionOrders).where(eq(productionOrders.id, id))) as ProductionOrder[];
    if (!order) return undefined;

    const [product] = (await this.database.select().from(products).where(eq(products.id, order.productId))) as Product[];
    if (!product) return undefined;

    return { ...order, product };
  }

  async createProductionOrder(data: InsertProductionOrder): Promise<ProductionOrder> {
    const sortOrder = await this.getNextProductionSortOrder("BACKLOG");
    const [created] = (await this.database
      .insert(productionOrders)
      .values({
        productId: data.productId,
        qtyPlanned: data.qtyPlanned,
        status: "BACKLOG",
        salesChannel: data.salesChannel,
        dueAt: data.dueAt ? new Date(data.dueAt) : null,
        sortOrder,
      })
      .returning()) as ProductionOrder[];
    return created;
  }

  async moveProductionOrder(id: number, input: MoveProductionOrderInput): Promise<ProductionOrder> {
    await this.database
      .update(productionOrders)
      .set({ status: input.status })
      .where(eq(productionOrders.id, id));

    for (let index = 0; index < input.orderedIds.length; index += 1) {
      const orderId = input.orderedIds[index];
      await this.database
        .update(productionOrders)
        .set({ status: input.status, sortOrder: index })
        .where(eq(productionOrders.id, orderId));
    }

    const [updated] = (await this.database.select().from(productionOrders).where(eq(productionOrders.id, id))) as ProductionOrder[];
    return updated;
  }

  async markProductionOrderDone(id: number, completedAt: Date): Promise<ProductionOrder> {
    const sortOrder = await this.getNextProductionSortOrder("DONE");
    const [updated] = (await this.database
      .update(productionOrders)
      .set({ status: "DONE", sortOrder, completedAt })
      .where(eq(productionOrders.id, id))
      .returning()) as ProductionOrder[];
    return updated;
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

  async createInventoryMovement(movement: CreateInventoryMovementData): Promise<InventoryMovement> {
    const insertMovement: InsertInventoryMovement = {
      entityType: movement.entityType,
      entityId: movement.entityId ?? null,
      direction: movement.direction,
      qty: movement.qty.toFixed(3),
      reason: movement.reason,
      referenceType: movement.referenceType,
      referenceId: movement.referenceId ?? null,
      metadata: movement.metadata ?? null,
    };

    const [created] = (await this.database.insert(inventoryMovements).values(insertMovement).returning()) as InventoryMovement[];
    return created;
  }

  async getPurchaseOrders(): Promise<PurchaseOrderWithItems[]> {
    const orders = (await this.database
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.isActive, 1))
      .orderBy(desc(purchaseOrders.id))) as PurchaseOrder[];

    if (orders.length === 0) return [];

    const orderIds = orders.map((order) => order.id);
    const items = (await this.database
      .select()
      .from(purchaseOrderItems)
      .where(inArray(purchaseOrderItems.purchaseOrderId, orderIds))
      .orderBy(asc(purchaseOrderItems.id))) as PurchaseOrderItem[];

    const itemsByOrderId = new Map<number, PurchaseOrderItem[]>();
    for (const item of items) {
      const current = itemsByOrderId.get(item.purchaseOrderId) ?? [];
      current.push(item);
      itemsByOrderId.set(item.purchaseOrderId, current);
    }

    return orders.map((order) => ({ ...order, items: itemsByOrderId.get(order.id) ?? [] }));
  }

  async getPurchaseOrder(id: number): Promise<PurchaseOrderWithItems | undefined> {
    const [order] = (await this.database.select().from(purchaseOrders).where(eq(purchaseOrders.id, id))) as PurchaseOrder[];
    if (!order) return undefined;

    const items = (await this.database
      .select()
      .from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.purchaseOrderId, id))
      .orderBy(asc(purchaseOrderItems.id))) as PurchaseOrderItem[];

    return { ...order, items };
  }

  async createPurchaseOrderBase(): Promise<PurchaseOrder> {
    const [created] = (await this.database.insert(purchaseOrders).values({}).returning()) as PurchaseOrder[];
    return created;
  }

  async updatePurchaseOrderBase(
    id: number,
    input: Partial<Pick<PurchaseOrder, "status" | "isActive" | "receivedAt">>,
  ): Promise<PurchaseOrder> {
    const [updated] = (await this.database
      .update(purchaseOrders)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(purchaseOrders.id, id))
      .returning()) as PurchaseOrder[];
    return updated;
  }

  async createPurchaseOrderItems(
    purchaseOrderId: number,
    items: Array<Pick<PurchaseOrderItem, "materialId" | "materialName" | "qtyOrdered" | "qtyReceived">>,
  ): Promise<PurchaseOrderItem[]> {
    const payload = items.map((item) => ({
      purchaseOrderId,
      materialId: item.materialId ?? null,
      materialName: item.materialName,
      qtyOrdered: item.qtyOrdered,
      qtyReceived: item.qtyReceived,
    }));
    return (await this.database.insert(purchaseOrderItems).values(payload).returning()) as PurchaseOrderItem[];
  }

  async updatePurchaseOrderItem(
    id: number,
    input: Partial<Pick<PurchaseOrderItem, "materialId" | "materialName" | "qtyOrdered" | "qtyReceived">>,
  ): Promise<PurchaseOrderItem> {
    const [updated] = (await this.database
      .update(purchaseOrderItems)
      .set({ ...input })
      .where(eq(purchaseOrderItems.id, id))
      .returning()) as PurchaseOrderItem[];
    return updated;
  }

  async deletePurchaseOrderItem(id: number): Promise<void> {
    await this.database.delete(purchaseOrderItems).where(eq(purchaseOrderItems.id, id));
  }
}
