import type {
  AdjustProducedStockInput,
  CatalogProduct,
  CreateManyMaterialsInput,
  ConcludeProductionOrderInput,
  InsertMaterial,
  MoveProductionOrderInput,
  InsertProductionOrder,
  InsertSale,
  Material,
  MovementWithDetails,
  ProductWithBom,
  ProducedProductStockSummary,
  ProducedProductStockWithProduct,
  ProductionOrderWithProduct,
  PurchaseOrderWithItems,
  CreatePurchaseOrderInput,
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
  createProductionOrder(data: InsertProductionOrder): Promise<ProductionOrderWithProduct>;
  moveProductionOrder(id: number, data: MoveProductionOrderInput): Promise<ProductionOrderWithProduct>;
  concludeProductionOrder(id: number, data: ConcludeProductionOrderInput): Promise<ProductionOrderWithProduct>;

  getSales(): Promise<SaleListItem[]>;
  createSale(data: InsertSale): Promise<{ sale: unknown; items: unknown[] }>;
  deleteSale(id: number): Promise<void>;

  getInventoryMovements(): Promise<MovementWithDetails[]>;

  getPurchaseOrders(): Promise<PurchaseOrderWithItems[]>;
  createPurchaseOrder(data: CreatePurchaseOrderInput): Promise<PurchaseOrderWithItems>;
  updatePurchaseOrder(id: number, data: UpdatePurchaseOrderInput): Promise<PurchaseOrderWithItems>;
  receivePurchaseOrder(id: number, data: ReceivePurchaseOrderInput): Promise<PurchaseOrderWithItems>;
  cancelPurchaseOrder(id: number): Promise<void>;

  getDashboardReport(from?: Date, to?: Date): Promise<DashboardReport>;
}
