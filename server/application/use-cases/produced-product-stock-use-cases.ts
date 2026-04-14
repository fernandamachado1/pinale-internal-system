import type {
  AdjustProducedStockInput,
  ProducedProductStockSummary,
  ProducedProductStockWithProduct,
  RegisterInitialProducedStockInput,
} from "@shared/schema.ts";
import { InventoryMovement } from "../../domain/entities/inventory-movement.ts";
import { ProducedProductStock } from "../../domain/entities/produced-product-stock.ts";
import { InvalidOperationDomainError, NotFoundDomainError, ValidationDomainError } from "../../domain/errors/domain-error.ts";
import type { IErpRepository } from "../contracts/erp-repository.ts";

export class ListProducedProductStocksUseCase {
  constructor(private readonly repository: IErpRepository) {}

  execute(): Promise<ProducedProductStockWithProduct[]> {
    return this.repository.getProducedProductStocks();
  }
}

export class ListProducedProductStockSummaryUseCase {
  constructor(private readonly repository: IErpRepository) {}

  execute(): Promise<ProducedProductStockSummary[]> {
    return this.repository.getProducedProductStockSummary();
  }
}

export class RegisterInitialProducedStockUseCase {
  constructor(private readonly repository: IErpRepository) {}

  async execute(input: RegisterInitialProducedStockInput): Promise<ProducedProductStockWithProduct> {
    if (input.qty <= 0) throw new ValidationDomainError("qty must be greater than zero");

    return this.repository.withTransaction(async (txRepository) => {
      const product = await txRepository.getProduct(input.productId);
      if (!product) throw new NotFoundDomainError("Product not found");

      const stockRecord = await txRepository.getProducedProductStockByProductId(input.productId);
      const stockQty = stockRecord
        ? Number(stockRecord.stockQty)
        : Number((await txRepository.createProducedProductStock(input.productId)).stockQty);

      if (stockRecord && Number(stockRecord.stockQty) > 0) {
        throw new InvalidOperationDomainError("Product already has stock. Use adjustment instead of initial entry");
      }

      const producedStock = new ProducedProductStock({
        productId: input.productId,
        stockQty,
      });
      producedStock.increase(input.qty);

      await txRepository.updateProducedProductStockQty(input.productId, producedStock.toPersistence().stockQty);
      await txRepository.createInventoryMovement(
        InventoryMovement.create({
          entityType: "PRODUCT",
          entityId: input.productId,
          direction: "IN",
          qty: input.qty,
          reason: "ADJUSTMENT",
          referenceType: "MANUAL",
          metadata: {
            subtype: "INITIAL_ENTRY",
            note: input.note ?? null,
          },
        }).toData(),
      );

      const updated = await txRepository.getProducedProductStockByProductId(input.productId);
      if (!updated) throw new NotFoundDomainError("Produced stock not found after initial entry");
      return updated;
    });
  }
}

export class AdjustProducedStockUseCase {
  constructor(private readonly repository: IErpRepository) {}

  async execute(input: AdjustProducedStockInput): Promise<ProducedProductStockWithProduct> {
    if (input.qtyChange === 0) throw new ValidationDomainError("qtyChange must not be zero");

    return this.repository.withTransaction(async (txRepository) => {
      const product = await txRepository.getProduct(input.productId);
      if (!product) throw new NotFoundDomainError("Product not found");

      const stockRecord = await txRepository.getProducedProductStockByProductId(input.productId);
      const stockQty = stockRecord
        ? Number(stockRecord.stockQty)
        : Number((await txRepository.createProducedProductStock(input.productId)).stockQty);

      const producedStock = new ProducedProductStock({
        productId: input.productId,
        stockQty,
      });
      const absQty = Math.abs(input.qtyChange);

      if (input.qtyChange > 0) {
        producedStock.increase(absQty);
      } else {
        producedStock.decrease(absQty);
      }

      await txRepository.updateProducedProductStockQty(input.productId, producedStock.toPersistence().stockQty);
      await txRepository.createInventoryMovement(
        InventoryMovement.create({
          entityType: "PRODUCT",
          entityId: input.productId,
          direction: input.qtyChange > 0 ? "IN" : "OUT",
          qty: absQty,
          reason: "ADJUSTMENT",
          referenceType: "MANUAL",
          metadata: {
            subtype: "ADJUSTMENT",
            note: input.note ?? null,
          },
        }).toData(),
      );

      const updated = await txRepository.getProducedProductStockByProductId(input.productId);
      if (!updated) throw new NotFoundDomainError("Produced stock not found after adjustment");
      return updated;
    });
  }
}
