import type { InsertSale } from "@shared/schema.ts";
import { InventoryMovement } from "../../domain/entities/inventory-movement.ts";
import { ProducedProductStock } from "../../domain/entities/produced-product-stock.ts";
import { SaleAggregate } from "../../domain/entities/sale.ts";
import { NotFoundDomainError, ValidationDomainError } from "../../domain/errors/domain-error.ts";
import type { ISalesRepository } from "../contracts/sales-repository.ts";

export interface UpdateSaleOutput {
  saleId: number;
}

export class UpdateSaleUseCase {
  constructor(private readonly repository: ISalesRepository) {}

  async execute(saleId: number, input: InsertSale): Promise<UpdateSaleOutput> {
    if (input.items.length < 1) throw new ValidationDomainError("Sale must have at least one item");

    return this.repository.withTransaction(async (txRepository) => {
      const existing = await txRepository.getSaleWithItems(saleId);
      if (!existing) throw new NotFoundDomainError("Sale not found");

      // Revert previous sale stock impact
      for (const item of existing.items) {
        const producedStockRecord = await txRepository.getProducedProductStockByProductId(item.productId);
        if (!producedStockRecord) {
          throw new NotFoundDomainError(`Produced stock for product ${item.productId} not found`);
        }

        const producedStock = new ProducedProductStock({
          productId: item.productId,
          stockQty: Number(producedStockRecord.stockQty),
        });
        const itemQty = Number(item.qty);
        producedStock.increase(itemQty);
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
            subtype: "SALE_EDIT_REVERT",
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          },
        });
        await txRepository.createInventoryMovement(movement.toData());
      }

      await txRepository.deleteSaleItemsBySaleId(saleId);

      const saleAggregate = new SaleAggregate(input.paymentMethod);
      const producedStocksMap = new Map<number, ProducedProductStock>();
      const normalizedItems: Array<{
        productId: number;
        qty: number;
        discountType: "PERCENT" | "AMOUNT";
        discountValue: number;
        unitPrice: number;
      }> = [];

      // Apply updated sale
      for (const item of input.items) {
        const productRecord = await txRepository.getProduct(item.productId);
        if (!productRecord) throw new NotFoundDomainError(`Product ${item.productId} not found`);

        const producedStockRecord = await txRepository.getProducedProductStockByProductId(item.productId);
        if (!producedStockRecord) throw new NotFoundDomainError(`Produced stock for product ${item.productId} not found`);

        const producedStock = new ProducedProductStock({
          productId: item.productId,
          stockQty: Number(producedStockRecord.stockQty),
        });

        producedStocksMap.set(item.productId, producedStock);

        const listPrice = Number(productRecord.price);
        const discountType = (item.discountType ?? "PERCENT") as "PERCENT" | "AMOUNT";
        const discountValue = Number(item.discountValue ?? 0);
        const unitPrice =
          discountType === "AMOUNT"
            ? Math.max(0, listPrice - Math.min(listPrice, Math.max(0, discountValue)))
            : listPrice * (1 - Math.min(100, Math.max(0, discountValue)) / 100);

        saleAggregate.addItem(item.productId, item.qty, unitPrice);
        normalizedItems.push({
          productId: item.productId,
          qty: item.qty,
          discountType,
          discountValue,
          unitPrice,
        });
      }

      for (const item of normalizedItems) {
        const producedStock = producedStocksMap.get(item.productId);
        if (!producedStock) continue;
        producedStock.decrease(item.qty);
        await txRepository.updateProducedProductStockQty(item.productId, producedStock.toPersistence().stockQty);
      }

      const totalAmount = saleAggregate.calculateTotalAmount();
      await txRepository.updateSale(saleId, {
        paymentMethod: input.paymentMethod,
        description: input.description ?? null,
        totalAmount: totalAmount.toFixed(2),
        salesChannel: input.salesChannel,
        soldAt: input.soldAt ?? null,
      });

      const createdItems = await txRepository.createSaleItems(
        saleId,
        normalizedItems.map((item) => ({
          productId: item.productId,
          qty: item.qty,
          discountType: item.discountType,
          discountValue: item.discountValue.toFixed(2),
          unitPrice: item.unitPrice.toFixed(2),
          totalPrice: (item.qty * item.unitPrice).toFixed(2),
        })),
      );

      for (const item of createdItems) {
        const movement = InventoryMovement.create({
          entityType: "PRODUCT",
          entityId: item.productId,
          direction: "OUT",
          qty: item.qty,
          reason: "SALE",
          referenceType: "SALE",
          referenceId: saleId,
          metadata: {
            subtype: "SALE_EDIT_APPLY",
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          },
        });
        await txRepository.createInventoryMovement(movement.toData());
      }

      return { saleId };
    });
  }
}
