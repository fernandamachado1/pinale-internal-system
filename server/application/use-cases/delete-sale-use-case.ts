import { InventoryMovement } from "../../domain/entities/inventory-movement.ts";
import { ProducedProductStock } from "../../domain/entities/produced-product-stock.ts";
import { NotFoundDomainError } from "../../domain/errors/domain-error.ts";
import type { ISalesRepository } from "../contracts/sales-repository.ts";

export class DeleteSaleUseCase {
  constructor(private readonly repository: ISalesRepository) {}

  execute(saleId: number): Promise<void> {
    return this.repository.withTransaction(async (txRepository) => {
      const saleWithItems = await txRepository.getSaleWithItems(saleId);
      if (!saleWithItems) return;

      for (const item of saleWithItems.items) {
        const producedStockRecord = await txRepository.getProducedProductStockByProductId(item.productId);
        if (!producedStockRecord) {
          throw new NotFoundDomainError(`Produced stock for product ${item.productId} not found`);
        }

        const producedStock = new ProducedProductStock({
          productId: item.productId,
          stockQty: producedStockRecord.stockQty,
        });
        producedStock.increase(item.qty);
        await txRepository.updateProducedProductStockQty(item.productId, producedStock.toPersistence().stockQty);

        const movement = InventoryMovement.create({
          entityType: "PRODUCT",
          entityId: item.productId,
          direction: "IN",
          qty: item.qty,
          reason: "ADJUSTMENT",
          referenceType: "SALE",
          referenceId: saleId,
          metadata: {
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          },
        });
        await txRepository.createInventoryMovement(movement.toData());
      }

      await txRepository.deleteSaleItemsBySaleId(saleId);
      await txRepository.deleteSale(saleId);
    });
  }
}
