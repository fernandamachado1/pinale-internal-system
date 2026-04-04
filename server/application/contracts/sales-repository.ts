import type { InventoryMovement, Product, ProducedProductStockWithProduct, Sale, SaleItem, SaleListItem } from "@shared/schema.ts";

export interface CreateInventoryMovementData {
  entityType: "PRODUCT" | "MATERIAL";
  entityId?: number;
  direction: "IN" | "OUT";
  qty: number;
  reason: "PRODUCTION_CONSUMPTION" | "PRODUCTION_OUTPUT" | "SALE" | "PURCHASE" | "ADJUSTMENT";
  referenceType: "OP" | "SALE" | "MANUAL";
  referenceId?: number;
  metadata?: Record<string, unknown>;
}

export interface ISalesRepository {
  getProduct(id: number): Promise<Product | undefined>;
  getProducedProductStockByProductId(productId: number): Promise<ProducedProductStockWithProduct | undefined>;
  updateProducedProductStockQty(productId: number, stockQty: number): Promise<void>;

  createSale(data: { paymentMethod: string; totalAmount: string }): Promise<Sale>;
  createSaleItems(
    saleId: number,
    items: Array<{ productId: number; qty: number; unitPrice: string; totalPrice: string }>,
  ): Promise<SaleItem[]>;
  getSales(): Promise<SaleListItem[]>;
  getSaleWithItems(id: number): Promise<{ sale: Sale; items: Array<SaleItem & { product: Product }> } | undefined>;

  createInventoryMovement(movement: CreateInventoryMovementData): Promise<InventoryMovement>;

  withTransaction<T>(callback: (repository: ISalesRepository) => Promise<T>): Promise<T>;
}
