import type {
  BomItem,
  BomItemInput,
  CreateManyMaterialsInput,
  InsertMaterial,
  MoveProductionOrderInput,
  InsertProduct,
  InsertProductionOrder,
  Material,
  MovementWithDetails,
  Product,
  ProductWithBom,
  ProducedProductStock,
  ProducedProductStockWithProduct,
  ProductionOrder,
  ProductionOrderWithProduct,
  PurchaseOrderWithItems,
  PurchaseOrder,
  PurchaseOrderItem,
  UpdateMaterialRequest,
  UpdateProductInput,
} from "@shared/schema.ts";
import type { ISalesRepository } from "./sales-repository.ts";

export interface IErpRepository extends ISalesRepository {
  getMaterials(): Promise<Material[]>;
  getMaterial(id: number): Promise<Material | undefined>;
  getMaterialByName(name: string): Promise<Material | undefined>;
  createMaterial(material: InsertMaterial): Promise<Material>;
  createManyMaterials(input: CreateManyMaterialsInput): Promise<Material[]>;
  updateMaterial(id: number, updates: UpdateMaterialRequest): Promise<Material>;
  deactivateMaterial(id: number): Promise<void>;
  updateMaterialStockQty(id: number, stockQty: string): Promise<void>;

  getProducts(): Promise<ProductWithBom[]>;
  getProduct(id: number): Promise<ProductWithBom | undefined>;
  getProductByName(name: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProductBase(id: number, input: UpdateProductInput["product"]): Promise<Product>;
  deactivateProduct(id: number): Promise<void>;
  getProducedProductStocks(): Promise<ProducedProductStockWithProduct[]>;
  getProducedProductStockByProductId(productId: number): Promise<ProducedProductStockWithProduct | undefined>;
  createProducedProductStock(productId: number): Promise<ProducedProductStock>;
  updateProducedProductStockQty(productId: number, stockQty: number): Promise<void>;

  getActiveBomByProductId(productId: number): Promise<{ id: number; items: BomItem[] } | undefined>;
  replaceActiveBom(
    productId: number,
    technicalSpec: { bomItems: BomItemInput[] },
  ): Promise<{ id: number; items: BomItem[] }>;

  getProductionOrders(): Promise<ProductionOrderWithProduct[]>;
  getProductionOrder(id: number): Promise<ProductionOrderWithProduct | undefined>;
  createProductionOrder(data: InsertProductionOrder): Promise<ProductionOrder>;
  moveProductionOrder(id: number, input: MoveProductionOrderInput): Promise<ProductionOrder>;
  markProductionOrderDone(id: number, completedAt: Date): Promise<ProductionOrder>;

  getInventoryMovements(): Promise<MovementWithDetails[]>;

  getPurchaseOrders(): Promise<PurchaseOrderWithItems[]>;
  getPurchaseOrder(id: number): Promise<PurchaseOrderWithItems | undefined>;
  createPurchaseOrderBase(): Promise<PurchaseOrder>;
  updatePurchaseOrderBase(
    id: number,
    input: Partial<Pick<PurchaseOrder, "status" | "isActive" | "receivedAt">>,
  ): Promise<PurchaseOrder>;
  createPurchaseOrderItems(
    purchaseOrderId: number,
    items: Array<Pick<PurchaseOrderItem, "materialId" | "materialName" | "qtyOrdered" | "qtyReceived">>,
  ): Promise<PurchaseOrderItem[]>;
  updatePurchaseOrderItem(
    id: number,
    input: Partial<Pick<PurchaseOrderItem, "materialId" | "materialName" | "qtyOrdered" | "qtyReceived">>,
  ): Promise<PurchaseOrderItem>;
  deletePurchaseOrderItem(id: number): Promise<void>;

  withTransaction<T>(callback: (repository: IErpRepository) => Promise<T>): Promise<T>;
}
