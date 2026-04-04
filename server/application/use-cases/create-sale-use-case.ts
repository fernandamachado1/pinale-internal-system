import type { InsertSale } from "@shared/schema.ts";
import { InventoryMovement } from "../../domain/entities/inventory-movement.ts";
import { Product } from "../../domain/entities/product.ts";
import { ProducedProductStock } from "../../domain/entities/produced-product-stock.ts";
import { SaleAggregate } from "../../domain/entities/sale.ts";
import { NotFoundDomainError, ValidationDomainError } from "../../domain/errors/domain-error.ts";
import type { ISalesRepository } from "../contracts/sales-repository.ts";

export interface CreateSaleOutput {
  saleId: number;
}

export class CreateSaleUseCase {
  constructor(private readonly repository: ISalesRepository) {}

  async execute(input: InsertSale): Promise<CreateSaleOutput> {
    if (input.items.length < 1) throw new ValidationDomainError("Sale must have at least one item");

    return this.repository.withTransaction(async (txRepository) => {
      const saleAggregate = new SaleAggregate(input.paymentMethod);
      const productsMap = new Map<number, Product>();
      const producedStocksMap = new Map<number, ProducedProductStock>();

      for (const item of input.items) {
        const productRecord = await txRepository.getProduct(item.productId);
        if (!productRecord) throw new NotFoundDomainError(`Product ${item.productId} not found`);

        const producedStockRecord = await txRepository.getProducedProductStockByProductId(item.productId);
        if (!producedStockRecord) throw new NotFoundDomainError(`Produced stock for product ${item.productId} not found`);

        const product = new Product({
          id: productRecord.id,
          name: productRecord.name,
          price: Number(productRecord.price),
          isActive: productRecord.isActive === 1,
        });
        const producedStock = new ProducedProductStock({
          productId: item.productId,
          stockQty: producedStockRecord.stockQty,
        });

        productsMap.set(product.id, product);
        producedStocksMap.set(product.id, producedStock);
        saleAggregate.addItem(product.id, item.qty, Number(productRecord.price));
      }

      for (const item of saleAggregate.getItems()) {
        const producedStock = producedStocksMap.get(item.productId);
        if (!producedStock) continue;
        producedStock.decrease(item.qty);
      }

      for (const producedStock of Array.from(producedStocksMap.values())) {
        await txRepository.updateProducedProductStockQty(producedStock.productId, producedStock.toPersistence().stockQty);
      }

      const totalAmount = saleAggregate.calculateTotalAmount();
      const createdSale = await txRepository.createSale({
        paymentMethod: input.paymentMethod,
        totalAmount: totalAmount.toFixed(2),
      });

      const createdItems = await txRepository.createSaleItems(
        createdSale.id,
        saleAggregate.getItems().map((item) => ({
          productId: item.productId,
          qty: item.qty,
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
          referenceId: createdSale.id,
          metadata: {
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          },
        });
        await txRepository.createInventoryMovement(movement.toData());
      }

      return { saleId: createdSale.id };
    });
  }
}
