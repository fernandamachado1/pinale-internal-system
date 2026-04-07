import type { IErpGateway } from "@/application/contracts/erp-gateway";
import type {
  CreateManyMaterialsInput,
  ConcludeProductionOrderInput,
  InsertMaterial,
  MoveProductionOrderInput,
  InsertProductionOrder,
  InsertSale,
  Material,
  MovementWithDetails,
  ProductWithBom,
  ProducedProductStockWithProduct,
  ProductionOrderWithProduct,
  PurchaseOrderWithItems,
  CreatePurchaseOrderInput,
  UpdatePurchaseOrderInput,
  ReceivePurchaseOrderInput,
  SaleListItem,
} from "@shared/schema";

export class GetMaterialsUseCase {
  constructor(private readonly gateway: IErpGateway) {}
  execute(): Promise<Material[]> {
    return this.gateway.getMaterials();
  }
}

export class CreateMaterialUseCase {
  constructor(private readonly gateway: IErpGateway) {}
  execute(data: InsertMaterial): Promise<Material> {
    return this.gateway.createMaterial(data);
  }
}

export class CreateManyMaterialsUseCase {
  constructor(private readonly gateway: IErpGateway) {}
  execute(data: CreateManyMaterialsInput): Promise<Material[]> {
    return this.gateway.createManyMaterials(data);
  }
}

export class UpdateMaterialUseCase {
  constructor(private readonly gateway: IErpGateway) {}
  execute(id: number, data: Partial<InsertMaterial>): Promise<Material> {
    return this.gateway.updateMaterial(id, data);
  }
}

export class DeleteMaterialUseCase {
  constructor(private readonly gateway: IErpGateway) {}
  execute(id: number): Promise<void> {
    return this.gateway.deleteMaterial(id);
  }
}

export class GetProductsUseCase {
  constructor(private readonly gateway: IErpGateway) {}
  execute(): Promise<ProductWithBom[]> {
    return this.gateway.getProducts();
  }
}

export class GetProducedProductStocksUseCase {
  constructor(private readonly gateway: IErpGateway) {}
  execute(): Promise<ProducedProductStockWithProduct[]> {
    return this.gateway.getProducedProductStocks();
  }
}

export class CreateProductUseCase {
  constructor(private readonly gateway: IErpGateway) {}
  execute(data: unknown): Promise<ProductWithBom> {
    return this.gateway.createProduct(data);
  }
}

export class UpdateProductUseCase {
  constructor(private readonly gateway: IErpGateway) {}
  execute(id: number, data: unknown): Promise<ProductWithBom> {
    return this.gateway.updateProduct(id, data);
  }
}

export class DeleteProductUseCase {
  constructor(private readonly gateway: IErpGateway) {}
  execute(id: number): Promise<void> {
    return this.gateway.deleteProduct(id);
  }
}

export class GetProductionOrdersUseCase {
  constructor(private readonly gateway: IErpGateway) {}
  execute(): Promise<ProductionOrderWithProduct[]> {
    return this.gateway.getProductionOrders();
  }
}

export class CreateProductionOrderUseCase {
  constructor(private readonly gateway: IErpGateway) {}
  execute(data: InsertProductionOrder): Promise<ProductionOrderWithProduct> {
    return this.gateway.createProductionOrder(data);
  }
}

export class ConcludeProductionOrderUseCase {
  constructor(private readonly gateway: IErpGateway) {}
  execute(id: number, data: ConcludeProductionOrderInput): Promise<ProductionOrderWithProduct> {
    return this.gateway.concludeProductionOrder(id, data);
  }
}

export class MoveProductionOrderUseCase {
  constructor(private readonly gateway: IErpGateway) {}
  execute(id: number, data: MoveProductionOrderInput): Promise<ProductionOrderWithProduct> {
    return this.gateway.moveProductionOrder(id, data);
  }
}

export class GetSalesUseCase {
  constructor(private readonly gateway: IErpGateway) {}
  execute(): Promise<SaleListItem[]> {
    return this.gateway.getSales();
  }
}

export class CreateSaleUseCase {
  constructor(private readonly gateway: IErpGateway) {}
  execute(data: InsertSale): Promise<{ sale: unknown; items: unknown[] }> {
    return this.gateway.createSale(data);
  }
}

export class DeleteSaleUseCase {
  constructor(private readonly gateway: IErpGateway) {}
  execute(id: number): Promise<void> {
    return this.gateway.deleteSale(id);
  }
}

export class GetPurchaseOrdersUseCase {
  constructor(private readonly gateway: IErpGateway) {}
  execute(): Promise<PurchaseOrderWithItems[]> {
    return this.gateway.getPurchaseOrders();
  }
}

export class CreatePurchaseOrderUseCase {
  constructor(private readonly gateway: IErpGateway) {}
  execute(data: CreatePurchaseOrderInput): Promise<PurchaseOrderWithItems> {
    return this.gateway.createPurchaseOrder(data);
  }
}

export class UpdatePurchaseOrderUseCase {
  constructor(private readonly gateway: IErpGateway) {}
  execute(id: number, data: UpdatePurchaseOrderInput): Promise<PurchaseOrderWithItems> {
    return this.gateway.updatePurchaseOrder(id, data);
  }
}

export class ReceivePurchaseOrderUseCase {
  constructor(private readonly gateway: IErpGateway) {}
  execute(id: number, data: ReceivePurchaseOrderInput): Promise<PurchaseOrderWithItems> {
    return this.gateway.receivePurchaseOrder(id, data);
  }
}

export class CancelPurchaseOrderUseCase {
  constructor(private readonly gateway: IErpGateway) {}
  execute(id: number): Promise<void> {
    return this.gateway.cancelPurchaseOrder(id);
  }
}

export class GetInventoryMovementsUseCase {
  constructor(private readonly gateway: IErpGateway) {}
  execute(): Promise<MovementWithDetails[]> {
    return this.gateway.getInventoryMovements();
  }
}

export class GetDashboardReportUseCase {
  constructor(private readonly gateway: IErpGateway) {}
  execute(from?: Date, to?: Date) {
    return this.gateway.getDashboardReport(from, to);
  }
}
