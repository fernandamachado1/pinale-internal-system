import type { InsertSale } from "@shared/schema.ts";
import { InventoryMovement } from "../../domain/entities/inventory-movement.ts";
import { ProducedProductStock } from "../../domain/entities/produced-product-stock.ts";
import { SaleAggregate } from "../../domain/entities/sale.ts";
import { NotFoundDomainError, ValidationDomainError } from "../../domain/errors/domain-error.ts";
import type { ISalesRepository } from "../contracts/sales-repository.ts";

export interface CreateSaleOutput {
  saleId: number;
}

export async function createSaleTransaction(
  txRepository: ISalesRepository,
  input: InsertSale,
  options?: { originProductionOrderId?: number | null },
): Promise<CreateSaleOutput> {
  if (input.items.length < 1) throw new ValidationDomainError("Sale must have at least one item");
  const paymentMethod = (input.paymentMethod ?? "").toUpperCase();
  const installments = input.installments ?? null;
  if (paymentMethod === "CREDITO" && (!installments || installments < 1)) {
    throw new ValidationDomainError("installments is required for CREDITO");
  }

  if (options?.originProductionOrderId) {
    const existing = await txRepository.getSaleByOriginProductionOrderId(options.originProductionOrderId);
    if (existing) return { saleId: existing.id };
  }

  const saleAggregate = new SaleAggregate(input.paymentMethod);
  const producedStocksMap = new Map<number, ProducedProductStock>();
  const normalizedItems: Array<{
    productId: number;
    qty: number;
    discountType: "PERCENT" | "AMOUNT";
    discountValue: number;
    unitPrice: number;
  }> = [];

  for (const item of input.items) {
    const productRecord = await txRepository.getProduct(item.productId);
    if (!productRecord) throw new NotFoundDomainError(`Product ${item.productId} not found`);

    const producedStockRecord = await txRepository.getProducedProductStockByProductId(item.productId);
    if (!producedStockRecord) throw new NotFoundDomainError(`Produced stock for product ${item.productId} not found`);

    const producedStock = new ProducedProductStock({
      productId: item.productId,
      stockQty: Number(producedStockRecord.stockQty),
    });

    const productId = Number(productRecord.id);
    producedStocksMap.set(productId, producedStock);
    const listPrice = Number(productRecord.price);
    const discountType = (item.discountType ?? "PERCENT") as "PERCENT" | "AMOUNT";
    const discountValue = Number(item.discountValue ?? 0);
    const unitPrice =
      discountType === "AMOUNT"
        ? Math.max(0, listPrice - Math.min(listPrice, Math.max(0, discountValue)))
        : listPrice * (1 - Math.min(100, Math.max(0, discountValue)) / 100);

    saleAggregate.addItem(productId, item.qty, unitPrice);
    normalizedItems.push({
      productId,
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
  const createdSale = await txRepository.createSale({
    originProductionOrderId: options?.originProductionOrderId ?? null,
    paymentMethod: input.paymentMethod,
    installments: paymentMethod === "CREDITO" ? installments : null,
    description: input.description ?? null,
    totalAmount: totalAmount.toFixed(2),
    salesChannel: input.salesChannel,
    soldAt: input.soldAt ?? null,
  });

  const createdItems = await txRepository.createSaleItems(
    createdSale.id,
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
      referenceId: createdSale.id,
      metadata: {
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      },
    });
    await txRepository.createInventoryMovement(movement.toData());
  }

  return { saleId: createdSale.id };
}

export class CreateSaleUseCase {
  constructor(private readonly repository: ISalesRepository) {}

  async execute(input: InsertSale): Promise<CreateSaleOutput> {
    return this.repository.withTransaction(async (txRepository) => createSaleTransaction(txRepository, input));
  }
}
