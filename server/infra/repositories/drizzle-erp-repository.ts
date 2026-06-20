import { and, asc, desc, eq, gte, ilike, inArray, lte, sql, type SQL } from "drizzle-orm";
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
  type UpdateProductionOrderInput,
  type UpdateProductionOrderFinancialsInput,
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
import type { DashboardReport } from "@shared/routes";
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

  private applyDateRange(conditions: any[], column: any, from?: Date, to?: Date): void {
    if (from) conditions.push(gte(column, from));
    if (to) conditions.push(lte(column, to));
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

    const [allProducts, activeBoms, allBomItems] = await Promise.all([
      this.database.select().from(products).where(productsWhere).orderBy(products.name),
      this.database.select().from(boms).where(bomsWhere),
      this.database.select().from(bomItems).where(bomItemsWhere),
    ]) as [Product[], Array<typeof boms.$inferSelect>, BomItem[]];
    const activeBomByProductId = new Map(activeBoms.map((bom) => [bom.productId, bom.id]));
    const bomItemsByBomId = new Map<number, BomItem[]>();
    for (const item of allBomItems) {
      const current = bomItemsByBomId.get(item.bomId) ?? [];
      current.push(item);
      bomItemsByBomId.set(item.bomId, current);
    }

    return allProducts.map((product) => {
      const activeBomId = activeBomByProductId.get(product.id);
      return {
        ...product,
        bomItems: activeBomId ? bomItemsByBomId.get(activeBomId) ?? [] : [],
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

    const [totalResult, pageProducts] = await Promise.all([
      this.database.select({ count: sql<number>`count(*)` }).from(products).where(productsWhere),
      this.database
        .select()
        .from(products)
        .where(productsWhere)
        .orderBy(products.name)
        .limit(input.pageSize)
        .offset(offset),
    ]) as [Array<{ count: number }>, Product[]];
    const [totalRow] = totalResult;
    const total = Number(totalRow?.count ?? 0);

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
    const [productResult, activeBomResult] = await Promise.all([
      this.database.select().from(products).where(and(...productConditions)),
      this.database
        .select()
        .from(boms)
        .where(and(eq(boms.productId, id), eq(boms.isActive, 1), ...(this.orgId ? [eq(boms.orgId, this.orgId)] : []))),
    ]) as [Product[], Array<typeof boms.$inferSelect>];
    const [product] = productResult;
    if (!product) return undefined;
    const [activeBom] = activeBomResult;

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
    const [allStocks, allProducts] = await Promise.all([
      this.database.select().from(producedProductStocks).where(stocksWhere).orderBy(producedProductStocks.productId),
      this.database.select().from(products).where(productsWhere).orderBy(products.name),
    ]) as [ProducedProductStock[], Product[]];
    const productsById = new Map(allProducts.map((product) => [product.id, product]));

    return allStocks
      .map((stock) => {
        const product = productsById.get(stock.productId);
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

    const [allProducts, allStocks, movementTotals] = await Promise.all([
      this.database.select({ id: products.id }).from(products).where(productsWhere),
      this.database
        .select({ productId: producedProductStocks.productId, stockQty: producedProductStocks.stockQty })
        .from(producedProductStocks)
        .where(stocksWhere),
      this.database
        .select({
          productId: inventoryMovements.entityId,
          direction: inventoryMovements.direction,
          qty: sql<number>`coalesce(sum((${inventoryMovements.qty})::numeric), 0)`,
        })
        .from(inventoryMovements)
        .where(movementsWhere)
        .groupBy(inventoryMovements.entityId, inventoryMovements.direction),
    ]) as [
      Array<{ id: number }>,
      Array<{ productId: number; stockQty: number }>,
      Array<{
        productId: number | null;
        direction: "IN" | "OUT";
        qty: number;
      }>,
    ];

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

  async getProductionOrders(filters?: {
    status?: Array<ProductionOrder["status"]>;
    from?: Date;
    to?: Date;
  }): Promise<ProductionOrderWithProduct[]> {
    const ordersWhere = this.orgId ? eq(productionOrders.orgId, this.orgId) : undefined;
    const productsWhere = this.orgId ? eq(products.orgId, this.orgId) : undefined;
    const orderConditions = [ordersWhere].filter(Boolean) as Array<any>;
    if (filters?.status?.length) {
      orderConditions.push(inArray(productionOrders.status, filters.status));
    }
    this.applyDateRange(orderConditions, productionOrders.createdAt, filters?.from, filters?.to);
    const [allOrders, allProducts] = await Promise.all([
      this.database
        .select()
        .from(productionOrders)
        .where(orderConditions.length > 0 ? and(...orderConditions) : undefined)
        .orderBy(asc(productionOrders.sortOrder), desc(productionOrders.createdAt), desc(productionOrders.id)),
      this.database.select().from(products).where(productsWhere),
    ]) as [ProductionOrder[], Product[]];
    const productsById = new Map(allProducts.map((product) => [product.id, product]));
    const statusOrder = new Map([
      ["BACKLOG", 0],
      ["IN_PROGRESS", 1],
      ["DONE", 2],
    ]);

    return allOrders
      .map((order) => {
        const product = productsById.get(order.productId);
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

  async getProductionOrdersByIds(ids: number[]): Promise<ProductionOrderWithProduct[]> {
    if (ids.length === 0) return [];
    const uniqueIds = Array.from(new Set(ids));
    const orderConditions = [inArray(productionOrders.id, uniqueIds)];
    if (this.orgId) orderConditions.push(eq(productionOrders.orgId, this.orgId));
    const orders = (await this.database.select().from(productionOrders).where(and(...orderConditions))) as ProductionOrder[];
    if (orders.length === 0) return [];
    const productIds = Array.from(new Set(orders.map((order) => order.productId)));
    const productConditions = [inArray(products.id, productIds)];
    if (this.orgId) productConditions.push(eq(products.orgId, this.orgId));
    const allProducts = (await this.database.select().from(products).where(and(...productConditions))) as Product[];
    const productsById = new Map(allProducts.map((product) => [product.id, product]));
    return orders
      .map((order) => {
        const product = productsById.get(order.productId);
        if (!product) return undefined;
        return { ...order, product };
      })
      .filter((item): item is ProductionOrderWithProduct => item !== undefined);
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
        orderType: data.orderType ?? "NORMAL",
        qtyPlanned: data.qtyPlanned,
        customizationNotes: data.customizationNotes?.trim() || null,
        amountPaid: data.amountPaid ?? 0,
        deliveredAt: null,
        status: "BACKLOG",
        salesChannel: data.salesChannel,
        dueAt: data.dueAt ? new Date(data.dueAt) : null,
        sortOrder,
      } as any)
      .returning()) as ProductionOrder[];
    return created;
  }

  async updateProductionOrder(id: number, input: UpdateProductionOrderInput): Promise<ProductionOrder> {
    const conditions = [eq(productionOrders.id, id)];
    if (this.orgId) conditions.push(eq(productionOrders.orgId, this.orgId));
    const nextBomId =
      input.productId !== undefined
        ? (await this.getActiveBomByProductId(input.productId))?.id ?? null
        : undefined;
    const [updated] = (await this.database
      .update(productionOrders)
      .set({
        ...(input.productId !== undefined ? { productId: input.productId } : {}),
        ...(input.qtyPlanned !== undefined ? { qtyPlanned: input.qtyPlanned } : {}),
        ...(input.orderType !== undefined ? { orderType: input.orderType } : {}),
        ...(input.customizationNotes !== undefined ? { customizationNotes: input.customizationNotes?.trim() || null } : {}),
        ...(input.amountPaid !== undefined ? { amountPaid: input.amountPaid } : {}),
        ...(input.dueAt !== undefined ? { dueAt: input.dueAt ? new Date(input.dueAt) : null } : {}),
        ...(nextBomId !== undefined ? { bomId: nextBomId } : {}),
      } as any)
      .where(and(...conditions))
      .returning()) as ProductionOrder[];
    return updated;
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

  async updateProductionOrderFinancials(id: number, input: UpdateProductionOrderFinancialsInput): Promise<ProductionOrder> {
    const conditions = [eq(productionOrders.id, id)];
    if (this.orgId) conditions.push(eq(productionOrders.orgId, this.orgId));
    const [updated] = (await this.database
      .update(productionOrders)
      .set({
        ...(input.amountPaid !== undefined ? { amountPaid: input.amountPaid } : {}),
      } as any)
      .where(and(...conditions))
      .returning()) as ProductionOrder[];
    return updated;
  }

  async markProductionOrderDelivered(id: number, deliveredAt: Date): Promise<ProductionOrder> {
    const conditions = [eq(productionOrders.id, id)];
    if (this.orgId) conditions.push(eq(productionOrders.orgId, this.orgId));
    const [updated] = (await this.database
      .update(productionOrders)
      .set({ deliveredAt })
      .where(and(...conditions))
      .returning()) as ProductionOrder[];
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

  async deleteProductionOrder(id: number): Promise<void> {
    const conditions = [eq(productionOrders.id, id)];
    if (this.orgId) conditions.push(eq(productionOrders.orgId, this.orgId));
    await this.database.delete(productionOrders).where(and(...conditions));
  }

  async createSale(data: {
    paymentMethod: string;
    installments?: number | null;
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
        installments: data.installments ?? null,
        description: data.description ?? null,
        totalAmount: data.totalAmount,
        salesChannel: data.salesChannel,
        soldAt: data.soldAt ? new Date(data.soldAt) : new Date(),
      } as any)
      .returning()) as Sale[];
    return created;
  }

  async updateSale(
    id: number,
    data: {
      paymentMethod: string;
      installments?: number | null;
      description?: string | null;
      totalAmount: string;
      salesChannel: "ONLINE" | "PHYSICAL";
      soldAt?: string | null;
    },
  ): Promise<void> {
    const conditions = [eq(sales.id, id)];
    if (this.orgId) conditions.push(eq(sales.orgId, this.orgId));
    await this.database
      .update(sales)
      .set({
        paymentMethod: data.paymentMethod,
        installments: data.installments ?? null,
        description: data.description ?? null,
        totalAmount: data.totalAmount,
        salesChannel: data.salesChannel,
        soldAt: data.soldAt ? new Date(data.soldAt) : new Date(),
      } as any)
      .where(and(...conditions));
  }

  async createSaleItems(
    saleId: number,
    items: Array<{ productId: number; qty: number; discountType: "PERCENT" | "AMOUNT"; discountValue: string; unitPrice: string; totalPrice: string }>,
  ): Promise<SaleItem[]> {
    const rows = items.map((item) => ({
      orgId: this.orgIdValue(),
      saleId,
      productId: item.productId,
      qty: item.qty,
      discountType: item.discountType,
      discountValue: item.discountValue,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
    }));

    return (await this.database.insert(saleItems).values(rows as any).returning()) as SaleItem[];
  }

  async getSales(filters?: { from?: Date; to?: Date }): Promise<SaleListItem[]> {
    const saleItemsWhere = this.orgId ? eq(saleItems.orgId, this.orgId) : undefined;
    const salesConditions = [this.orgId ? eq(sales.orgId, this.orgId) : undefined].filter(Boolean) as Array<any>;
    this.applyDateRange(salesConditions, sales.soldAt, filters?.from, filters?.to);
    const productsWhere = this.orgId ? eq(products.orgId, this.orgId) : undefined;

    const filteredSales = (await this.database
      .select()
      .from(sales)
      .where(salesConditions.length > 0 ? and(...salesConditions) : undefined)) as Sale[];
    if (filteredSales.length === 0) return [];
    const saleIds = filteredSales.map((sale) => sale.id);
    const salesById = new Map(filteredSales.map((sale) => [sale.id, sale]));

    const saleItemsConditions = [saleItemsWhere, inArray(saleItems.saleId, saleIds)].filter(Boolean) as Array<any>;
    const allSaleItems = (await this.database.select().from(saleItems).where(and(...saleItemsConditions)).orderBy(desc(saleItems.createdAt))) as SaleItem[];
    if (allSaleItems.length === 0) return [];

    const productIds = Array.from(new Set(allSaleItems.map((item) => item.productId)));
    const allProducts = (await this.database
      .select()
      .from(products)
      .where(and(...([productsWhere, inArray(products.id, productIds)].filter(Boolean) as Array<any>)))) as Product[];

    const productsById = new Map(allProducts.map((product) => [product.id, product]));

    return allSaleItems
      .map((item) => {
        const sale = salesById.get(item.saleId);
        const product = productsById.get(item.productId);
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
    if (entries.length === 0) return { sale, items: [] };

    const productIds = Array.from(new Set(entries.map((item) => item.productId)));
    const productConditions = [inArray(products.id, productIds)];
    if (this.orgId) productConditions.push(eq(products.orgId, this.orgId));
    const allProducts = (await this.database.select().from(products).where(and(...productConditions))) as Product[];
    const productsById = new Map(allProducts.map((product) => [product.id, product]));

    const items = entries
      .map((item) => {
        const product = productsById.get(item.productId);
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

  async getInventoryMovements(filters?: {
    from?: Date;
    to?: Date;
    entityType?: "PRODUCT" | "MATERIAL";
    direction?: "IN" | "OUT";
    reason?: Array<"PRODUCTION_CONSUMPTION" | "PRODUCTION_OUTPUT" | "SALE" | "PURCHASE" | "ADJUSTMENT">;
    referenceType?: Array<"OP" | "SALE" | "MANUAL">;
  }): Promise<MovementWithDetails[]> {
    const movementConditions = [this.orgId ? eq(inventoryMovements.orgId, this.orgId) : undefined].filter(Boolean) as Array<any>;
    if (filters?.entityType) movementConditions.push(eq(inventoryMovements.entityType, filters.entityType));
    if (filters?.direction) movementConditions.push(eq(inventoryMovements.direction, filters.direction));
    if (filters?.reason?.length) movementConditions.push(inArray(inventoryMovements.reason, filters.reason));
    if (filters?.referenceType?.length) movementConditions.push(inArray(inventoryMovements.referenceType, filters.referenceType));
    this.applyDateRange(movementConditions, inventoryMovements.createdAt, filters?.from, filters?.to);

    const allMovements = (await this.database
      .select()
      .from(inventoryMovements)
      .where(movementConditions.length > 0 ? and(...movementConditions) : undefined)
      .orderBy(desc(inventoryMovements.createdAt))) as MovementWithDetails[];

    const productIds = Array.from(new Set(allMovements.filter((movement) => movement.entityType === "PRODUCT" && movement.entityId).map((movement) => movement.entityId as number)));
    const materialIds = Array.from(new Set(allMovements.filter((movement) => movement.entityType === "MATERIAL" && movement.entityId).map((movement) => movement.entityId as number)));

    const productConditions = productIds.length > 0 ? [inArray(products.id, productIds)] : [];
    if (productIds.length > 0 && this.orgId) productConditions.push(eq(products.orgId, this.orgId));
    const materialConditions = materialIds.length > 0 ? [inArray(materials.id, materialIds)] : [];
    if (materialIds.length > 0 && this.orgId) materialConditions.push(eq(materials.orgId, this.orgId));

    const allProducts =
      productConditions.length > 0 ? ((await this.database.select().from(products).where(and(...productConditions))) as Product[]) : [];
    const allMaterials =
      materialConditions.length > 0 ? ((await this.database.select().from(materials).where(and(...materialConditions))) as Material[]) : [];
    const productsById = new Map(allProducts.map((entry) => [entry.id, entry]));
    const materialsById = new Map(allMaterials.map((entry) => [entry.id, entry]));

    return allMovements.map((movement) => ({
      ...movement,
      product: movement.entityType === "PRODUCT" && movement.entityId ? productsById.get(movement.entityId) ?? null : null,
      material: movement.entityType === "MATERIAL" && movement.entityId ? materialsById.get(movement.entityId) ?? null : null,
    }));
  }

  async getDashboardReport(period: { from?: Date; to?: Date }): Promise<DashboardReport> {
    const combineWhere = (...conditions: Array<any | undefined>) => {
      const filtered = conditions.filter(Boolean) as Array<any>;
      return filtered.length > 0 ? and(...filtered) : undefined;
    };

    const openOrderWhere = combineWhere(
      this.orgId ? eq(productionOrders.orgId, this.orgId) : undefined,
      inArray(productionOrders.status, ["BACKLOG", "IN_PROGRESS"]),
    );

    const salesConditions = [this.orgId ? eq(sales.orgId, this.orgId) : undefined].filter(Boolean) as Array<any>;
    this.applyDateRange(salesConditions, sales.soldAt, period.from, period.to);
    const saleItemConditions = [this.orgId ? eq(saleItems.orgId, this.orgId) : undefined].filter(Boolean) as Array<any>;

    const movementConditions = [
      this.orgId ? eq(inventoryMovements.orgId, this.orgId) : undefined,
      eq(inventoryMovements.entityType, "PRODUCT"),
      eq(inventoryMovements.direction, "IN"),
      inArray(inventoryMovements.reason, ["PRODUCTION_OUTPUT", "ADJUSTMENT"]),
      sql`${inventoryMovements.entityId} is not null`,
    ].filter(Boolean) as Array<any>;
    this.applyDateRange(movementConditions, inventoryMovements.createdAt, period.from, period.to);

    const stockConditions = [this.orgId ? eq(producedProductStocks.orgId, this.orgId) : undefined].filter(Boolean) as Array<any>;
    const stockWhere = combineWhere(...stockConditions);

    const [openOrdersCountRow] = (await this.database
      .select({ count: sql<number>`coalesce(count(*), 0)` })
      .from(productionOrders)
      .where(openOrderWhere)) as Array<{ count: number }>;

    const openOrders = (await this.database
      .select({
        id: productionOrders.id,
        productName: products.name,
        qtyPlanned: productionOrders.qtyPlanned,
        createdAt: productionOrders.createdAt,
      })
      .from(productionOrders)
      .innerJoin(products, eq(productionOrders.productId, products.id))
      .where(openOrderWhere)
      .orderBy(desc(productionOrders.createdAt), desc(productionOrders.id))
      .limit(5)) as Array<{
      id: number;
      productName: string;
      qtyPlanned: number;
      createdAt: Date;
    }>;

    const [salesSummary] = (await this.database
      .select({
        totalRevenue: sql<number>`coalesce(sum(${saleItems.totalPrice}), 0)`,
        distinctSaleCount: sql<number>`count(distinct ${saleItems.saleId})`,
      })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .where(combineWhere(...saleItemConditions, ...salesConditions))) as Array<{
      totalRevenue: number;
      distinctSaleCount: number;
    }>;

    const topSold = (await this.database
      .select({
        productId: products.id,
        productName: products.name,
        qty: sql<number>`coalesce(sum(${saleItems.qty}), 0)`,
        revenue: sql<number>`coalesce(sum(${saleItems.totalPrice}), 0)`,
      })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .innerJoin(products, eq(saleItems.productId, products.id))
      .where(combineWhere(...saleItemConditions, ...salesConditions))
      .groupBy(products.id, products.name)
      .orderBy(desc(sql<number>`coalesce(sum(${saleItems.totalPrice}), 0)`))
      .limit(5)) as Array<{
      productId: number;
      productName: string;
      qty: number;
      revenue: number;
    }>;

    const soldChartRows = (await this.database
      .select({
        date: sql<string>`to_char(date_trunc('day', ${sales.soldAt}), 'YYYY-MM-DD')`,
        soldValue: sql<number>`coalesce(sum(${saleItems.totalPrice}), 0)`,
      })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .where(combineWhere(...saleItemConditions, ...salesConditions))
      .groupBy(sql`date_trunc('day', ${sales.soldAt})`)
      .orderBy(sql`date_trunc('day', ${sales.soldAt})`)) as Array<{
      date: string;
      soldValue: number;
    }>;

    const [producedSummary] = (await this.database
      .select({
        producedValue: sql<number>`coalesce(sum(((${inventoryMovements.qty})::numeric * (${products.price})::numeric)), 0)`,
      })
      .from(inventoryMovements)
      .innerJoin(products, eq(inventoryMovements.entityId, products.id))
      .where(combineWhere(...movementConditions))) as Array<{
      producedValue: number;
    }>;

    const topProduced = (await this.database
      .select({
        productId: products.id,
        productName: products.name,
        qty: sql<number>`coalesce(sum(${inventoryMovements.qty}), 0)`,
        value: sql<number>`coalesce(sum(((${inventoryMovements.qty})::numeric * (${products.price})::numeric)), 0)`,
      })
      .from(inventoryMovements)
      .innerJoin(products, eq(inventoryMovements.entityId, products.id))
      .where(combineWhere(...movementConditions))
      .groupBy(products.id, products.name)
      .orderBy(desc(sql<number>`coalesce(sum(((${inventoryMovements.qty})::numeric * (${products.price})::numeric)), 0)`))
      .limit(5)) as Array<{
      productId: number;
      productName: string;
      qty: number;
      value: number;
    }>;

    const producedChartRows = (await this.database
      .select({
        date: sql<string>`to_char(date_trunc('day', ${inventoryMovements.createdAt}), 'YYYY-MM-DD')`,
        producedValue: sql<number>`coalesce(sum(((${inventoryMovements.qty})::numeric * (${products.price})::numeric)), 0)`,
      })
      .from(inventoryMovements)
      .innerJoin(products, eq(inventoryMovements.entityId, products.id))
      .where(combineWhere(...movementConditions))
      .groupBy(sql`date_trunc('day', ${inventoryMovements.createdAt})`)
      .orderBy(sql`date_trunc('day', ${inventoryMovements.createdAt})`)) as Array<{
      date: string;
      producedValue: number;
    }>;

    const productStock = (await this.database
      .select({
        productId: producedProductStocks.productId,
        productName: products.name,
        stockQty: producedProductStocks.stockQty,
      })
      .from(producedProductStocks)
      .innerJoin(products, eq(producedProductStocks.productId, products.id))
      .where(stockWhere)
      .orderBy(desc(producedProductStocks.stockQty), asc(products.name))
      .limit(8)) as Array<{
      productId: number;
      productName: string;
      stockQty: number;
    }>;

    const chartMap = new Map<string, { date: string; producedValue: number; soldValue: number }>();
    for (const row of producedChartRows) {
      const current = chartMap.get(row.date) ?? { date: row.date, producedValue: 0, soldValue: 0 };
      current.producedValue += Number(row.producedValue);
      chartMap.set(row.date, current);
    }
    for (const row of soldChartRows) {
      const current = chartMap.get(row.date) ?? { date: row.date, producedValue: 0, soldValue: 0 };
      current.soldValue += Number(row.soldValue);
      chartMap.set(row.date, current);
    }

    return {
      producedValue: Number(producedSummary?.producedValue ?? 0),
      soldValue: Number(salesSummary?.totalRevenue ?? 0),
      distinctSaleCount: Number(salesSummary?.distinctSaleCount ?? 0),
      openOrdersCount: Number(openOrdersCountRow?.count ?? 0),
      topProduced,
      topSold,
      chartSeries: Array.from(chartMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
      openOrders: openOrders.map((order) => ({
        id: order.id,
        productName: order.productName,
        qtyPlanned: order.qtyPlanned,
        createdAt: order.createdAt.toISOString(),
      })),
      productStock,
    };
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

  async getPurchaseOrders(includeArchived = false): Promise<PurchaseOrderWithItems[]> {
    const conditions = includeArchived ? [] : [eq(purchaseOrders.isActive, 1)];
    if (this.orgId) conditions.push(eq(purchaseOrders.orgId, this.orgId));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const orders = (await this.database
      .select()
      .from(purchaseOrders)
      .where(whereClause)
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

  async splitOpenPurchaseOrdersIntoSingleItemOrders(): Promise<void> {
    const orderConditions = [eq(purchaseOrders.isActive, 1)];
    if (this.orgId) orderConditions.push(eq(purchaseOrders.orgId, this.orgId));

    const allOrders = (await this.database
      .select()
      .from(purchaseOrders)
      .where(and(...orderConditions))
      .orderBy(asc(purchaseOrders.sortOrder), desc(purchaseOrders.id))) as PurchaseOrder[];

    const openOrders = allOrders.filter((order) => order.status === "OPEN");
    if (openOrders.length === 0) return;

    const openOrderIds = openOrders.map((order) => order.id);
    const items = (await this.database
      .select()
      .from(purchaseOrderItems)
      .where(
        and(
          inArray(purchaseOrderItems.purchaseOrderId, openOrderIds),
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

    const createdByOriginalOrderId = new Map<number, number[]>();

    for (const order of openOrders) {
      const orderItems = itemsByOrderId.get(order.id) ?? [];
      if (orderItems.length <= 1) continue;

      const [first, ...rest] = orderItems;
      if (!first) continue;

      // Keep the first item in the original order.
      await this.database
        .update(purchaseOrderItems)
        .set({ sortOrder: 0 })
        .where(
          and(
            eq(purchaseOrderItems.id, first.id),
            ...(this.orgId ? [eq(purchaseOrderItems.orgId, this.orgId)] : []),
          ),
        );

      const createdIds: number[] = [];
      for (const item of rest) {
        const [created] = (await this.database
          .insert(purchaseOrders)
          .values({
            orgId: this.orgIdValue(),
            status: "OPEN",
            isActive: 1,
            sortOrder: 0,
            receivedAt: null,
            createdAt: order.createdAt,
            updatedAt: new Date(),
          } as any)
          .returning()) as PurchaseOrder[];

        const newOrderId = created?.id;
        if (!newOrderId) continue;

        await this.database
          .update(purchaseOrderItems)
          .set({ purchaseOrderId: newOrderId, sortOrder: 0 })
          .where(
            and(
              eq(purchaseOrderItems.id, item.id),
              ...(this.orgId ? [eq(purchaseOrderItems.orgId, this.orgId)] : []),
            ),
          );

        createdIds.push(newOrderId);
      }

      if (createdIds.length > 0) createdByOriginalOrderId.set(order.id, createdIds);
    }

    if (createdByOriginalOrderId.size === 0) return;

    const finalOrderIds: number[] = [];
    for (const order of allOrders) {
      finalOrderIds.push(order.id);
      const createdIds = createdByOriginalOrderId.get(order.id);
      if (createdIds?.length) finalOrderIds.push(...createdIds);
    }

    for (let index = 0; index < finalOrderIds.length; index += 1) {
      const orderId = finalOrderIds[index];
      const conditions = [eq(purchaseOrders.id, orderId)];
      if (this.orgId) conditions.push(eq(purchaseOrders.orgId, this.orgId));
      await this.database.update(purchaseOrders).set({ sortOrder: index }).where(and(...conditions));
    }
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
    items: Array<Pick<PurchaseOrderItem, "materialId" | "materialName" | "description" | "qtyOrdered" | "qtyReceived" | "sortOrder">>,
  ): Promise<PurchaseOrderItem[]> {
    const payload = items.map((item) => ({
      orgId: this.orgIdValue(),
      purchaseOrderId,
      materialId: item.materialId ?? null,
      materialName: item.materialName,
      description: item.description?.trim() ? item.description.trim() : null,
      qtyOrdered: item.qtyOrdered,
      qtyReceived: item.qtyReceived,
      sortOrder: item.sortOrder,
    }));
    return (await this.database.insert(purchaseOrderItems).values(payload as any).returning()) as PurchaseOrderItem[];
  }

  async updatePurchaseOrderItem(
    id: number,
    input: Partial<Pick<PurchaseOrderItem, "materialId" | "materialName" | "description" | "qtyOrdered" | "qtyReceived" | "sortOrder">>,
  ): Promise<PurchaseOrderItem> {
    const conditions = [eq(purchaseOrderItems.id, id)];
    if (this.orgId) conditions.push(eq(purchaseOrderItems.orgId, this.orgId));
    const [updated] = (await this.database
      .update(purchaseOrderItems)
      .set({
        ...input,
        ...(Object.prototype.hasOwnProperty.call(input, "description")
          ? { description: input.description?.trim() ? input.description.trim() : null }
          : {}),
      })
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
