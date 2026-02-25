import type {
  ConcludeProductionOrderInput,
  InsertMaterial,
  InsertProductionOrder,
  InsertSale,
  Material,
  MovementWithDetails,
  ProductWithBom,
  ProductionOrderWithProduct,
  SaleListItem,
} from "@shared/schema";

export interface IErpGateway {
  getMaterials(): Promise<Material[]>;
  createMaterial(data: InsertMaterial): Promise<Material>;
  updateMaterial(id: number, data: Partial<InsertMaterial>): Promise<Material>;
  deleteMaterial(id: number): Promise<void>;

  getProducts(): Promise<ProductWithBom[]>;
  createProduct(data: unknown): Promise<ProductWithBom>;
  updateProduct(id: number, data: unknown): Promise<ProductWithBom>;
  deleteProduct(id: number): Promise<void>;

  getProductionOrders(): Promise<ProductionOrderWithProduct[]>;
  createProductionOrder(data: InsertProductionOrder): Promise<ProductionOrderWithProduct>;
  concludeProductionOrder(id: number, data: ConcludeProductionOrderInput): Promise<ProductionOrderWithProduct>;

  getSales(): Promise<SaleListItem[]>;
  createSale(data: InsertSale): Promise<{ sale: unknown; items: unknown[] }>;

  getInventoryMovements(): Promise<MovementWithDetails[]>;
}
