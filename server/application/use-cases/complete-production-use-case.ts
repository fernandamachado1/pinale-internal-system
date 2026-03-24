import type { ConcludeProductionOrderInput } from "@shared/schema";
import { InventoryMovement } from "../../domain/entities/inventory-movement";
import { ProducedProductStock } from "../../domain/entities/produced-product-stock";
import { ProductionOrder } from "../../domain/entities/production-order";
import { NotFoundDomainError, ValidationDomainError } from "../../domain/errors/domain-error";
import type { IErpRepository } from "../contracts/erp-repository";

export interface ConcludeProductionOrderOutput {
  orderId: number;
}

export class CompleteProductionUseCase {
  constructor(private readonly repository: IErpRepository) {}

  async execute(orderId: number, _input: ConcludeProductionOrderInput): Promise<ConcludeProductionOrderOutput> {
    return this.repository.withTransaction(async (txRepository) => {
      const orderRecord = await txRepository.getProductionOrder(orderId);
      if (!orderRecord) throw new NotFoundDomainError("Production order not found");

      const productRecord = await txRepository.getProduct(orderRecord.productId);
      if (!productRecord) throw new NotFoundDomainError("Product not found");

      const bom = await txRepository.getActiveBomByProductId(productRecord.id);
      if (!bom || bom.items.length === 0) {
        throw new ValidationDomainError("Product must have one active BOM before concluding production");
      }

      const producedStockRecord = await txRepository.getProducedProductStockByProductId(productRecord.id);
      const producedStockQty =
        producedStockRecord?.stockQty ?? (await txRepository.createProducedProductStock(productRecord.id)).stockQty;

      const order = new ProductionOrder({
        id: orderRecord.id,
        productId: orderRecord.productId,
        qtyPlanned: orderRecord.qtyPlanned,
        status: orderRecord.status,
        sortOrder: orderRecord.sortOrder,
        createdAt: new Date(orderRecord.createdAt),
        completedAt: orderRecord.completedAt,
      });
      order.ensureCompletable();

      const producedStock = new ProducedProductStock({
        productId: productRecord.id,
        stockQty: producedStockQty,
      });

      producedStock.increase(orderRecord.qtyPlanned);
      await txRepository.updateProducedProductStockQty(productRecord.id, producedStock.toPersistence().stockQty);

      const productMovement = InventoryMovement.create({
        entityType: "PRODUCT",
        entityId: productRecord.id,
        direction: "IN",
        qty: orderRecord.qtyPlanned,
        reason: "PRODUCTION_OUTPUT",
        referenceType: "OP",
        referenceId: orderId,
      });
      await txRepository.createInventoryMovement(productMovement.toData());

      const completedAt = order.markDone();
      await txRepository.markProductionOrderDone(orderId, completedAt);

      return { orderId };
    });
  }
}
