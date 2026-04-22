import { and, asc, desc, eq, ilike, inArray, sql, type SQL } from "drizzle-orm";
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
  type CatalogProduct,
  type Product,
  type ProductWithBom,
  type ProducedProductStock,
  type ProducedProductStockSummary,
  type ProducedProductStockWithProduct,
  type ProductionOrder,
  type ProductionOrderWithProduct,
  type PurchaseOrder,
  type PurchaseOrderItem,
  type PurchaseOrderWithItems,
  type ReorderPurchaseOrdersInput,
  type Sale,
  type SaleItem,
  type SaleListItem,
  type UpdateMaterialRequest,
  type UpdateProductInput,
} from "@shared/schema.ts";
import type { IErpRepository } from "../../application/contracts/erp-repository.ts";
import type { CreateInventoryMovementData } from "../../application/contracts/sales-repository.ts";

export class DrizzleErpRepository implements IErpRepository {
  constructor(
    private readonly database: any,
    private readonly orgId?: string,
  ) {}

  private orgIdValue(): string | SQL<unknown> {
    return this.orgId ?? sql`public.ensure_default_org_id()`;
  }

  private orgWhere<T extends { orgId: any }>(table: T): SQL<unknown> | undefined {
    if (!this.orgId) return undefined;
    return eq((table as any).orgId, this.orgId);
  }

  private async getNextProductionSortOrder(status: "BACKLOG" | "IN_PROGRESS" | "DONE"): Promise<number> {
    const [result] = (await this.database
      .select({ maxSortOrder: sql<number>`coalesce(max(${productionOrders.sortOrder}), -1)` })
      .from(productionOrders)
      .where(
        and(
          eq(productionOrders.status, status),
          ...(this.orgId ? [eq(productionOrders.orgId, this.orgId)] : []),
        ),
      )) as Array<{ maxSortOrder: number }>;

    return Number(result?.maxSortOrder ?? -1) + 1;
  }

