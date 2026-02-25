import type { InsertSale } from "@shared/schema";
import { InventoryMovement } from "../../domain/entities/inventory-movement";
import { Product } from "../../domain/entities/product";
import { SaleAggregate } from "../../domain/entities/sale";
import { NotFoundDomainError, ValidationDomainError } from "../../domain/errors/domain-error";
import type { IErpRepository } from "../contracts/erp-repository";

export interface CreateSaleOutput {
  saleId: number;
}

export class CreateSaleUseCase {
  constructor(private readonly repository: IErpRepository) {}

  async execute(input: InsertSale): Promise<CreateSaleOutput> {
    if (input.items.length < 1) throw new ValidationDomainError("Sale must have at least one item");

    return this.repository.withTransaction(async (txRepository) => {
      const saleAggregate = new SaleAggregate(input.paymentMethod);
      const productsMap = new Map<number, Product>();

      for (const item of input.items) {
        const productRecord = await txRepository.getProduct(item.productId);
        if (!productRecord) throw new NotFoundDomainError(`Product ${item.productId} not found`);

        const product = new Product({
          id: productRecord.id,
          name: productRecord.name,
          price: Number(productRecord.price),
          stockQty: productRecord.stockQty,
          isActive: productRecord.isActive === 1,
        });

        productsMap.set(product.id, product);
        saleAggregate.addItem(product.id, item.qty, Number(productRecord.price));
      }

      for (const item of saleAggregate.getItems()) {
        const product = productsMap.get(item.productId);
        if (!product) continue;
        product.decreaseStock(item.qty);
      }

      for (const product of Array.from(productsMap.values())) {
        await txRepository.updateProductStockQty(product.id, product.toPersistence().stockQty);
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
        await txRepository.createInventoryMovement(movement.toPersistence());
      }

      return { saleId: createdSale.id };
    });
  }
}
