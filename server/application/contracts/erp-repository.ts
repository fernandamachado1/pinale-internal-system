import type {
  BomItem,
  BomItemInput,
  InsertInventoryMovement,
  InsertMaterial,
  InsertProduct,
  InsertProductionOrder,
  InventoryMovement,
  Material,
  MovementWithDetails,
  Product,
  ProductWithBom,
  ProductionOrder,
  ProductionOrderWithProduct,
  ProductionVariableConsumption,
  Sale,
  SaleItem,
  SaleListItem,
  UpdateMaterialRequest,
  UpdateProductInput,
  VariableConsumptionInput,
} from "@shared/schema";

export interface IErpRepository {
  getMaterials(): Promise<Material[]>;
  getMaterial(id: number): Promise<Material | undefined>;
  getMaterialByName(name: string): Promise<Material | undefined>;
  createMaterial(material: InsertMaterial): Promise<Material>;
  updateMaterial(id: number, updates: UpdateMaterialRequest): Promise<Material>;
  deactivateMaterial(id: number): Promise<void>;
  updateMaterialStockQty(id: number, stockQty: string | null): Promise<void>;

  getProducts(): Promise<ProductWithBom[]>;
  getProduct(id: number): Promise<ProductWithBom | undefined>;
  getProductByName(name: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProductBase(id: number, input: UpdateProductInput["product"]): Promise<Product>;
  deactivateProduct(id: number): Promise<void>;
  updateProductStockQty(id: number, stockQty: number): Promise<void>;

  getActiveBomByProductId(productId: number): Promise<{ id: number; items: BomItem[] } | undefined>;
  replaceActiveBom(productId: number, items: BomItemInput[]): Promise<{ id: number; items: BomItem[] }>;

  getProductionOrders(): Promise<ProductionOrderWithProduct[]>;
  getProductionOrder(id: number): Promise<ProductionOrderWithProduct | undefined>;
  createProductionOrder(data: InsertProductionOrder): Promise<ProductionOrder>;
  markProductionOrderDone(id: number, completedAt: Date): Promise<ProductionOrder>;
  createProductionVariableConsumptions(opId: number, consumptions: VariableConsumptionInput[]): Promise<ProductionVariableConsumption[]>;
  getProductionVariableConsumptions(opId: number): Promise<ProductionVariableConsumption[]>;

  createSale(data: { paymentMethod: string; totalAmount: string }): Promise<Sale>;
  createSaleItems(saleId: number, items: Array<{ productId: number; qty: number; unitPrice: string; totalPrice: string }>): Promise<SaleItem[]>;
  getSales(): Promise<SaleListItem[]>;
  getSaleWithItems(id: number): Promise<{ sale: Sale; items: Array<SaleItem & { product: Product }> } | undefined>;

  getInventoryMovements(): Promise<MovementWithDetails[]>;
  createInventoryMovement(movement: InsertInventoryMovement): Promise<InventoryMovement>;

  withTransaction<T>(callback: (repository: IErpRepository) => Promise<T>): Promise<T>;
}