  private async getNextPurchaseOrderSortOrder(): Promise<number> {
    const [result] = (await this.database
      .select({ maxSortOrder: sql<number>`coalesce(max(${purchaseOrders.sortOrder}), -1)` })
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.isActive, 1),
          ...(this.orgId ? [eq(purchaseOrders.orgId, this.orgId)] : []),
        ),
      )) as Array<{ maxSortOrder: number }>;

    return Number(result?.maxSortOrder ?? -1) + 1;
  }

  async withTransaction<T>(callback: (repository: IErpRepository) => Promise<T>): Promise<T> {
    return this.database.transaction(async (tx: any) => {
      const repository = new DrizzleErpRepository(tx, this.orgId);
      return callback(repository);
    });
  }

  async getMaterials(): Promise<Material[]> {
    const conditions = [eq(materials.isActive, 1)];
    if (this.orgId) conditions.push(eq(materials.orgId, this.orgId));
    return (await this.database.select().from(materials).where(and(...conditions)).orderBy(materials.name)) as Material[];
  }

  async getMaterial(id: number): Promise<Material | undefined> {
    const conditions = [eq(materials.id, id)];
    if (this.orgId) conditions.push(eq(materials.orgId, this.orgId));
    const [material] = (await this.database.select().from(materials).where(and(...conditions))) as Material[];
    return material;
  }

  async getMaterialByName(name: string): Promise<Material | undefined> {
    const conditions = [eq(materials.name, name)];
    if (this.orgId) conditions.push(eq(materials.orgId, this.orgId));
    const [material] = (await this.database.select().from(materials).where(and(...conditions))) as Material[];
    return material;
  }

  async createMaterial(material: InsertMaterial): Promise<Material> {
    const [created] = (await this.database
      .insert(materials)
      .values({ ...material, orgId: this.orgIdValue() } as any)
      .returning()) as Material[];
    return created;
  }

  async createManyMaterials(input: CreateManyMaterialsInput): Promise<Material[]> {
    const values = input.items.map((item) => ({ ...item, orgId: this.orgIdValue() })) as any[];
    return (await this.database.insert(materials).values(values).returning()) as Material[];
  }

  async updateMaterial(id: number, updates: UpdateMaterialRequest): Promise<Material> {
    const conditions = [eq(materials.id, id)];
    if (this.orgId) conditions.push(eq(materials.orgId, this.orgId));
    const [updated] = (await this.database
      .update(materials)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(...conditions))
      .returning()) as Material[];
    return updated;
  }

  async deactivateMaterial(id: number): Promise<void> {
    const conditions = [eq(materials.id, id)];
    if (this.orgId) conditions.push(eq(materials.orgId, this.orgId));
    await this.database.update(materials).set({ isActive: 0, updatedAt: new Date() }).where(and(...conditions));
  }

  async updateMaterialStockQty(id: number, stockQty: string): Promise<void> {
    const conditions = [eq(materials.id, id)];
    if (this.orgId) conditions.push(eq(materials.orgId, this.orgId));
    await this.database.update(materials).set({ stockQty, updatedAt: new Date() }).where(and(...conditions));
  }

  async getProducts(): Promise<ProductWithBom[]> {
    const productsWhere = this.orgId ? eq(products.orgId, this.orgId) : undefined;
    const bomsWhere = and(eq(boms.isActive, 1), ...(this.orgId ? [eq(boms.orgId, this.orgId)] : []));
    const bomItemsWhere = this.orgId ? eq(bomItems.orgId, this.orgId) : undefined;

    const allProducts = (await this.database.select().from(products).where(productsWhere).orderBy(products.name)) as Product[];
    const activeBoms = (await this.database.select().from(boms).where(bomsWhere)) as Array<typeof boms.$inferSelect>;
    const allBomItems = (await this.database.select().from(bomItems).where(bomItemsWhere)) as BomItem[];

    return allProducts.map((product) => {
      const activeBom = activeBoms.find((bom) => bom.productId === product.id);
      return {
        ...product,
        bomItems: activeBom ? allBomItems.filter((item) => item.bomId === activeBom.id) : [],
      };
    });
  }

  async getCatalogProducts(input: { q?: string; page: number; pageSize: number }): Promise<{ items: CatalogProduct[]; total: number }> {
    const query = input.q?.trim();
    const offset = (input.page - 1) * input.pageSize;

    const filters = [
      ...(this.orgId ? [eq(products.orgId, this.orgId)] : []),
      ...(query ? [ilike(products.name, `%${query}%`)] : []),
    ];
    const productsWhere = filters.length > 0 ? and(...filters) : undefined;

    const [totalRow] = (await this.database
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(productsWhere)) as Array<{ count: number }>;
    const total = Number(totalRow?.count ?? 0);

    const pageProducts = (await this.database
      .select()
      .from(products)
      .where(productsWhere)
      .orderBy(products.name)
      .limit(input.pageSize)
      .offset(offset)) as Product[];

    if (pageProducts.length === 0) return { items: [], total };

    const pageProductIds = pageProducts.map((product) => product.id);

    const activeBoms = (await this.database
      .select()
      .from(boms)
      .where(
        and(
          inArray(boms.productId, pageProductIds),
          eq(boms.isActive, 1),
          ...(this.orgId ? [eq(boms.orgId, this.orgId)] : []),
        ),
      )) as Array<typeof boms.$inferSelect>;
    const bomItemsForPage = activeBoms.length === 0
      ? []
      : ((await this.database
        .select()
        .from(bomItems)
        .where(
          and(
            inArray(
              bomItems.bomId,
              activeBoms.map((bom) => bom.id),
            ),
            ...(this.orgId ? [eq(bomItems.orgId, this.orgId)] : []),
          ),
        )) as BomItem[]);

    const stockRows = (await this.database
      .select({ productId: producedProductStocks.productId, stockQty: producedProductStocks.stockQty })
      .from(producedProductStocks)
      .where(
        and(
          inArray(producedProductStocks.productId, pageProductIds),
          ...(this.orgId ? [eq(producedProductStocks.orgId, this.orgId)] : []),
        ),
      )) as Array<{ productId: number; stockQty: number }>;
    const movementTotals = (await this.database
      .select({
        productId: inventoryMovements.entityId,
        direction: inventoryMovements.direction,
        qty: sql<number>`coalesce(sum((${inventoryMovements.qty})::numeric), 0)`,
      })
      .from(inventoryMovements)
      .where(
        and(
          eq(inventoryMovements.entityType, "PRODUCT"),
          inArray(inventoryMovements.entityId, pageProductIds),
          ...(this.orgId ? [eq(inventoryMovements.orgId, this.orgId)] : []),
        ),
      )
      .groupBy(inventoryMovements.entityId, inventoryMovements.direction)) as Array<{
      productId: number | null;
      direction: "IN" | "OUT";
      qty: number;
    }>;

    const stockByProductId = new Map(stockRows.map((row) => [row.productId, Number(row.stockQty)]));
    const inByProductId = new Map<number, number>();
    const outByProductId = new Map<number, number>();

    for (const row of movementTotals) {
      if (!row.productId) continue;
      if (row.direction === "IN") inByProductId.set(row.productId, Number(row.qty));
      else outByProductId.set(row.productId, Number(row.qty));
    }

    const items = pageProducts.map((product) => {
      const activeBom = activeBoms.find((bom) => bom.productId === product.id);
      return {
        ...product,
        bomItems: activeBom ? bomItemsForPage.filter((item) => item.bomId === activeBom.id) : [],
        inQty: inByProductId.get(product.id) ?? 0,
        outQty: outByProductId.get(product.id) ?? 0,
        stockQty: stockByProductId.get(product.id) ?? 0,
      };
    });

    return { items, total };
  }

  async getProduct(id: number): Promise<ProductWithBom | undefined> {
    const productConditions = [eq(products.id, id)];
    if (this.orgId) productConditions.push(eq(products.orgId, this.orgId));
    const [product] = (await this.database.select().from(products).where(and(...productConditions))) as Product[];
    if (!product) return undefined;

    const [activeBom] = (await this.database
      .select()
      .from(boms)
      .where(and(eq(boms.productId, id), eq(boms.isActive, 1)))) as Array<typeof boms.$inferSelect>;

    const items =
      activeBom === undefined
        ? []
        : ((await this.database
          .select()
          .from(bomItems)
          .where(
            and(
              eq(bomItems.bomId, activeBom.id),
              ...(this.orgId ? [eq(bomItems.orgId, this.orgId)] : []),
            ),
          )) as BomItem[]);

    return {
      ...product,
      bomItems: items,
    };
  }

  async getProductByName(name: string): Promise<Product | undefined> {
    const conditions = [eq(products.name, name)];
    if (this.orgId) conditions.push(eq(products.orgId, this.orgId));
    const [product] = (await this.database.select().from(products).where(and(...conditions))) as Product[];
    return product;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [created] = (await this.database
      .insert(products)
      .values({ ...product, orgId: this.orgIdValue() } as any)
      .returning()) as Product[];
    return created;
  }

  async updateProductBase(id: number, input: UpdateProductInput["product"]): Promise<Product> {
    const conditions = [eq(products.id, id)];
    if (this.orgId) conditions.push(eq(products.orgId, this.orgId));
    const [updated] = (await this.database
      .update(products)
      .set({ ...input, updatedAt: new Date() })
      .where(and(...conditions))
      .returning()) as Product[];
    return updated;
  }

  async deactivateProduct(id: number): Promise<void> {
    const conditions = [eq(products.id, id)];
    if (this.orgId) conditions.push(eq(products.orgId, this.orgId));
    await this.database.update(products).set({ isActive: 0, updatedAt: new Date() }).where(and(...conditions));
  }

  async getProducedProductStocks(): Promise<ProducedProductStockWithProduct[]> {
    const stocksWhere = this.orgId ? eq(producedProductStocks.orgId, this.orgId) : undefined;
    const productsWhere = this.orgId ? eq(products.orgId, this.orgId) : undefined;
    const allStocks = (await this.database
      .select()
      .from(producedProductStocks)
      .where(stocksWhere)
      .orderBy(producedProductStocks.productId)) as ProducedProductStock[];
    const allProducts = (await this.database.select().from(products).where(productsWhere).orderBy(products.name)) as Product[];

    return allStocks
      .map((stock) => {
        const product = allProducts.find((entry) => entry.id === stock.productId);
        if (!product) return undefined;
        return { ...stock, product };
      })
      .filter((item): item is ProducedProductStockWithProduct => item !== undefined);
  }

  async getProducedProductStockSummary(): Promise<ProducedProductStockSummary[]> {
    const productsWhere = this.orgId ? eq(products.orgId, this.orgId) : undefined;
    const stocksWhere = this.orgId ? eq(producedProductStocks.orgId, this.orgId) : undefined;
    const movementsWhere = and(
      eq(inventoryMovements.entityType, "PRODUCT"),
      ...(this.orgId ? [eq(inventoryMovements.orgId, this.orgId)] : []),
    );

    const allProducts = (await this.database
      .select({ id: products.id })
      .from(products)
      .where(productsWhere)) as Array<{ id: number }>;
    const allStocks = (await this.database
      .select({ productId: producedProductStocks.productId, stockQty: producedProductStocks.stockQty })
      .from(producedProductStocks)
      .where(stocksWhere)) as Array<{ productId: number; stockQty: number }>;
    const movementTotals = (await this.database
      .select({
        productId: inventoryMovements.entityId,
        direction: inventoryMovements.direction,
        qty: sql<number>`coalesce(sum((${inventoryMovements.qty})::numeric), 0)`,
      })
      .from(inventoryMovements)
      .where(movementsWhere)
      .groupBy(inventoryMovements.entityId, inventoryMovements.direction)) as Array<{
      productId: number | null;
      direction: "IN" | "OUT";
      qty: number;
    }>;

    const stockByProductId = new Map(allStocks.map((row) => [row.productId, Number(row.stockQty)]));
    const inByProductId = new Map<number, number>();
    const outByProductId = new Map<number, number>();

    for (const row of movementTotals) {
      if (!row.productId) continue;
      if (row.direction === "IN") inByProductId.set(row.productId, Number(row.qty));
      else outByProductId.set(row.productId, Number(row.qty));
    }

    return allProducts.map((product) => ({
      productId: product.id,
      inQty: inByProductId.get(product.id) ?? 0,
      outQty: outByProductId.get(product.id) ?? 0,
      stockQty: stockByProductId.get(product.id) ?? 0,
    }));
  }

  async getProducedProductStockByProductId(productId: number): Promise<ProducedProductStockWithProduct | undefined> {
    const stockConditions = [eq(producedProductStocks.productId, productId)];
    if (this.orgId) stockConditions.push(eq(producedProductStocks.orgId, this.orgId));
    const [stock] = (await this.database
      .select()
      .from(producedProductStocks)
      .where(and(...stockConditions))) as ProducedProductStock[];
    if (!stock) return undefined;

    const productConditions = [eq(products.id, productId)];
    if (this.orgId) productConditions.push(eq(products.orgId, this.orgId));
    const [product] = (await this.database.select().from(products).where(and(...productConditions))) as Product[];
    if (!product) return undefined;

    return { ...stock, product };
  }

  async createProducedProductStock(productId: number): Promise<ProducedProductStock> {
    const [created] = (await this.database
      .insert(producedProductStocks)
      .values({ productId, stockQty: 0, orgId: this.orgIdValue() } as any)
      .returning()) as ProducedProductStock[];
    return created;
  }

  async updateProducedProductStockQty(productId: number, stockQty: number): Promise<void> {
    const conditions = [eq(producedProductStocks.productId, productId)];
    if (this.orgId) conditions.push(eq(producedProductStocks.orgId, this.orgId));
    await this.database
      .update(producedProductStocks)
      .set({ stockQty, updatedAt: new Date() })
      .where(and(...conditions));
  }

  async updateMaterialReservedQty(id: number, reservedQty: string): Promise<void> {
    const conditions = [eq(materials.id, id)];
    if (this.orgId) conditions.push(eq(materials.orgId, this.orgId));
    await this.database
      .update(materials)
      .set({ reservedQty, updatedAt: new Date() })
      .where(and(...conditions));
  }

  async updateMaterialQuantities(id: number, quantities: { stockQty: string; reservedQty: string }): Promise<void> {
    const conditions = [eq(materials.id, id)];
    if (this.orgId) conditions.push(eq(materials.orgId, this.orgId));
    await this.database
      .update(materials)
      .set({ stockQty: quantities.stockQty, reservedQty: quantities.reservedQty, updatedAt: new Date() } as any)
      .where(and(...conditions));
  }

  async getActiveBomByProductId(productId: number): Promise<{ id: number; items: BomItem[] } | undefined> {
    const [activeBom] = (await this.database
      .select()
      .from(boms)
      .where(
        and(
          eq(boms.productId, productId),
          eq(boms.isActive, 1),
          ...(this.orgId ? [eq(boms.orgId, this.orgId)] : []),
        ),
      )) as Array<typeof boms.$inferSelect>;

    if (!activeBom) return undefined;

    const items = (await this.database
      .select()
      .from(bomItems)
      .where(
        and(
          eq(bomItems.bomId, activeBom.id),
          ...(this.orgId ? [eq(bomItems.orgId, this.orgId)] : []),
        ),
      )) as BomItem[];

    return { id: activeBom.id, items };
  }

  async getBomById(bomId: number): Promise<{ id: number; items: BomItem[] } | undefined> {
    const bomConditions = [eq(boms.id, bomId)];
    if (this.orgId) bomConditions.push(eq(boms.orgId, this.orgId));
    const [bom] = (await this.database.select().from(boms).where(and(...bomConditions))) as Array<typeof boms.$inferSelect>;
    if (!bom) return undefined;

    const items = (await this.database
      .select()
      .from(bomItems)
      .where(
        and(
          eq(bomItems.bomId, bom.id),
          ...(this.orgId ? [eq(bomItems.orgId, this.orgId)] : []),
        ),
      )) as BomItem[];

    return { id: bom.id, items };
  }

  async replaceActiveBom(
    productId: number,
    technicalSpec: { bomItems: BomItemInput[] },
  ): Promise<{ id: number; items: BomItem[] } | undefined> {
    await this.database
      .update(boms)
      .set({ isActive: 0, updatedAt: new Date() })
      .where(
        and(
          eq(boms.productId, productId),
          eq(boms.isActive, 1),
          ...(this.orgId ? [eq(boms.orgId, this.orgId)] : []),
        ),
      );

    if (technicalSpec.bomItems.length === 0) {
      return undefined;
    }

    const [createdBom] = (await this.database
      .insert(boms)
      .values({
        orgId: this.orgIdValue(),
        productId,
        isActive: 1,
        updatedAt: new Date(),
      } as any)
      .returning()) as Array<typeof boms.$inferSelect>;

    const values = technicalSpec.bomItems.map((item) => ({
      orgId: this.orgIdValue(),
      bomId: createdBom.id,
      materialId: item.materialId,
      qtyPerUnit: item.qtyPerUnit,
    }));

    const createdItems = (await this.database.insert(bomItems).values(values as any).returning()) as BomItem[];

    return {
      id: createdBom.id,
      items: createdItems,
    };
  }

  async getProductionOrders(): Promise<ProductionOrderWithProduct[]> {
    const ordersWhere = this.orgId ? eq(productionOrders.orgId, this.orgId) : undefined;
    const productsWhere = this.orgId ? eq(products.orgId, this.orgId) : undefined;
    const allOrders = (await this.database
      .select()
      .from(productionOrders)
      .where(ordersWhere)
      .orderBy(asc(productionOrders.sortOrder), desc(productionOrders.createdAt), desc(productionOrders.id))) as ProductionOrder[];
    const allProducts = (await this.database.select().from(products).where(productsWhere)) as Product[];
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
    const orderConditions = [eq(productionOrders.id, id)];
    if (this.orgId) orderConditions.push(eq(productionOrders.orgId, this.orgId));
    const [order] = (await this.database.select().from(productionOrders).where(and(...orderConditions))) as ProductionOrder[];
    if (!order) return undefined;

    const productConditions = [eq(products.id, order.productId)];
    if (this.orgId) productConditions.push(eq(products.orgId, this.orgId));
    const [product] = (await this.database.select().from(products).where(and(...productConditions))) as Product[];
    if (!product) return undefined;

    return { ...order, product };
  }

  async createProductionOrder(data: InsertProductionOrder): Promise<ProductionOrder> {
    const sortOrder = await this.getNextProductionSortOrder("BACKLOG");
    const [created] = (await this.database
      .insert(productionOrders)
      .values({
        orgId: this.orgIdValue(),
        productId: data.productId,
        bomId: (data as any).bomId ?? null,
        qtyPlanned: data.qtyPlanned,
        measureCm: data.measureCm ?? null,
        customizationNotes: data.customizationNotes?.trim() || null,
        status: "BACKLOG",
        salesChannel: data.salesChannel,
        dueAt: data.dueAt ? new Date(data.dueAt) : null,
        sortOrder,
      } as any)
      .returning()) as ProductionOrder[];
    return created;
  }

  async moveProductionOrder(id: number, input: MoveProductionOrderInput): Promise<ProductionOrder> {
    const idConditions = [eq(productionOrders.id, id)];
    if (this.orgId) idConditions.push(eq(productionOrders.orgId, this.orgId));
    await this.database
      .update(productionOrders)
      .set({ status: input.status })
      .where(and(...idConditions));

    for (let index = 0; index < input.orderedIds.length; index += 1) {
      const orderId = input.orderedIds[index];
      const orderConditions = [eq(productionOrders.id, orderId)];
      if (this.orgId) orderConditions.push(eq(productionOrders.orgId, this.orgId));
      await this.database
        .update(productionOrders)
        .set({ status: input.status, sortOrder: index })
        .where(and(...orderConditions));
    }

    const [updated] = (await this.database.select().from(productionOrders).where(and(...idConditions))) as ProductionOrder[];
    return updated;
  }

  async markProductionOrderDone(id: number, completedAt: Date): Promise<ProductionOrder> {
    const sortOrder = await this.getNextProductionSortOrder("DONE");
    const conditions = [eq(productionOrders.id, id)];
    if (this.orgId) conditions.push(eq(productionOrders.orgId, this.orgId));
    const [updated] = (await this.database
      .update(productionOrders)
      .set({ status: "DONE", sortOrder, completedAt })
      .where(and(...conditions))
      .returning()) as ProductionOrder[];
    return updated;
  }

  async createSale(data: {
    paymentMethod: string;
    description?: string | null;
    totalAmount: string;
    salesChannel: "ONLINE" | "PHYSICAL";
    soldAt?: string | null;
  }): Promise<Sale> {
    const [created] = (await this.database
      .insert(sales)
      .values({
        orgId: this.orgIdValue(),
        paymentMethod: data.paymentMethod,
        description: data.description ?? null,
        totalAmount: data.totalAmount,
        salesChannel: data.salesChannel,
        soldAt: data.soldAt ? new Date(data.soldAt) : new Date(),
      } as any)
      .returning()) as Sale[];
    return created;
  }

  async createSaleItems(saleId: number, items: Array<{ productId: number; qty: number; unitPrice: string; totalPrice: string }>): Promise<SaleItem[]> {
    const rows = items.map((item) => ({
      orgId: this.orgIdValue(),
      saleId,
      productId: item.productId,
      qty: item.qty,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
    }));

    return (await this.database.insert(saleItems).values(rows as any).returning()) as SaleItem[];
  }

  async getSales(): Promise<SaleListItem[]> {
    const saleItemsWhere = this.orgId ? eq(saleItems.orgId, this.orgId) : undefined;
    const salesWhere = this.orgId ? eq(sales.orgId, this.orgId) : undefined;
    const productsWhere = this.orgId ? eq(products.orgId, this.orgId) : undefined;
    const allSaleItems = (await this.database.select().from(saleItems).where(saleItemsWhere).orderBy(desc(saleItems.createdAt))) as SaleItem[];
    const allSales = (await this.database.select().from(sales).where(salesWhere)) as Sale[];
    const allProducts = (await this.database.select().from(products).where(productsWhere)) as Product[];

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
    const saleConditions = [eq(sales.id, id)];
    if (this.orgId) saleConditions.push(eq(sales.orgId, this.orgId));
    const [sale] = (await this.database.select().from(sales).where(and(...saleConditions))) as Sale[];
    if (!sale) return undefined;

    const entryConditions = [eq(saleItems.saleId, id)];
    if (this.orgId) entryConditions.push(eq(saleItems.orgId, this.orgId));
    const entries = (await this.database.select().from(saleItems).where(and(...entryConditions))) as SaleItem[];

    const productsWhere = this.orgId ? eq(products.orgId, this.orgId) : undefined;
    const allProducts = (await this.database.select().from(products).where(productsWhere)) as Product[];

    const items = entries
      .map((item) => {
        const product = allProducts.find((entry) => entry.id === item.productId);
        if (!product) return undefined;
        return { ...item, product };
      })
      .filter((item): item is SaleItem & { product: Product } => item !== undefined);

    return { sale, items };
  }

  async deleteSaleItemsBySaleId(saleId: number): Promise<void> {
    const conditions = [eq(saleItems.saleId, saleId)];
    if (this.orgId) conditions.push(eq(saleItems.orgId, this.orgId));
    await this.database.delete(saleItems).where(and(...conditions));
  }

  async deleteSale(id: number): Promise<void> {
    const conditions = [eq(sales.id, id)];
    if (this.orgId) conditions.push(eq(sales.orgId, this.orgId));
    await this.database.delete(sales).where(and(...conditions));
  }

  async getInventoryMovements(): Promise<MovementWithDetails[]> {
    const movementsWhere = this.orgId ? eq(inventoryMovements.orgId, this.orgId) : undefined;
    const productsWhere = this.orgId ? eq(products.orgId, this.orgId) : undefined;
    const materialsWhere = this.orgId ? eq(materials.orgId, this.orgId) : undefined;
    const allMovements = (await this.database.select().from(inventoryMovements).where(movementsWhere).orderBy(desc(inventoryMovements.createdAt))) as MovementWithDetails[];
    const allProducts = (await this.database.select().from(products).where(productsWhere)) as Product[];
    const allMaterials = (await this.database.select().from(materials).where(materialsWhere)) as Material[];

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

    const [created] = (await this.database
      .insert(inventoryMovements)
      .values({ ...insertMovement, orgId: this.orgIdValue() } as any)
      .returning()) as InventoryMovement[];
    return created;
  }

  async getPurchaseOrders(): Promise<PurchaseOrderWithItems[]> {
    const conditions = [eq(purchaseOrders.isActive, 1)];
    if (this.orgId) conditions.push(eq(purchaseOrders.orgId, this.orgId));
    const orders = (await this.database
      .select()
      .from(purchaseOrders)
      .where(and(...conditions))
      .orderBy(asc(purchaseOrders.sortOrder), desc(purchaseOrders.id))) as PurchaseOrder[];

    if (orders.length === 0) return [];

    const orderIds = orders.map((order) => order.id);
    const items = (await this.database
      .select()
      .from(purchaseOrderItems)
      .where(
        and(
          inArray(purchaseOrderItems.purchaseOrderId, orderIds),
          ...(this.orgId ? [eq(purchaseOrderItems.orgId, this.orgId)] : []),
        ),
      )
      .orderBy(asc(purchaseOrderItems.sortOrder), asc(purchaseOrderItems.id))) as PurchaseOrderItem[];

    const itemsByOrderId = new Map<number, PurchaseOrderItem[]>();
    for (const item of items) {
      const current = itemsByOrderId.get(item.purchaseOrderId) ?? [];
      current.push(item);
      itemsByOrderId.set(item.purchaseOrderId, current);
    }

    return orders.map((order) => ({ ...order, items: itemsByOrderId.get(order.id) ?? [] }));
  }

  async reorderPurchaseOrders(input: ReorderPurchaseOrdersInput): Promise<void> {
    for (let index = 0; index < input.orderedIds.length; index += 1) {
      const orderId = input.orderedIds[index];
      const conditions = [eq(purchaseOrders.id, orderId)];
      if (this.orgId) conditions.push(eq(purchaseOrders.orgId, this.orgId));
      await this.database.update(purchaseOrders).set({ sortOrder: index }).where(and(...conditions));
    }
  }

  async getPurchaseOrder(id: number): Promise<PurchaseOrderWithItems | undefined> {
    const orderConditions = [eq(purchaseOrders.id, id)];
    if (this.orgId) orderConditions.push(eq(purchaseOrders.orgId, this.orgId));
    const [order] = (await this.database.select().from(purchaseOrders).where(and(...orderConditions))) as PurchaseOrder[];
    if (!order) return undefined;

    const items = (await this.database
      .select()
      .from(purchaseOrderItems)
      .where(
        and(
          eq(purchaseOrderItems.purchaseOrderId, id),
          ...(this.orgId ? [eq(purchaseOrderItems.orgId, this.orgId)] : []),
        ),
      )
      .orderBy(asc(purchaseOrderItems.sortOrder), asc(purchaseOrderItems.id))) as PurchaseOrderItem[];

    return { ...order, items };
  }

  async createPurchaseOrderBase(): Promise<PurchaseOrder> {
    const sortOrder = await this.getNextPurchaseOrderSortOrder();
    const [created] = (await this.database
      .insert(purchaseOrders)
      .values({ orgId: this.orgIdValue(), sortOrder } as any)
      .returning()) as PurchaseOrder[];
    return created;
  }

  async updatePurchaseOrderBase(
    id: number,
    input: Partial<Pick<PurchaseOrder, "status" | "isActive" | "receivedAt">>,
  ): Promise<PurchaseOrder> {
    const conditions = [eq(purchaseOrders.id, id)];
    if (this.orgId) conditions.push(eq(purchaseOrders.orgId, this.orgId));
    const [updated] = (await this.database
      .update(purchaseOrders)
      .set({ ...input, updatedAt: new Date() })
      .where(and(...conditions))
      .returning()) as PurchaseOrder[];
    return updated;
  }

  async createPurchaseOrderItems(
    purchaseOrderId: number,
    items: Array<Pick<PurchaseOrderItem, "materialId" | "materialName" | "qtyOrdered" | "qtyReceived" | "sortOrder">>,
  ): Promise<PurchaseOrderItem[]> {
    const payload = items.map((item) => ({
      orgId: this.orgIdValue(),
      purchaseOrderId,
      materialId: item.materialId ?? null,
      materialName: item.materialName,
      qtyOrdered: item.qtyOrdered,
      qtyReceived: item.qtyReceived,
      sortOrder: item.sortOrder,
    }));
    return (await this.database.insert(purchaseOrderItems).values(payload as any).returning()) as PurchaseOrderItem[];
  }

  async updatePurchaseOrderItem(
    id: number,
    input: Partial<Pick<PurchaseOrderItem, "materialId" | "materialName" | "qtyOrdered" | "qtyReceived" | "sortOrder">>,
  ): Promise<PurchaseOrderItem> {
    const conditions = [eq(purchaseOrderItems.id, id)];
    if (this.orgId) conditions.push(eq(purchaseOrderItems.orgId, this.orgId));
    const [updated] = (await this.database
      .update(purchaseOrderItems)
      .set({ ...input })
      .where(and(...conditions))
      .returning()) as PurchaseOrderItem[];
    return updated;
  }

  async deletePurchaseOrderItem(id: number): Promise<void> {
    const conditions = [eq(purchaseOrderItems.id, id)];
    if (this.orgId) conditions.push(eq(purchaseOrderItems.orgId, this.orgId));
    await this.database.delete(purchaseOrderItems).where(and(...conditions));
  }
}
