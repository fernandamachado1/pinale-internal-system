import type {
  AdjustProducedStockInput,
  CatalogProduct,
  CreateManyMaterialsInput,
  ConcludeProductionOrderInput,
  InsertMaterial,
  MoveProductionOrderInput,
  InsertProductionOrder,
  UpdateProductionOrderInput,
  UpdateProductionOrderFinancialsInput,
  InsertSale,
  Material,
  MovementWithDetails,
  ProductWithBom,
  ProducedProductStockSummary,
  ProducedProductStockWithProduct,
  ProductionOrderWithProduct,
  PurchaseOrderWithItems,
  CreatePurchaseOrderInput,
  ReorderPurchaseOrdersInput,
  UpdatePurchaseOrderInput,
  ReceivePurchaseOrderInput,
  RegisterInitialProducedStockInput,
  SaleListItem,
} from "@shared/schema";
import type { DashboardReport } from "@shared/routes";

export interface IErpGateway {
  getMaterials(): Promise<Material[]>;
  createMaterial(data: InsertMaterial): Promise<Material>;
  createManyMaterials(data: CreateManyMaterialsInput): Promise<Material[]>;
  updateMaterial(id: number, data: Partial<InsertMaterial>): Promise<Material>;
  deleteMaterial(id: number): Promise<void>;

  getProducedProductStocks(): Promise<ProducedProductStockWithProduct[]>;
  getProducedProductStockSummary(): Promise<ProducedProductStockSummary[]>;
  registerInitialProducedStock(data: RegisterInitialProducedStockInput): Promise<ProducedProductStockWithProduct>;
  adjustProducedStock(data: AdjustProducedStockInput): Promise<ProducedProductStockWithProduct>;

  getProducts(): Promise<ProductWithBom[]>;
  getCatalogProducts(input: { q?: string; page: number; pageSize: number }): Promise<{ items: CatalogProduct[]; total: number }>;
  createProduct(data: unknown): Promise<ProductWithBom>;
  updateProduct(id: number, data: unknown): Promise<ProductWithBom>;
  deleteProduct(id: number): Promise<void>;

  getProductionOrders(): Promise<ProductionOrderWithProduct[]>;
  updateProductionOrder(id: number, data: UpdateProductionOrderInput): Promise<ProductionOrderWithProduct>;
  createProductionOrder(data: InsertProductionOrder): Promise<ProductionOrderWithProduct>;
  moveProductionOrder(id: number, data: MoveProductionOrderInput): Promise<ProductionOrderWithProduct>;
  updateProductionOrderFinancials(id: number, data: UpdateProductionOrderFinancialsInput): Promise<ProductionOrderWithProduct>;
  concludeProductionOrder(id: number, data: ConcludeProductionOrderInput): Promise<ProductionOrderWithProduct>;
  deliverProductionOrder(id: number, data: { deliveredAt?: string | null }): Promise<ProductionOrderWithProduct>;
  deleteProductionOrder(id: number): Promise<void>;

  getSales(): Promise<SaleListItem[]>;
  getSale(id: number): Promise<{ sale: unknown; items: unknown[] }>;
  createSale(data: InsertSale): Promise<{ sale: unknown; items: unknown[] }>;
  updateSale(id: number, data: InsertSale): Promise<{ sale: unknown; items: unknown[] }>;
  deleteSale(id: number): Promise<void>;

  getInventoryMovements(): Promise<MovementWithDetails[]>;

  getPurchaseOrders(input?: { includeArchived?: boolean }): Promise<PurchaseOrderWithItems[]>;
  reorderPurchaseOrders(data: ReorderPurchaseOrdersInput): Promise<void>;
  createPurchaseOrder(data: CreatePurchaseOrderInput): Promise<PurchaseOrderWithItems>;
  updatePurchaseOrder(id: number, data: UpdatePurchaseOrderInput): Promise<PurchaseOrderWithItems>;
  receivePurchaseOrder(id: number, data: ReceivePurchaseOrderInput): Promise<PurchaseOrderWithItems>;
  cancelPurchaseOrder(id: number): Promise<void>;

  getDashboardReport(from?: Date, to?: Date): Promise<DashboardReport>;
}
