import type {
  InsertSale,
  InsertProductionOrder,
  MoveProductionOrderInput,
  ProductionOrderWithProduct,
  UpdateProductionOrderInput,
  UpdateProductionOrderFinancialsInput,
} from "@shared/schema.ts";
import type { IErpRepository } from "../contracts/erp-repository.ts";
import { InvalidOperationDomainError, NotFoundDomainError, ValidationDomainError } from "../../domain/errors/domain-error.ts";
import { createSaleTransaction } from "./create-sale-use-case.ts";

function getEncomendaSaleInput(order: ProductionOrderWithProduct): InsertSale {
  return {
    paymentMethod: "ENCOMENDA",
    installments: null,
    description: `Encomenda #${order.id}`,
    salesChannel: order.salesChannel,
    soldAt: new Date().toISOString(),
    items: [
      {
        productId: order.productId,
        qty: order.qtyPlanned,
        discountType: "PERCENT",
        discountValue: 0,
      },
    ],
  };
}

export async function ensureEncomendaSale(order: ProductionOrderWithProduct, repository: IErpRepository): Promise<void> {
  if (order.orderType !== "ENCOMENDA") return;

  const totalDue = Number(order.product.price ?? 0) * Number(order.qtyPlanned ?? 0);
  const amountPaid = Number(order.amountPaid ?? 0);
  if (totalDue <= 0 || amountPaid + 1e-9 < totalDue) return;

  const producedStock = await repository.getProducedProductStockByProductId(order.productId);
  if (!producedStock || Number(producedStock.stockQty) < Number(order.qtyPlanned ?? 0)) return;

  const existingSale = await repository.getSaleByOriginProductionOrderId(order.id);
  if (existingSale) return;

  await createSaleTransaction(repository, getEncomendaSaleInput(order), {
    originProductionOrderId: order.id,
  });
}

export class ListProductionOrdersUseCase {
  constructor(private readonly repository: IErpRepository) {}

  execute(): Promise<ProductionOrderWithProduct[]> {
    return this.repository.getProductionOrders();
  }
}

export class GetProductionOrderUseCase {
  constructor(private readonly repository: IErpRepository) {}

  async execute(id: number): Promise<ProductionOrderWithProduct> {
    const order = await this.repository.getProductionOrder(id);
    if (!order) throw new NotFoundDomainError("Production order not found");
    return order;
  }
}

export class CreateProductionOrderUseCase {
  constructor(private readonly repository: IErpRepository) {}

  async execute(input: InsertProductionOrder): Promise<ProductionOrderWithProduct> {
    if (input.qtyPlanned <= 0) throw new ValidationDomainError("qtyPlanned must be greater than zero");
    if (input.orderType === "NORMAL" && Number(input.amountPaid ?? 0) > 0) {
      throw new ValidationDomainError("Normal production orders do not use payment fields");
    }

    const product = await this.repository.getProduct(input.productId);
    if (!product) throw new NotFoundDomainError("Product not found");
    const totalDue = Number(product.price ?? 0) * Number(input.qtyPlanned ?? 0);
    if (input.orderType === "ENCOMENDA" && Number(input.amountPaid ?? 0) - totalDue > 1e-9) {
      throw new ValidationDomainError("amountPaid cannot be greater than the total product value");
    }

    return this.repository.withTransaction(async (txRepository) => {
      const activeBom = await txRepository.getActiveBomByProductId(input.productId);
      const created = await txRepository.createProductionOrder({
        ...input,
        ...(activeBom ? { bomId: activeBom.id } : {}),
      });

      const order = await txRepository.getProductionOrder(created.id);
      if (!order) throw new NotFoundDomainError("Production order not found after creation");
      await ensureEncomendaSale(order, txRepository);
      return order;
    });
  }
}

export class UpdateProductionOrderUseCase {
  constructor(private readonly repository: IErpRepository) {}

  async execute(id: number, input: UpdateProductionOrderInput): Promise<ProductionOrderWithProduct> {
    const order = await this.repository.getProductionOrder(id);
    if (!order) throw new NotFoundDomainError("Production order not found");

    const mutatingCoreFields = input.productId !== undefined || input.qtyPlanned !== undefined || input.orderType !== undefined;
    let productForValidation = order.product;

    if (mutatingCoreFields) {
      if (order.status === "IN_PROGRESS") {
        throw new InvalidOperationDomainError("Only backlog or completed production orders can change product, quantity or type");
      }
      const nextProductId = input.productId ?? order.productId;
      const product = await this.repository.getProduct(nextProductId);
      if (!product) throw new NotFoundDomainError("Product not found");
      productForValidation = product;
    }

    const nextProductId = input.productId ?? order.productId;
    const nextQtyPlanned = input.qtyPlanned ?? order.qtyPlanned;
    const nextOrderType = input.orderType ?? order.orderType;
    const nextAmountPaid = input.amountPaid ?? Number(order.amountPaid ?? 0);

    if (nextQtyPlanned <= 0) {
      throw new ValidationDomainError("qtyPlanned must be greater than zero");
    }

    const totalDue = Number(productForValidation.price ?? 0) * nextQtyPlanned;
    if (nextOrderType === "NORMAL" && nextAmountPaid > 0) {
      throw new InvalidOperationDomainError("Normal production orders do not use payment fields");
    }
    if (nextOrderType === "ENCOMENDA" && nextAmountPaid - totalDue > 1e-9) {
      throw new ValidationDomainError("amountPaid cannot be greater than the total product value");
    }

    return this.repository.withTransaction(async (txRepository) => {
      await txRepository.updateProductionOrder(id, input);
      const updated = await txRepository.getProductionOrder(id);
      if (!updated) throw new NotFoundDomainError("Production order not found after update");
      await ensureEncomendaSale(updated, txRepository);
      return updated;
    });
  }
}

export class UpdateProductionOrderFinancialsUseCase {
  constructor(private readonly repository: IErpRepository) {}

  async execute(id: number, input: UpdateProductionOrderFinancialsInput): Promise<ProductionOrderWithProduct> {
    const order = await this.repository.getProductionOrder(id);
    if (!order) throw new NotFoundDomainError("Production order not found");
    if (order.orderType !== "ENCOMENDA") {
      throw new InvalidOperationDomainError("Only encomenda production orders can update financials");
    }

    return this.repository.withTransaction(async (txRepository) => {
      await txRepository.updateProductionOrderFinancials(id, input);
      const updated = await txRepository.getProductionOrder(id);
      if (!updated) throw new NotFoundDomainError("Production order not found after update");
      await ensureEncomendaSale(updated, txRepository);
      return updated;
    });
  }
}

export class DeleteProductionOrderUseCase {
  constructor(private readonly repository: IErpRepository) {}

  async execute(id: number): Promise<void> {
    const order = await this.repository.getProductionOrder(id);
    if (!order) throw new NotFoundDomainError("Production order not found");
    if (order.status !== "BACKLOG") {
      throw new InvalidOperationDomainError("Only backlog production orders can be deleted");
    }
    if (Number(order.amountPaid ?? 0) > 0) {
      throw new InvalidOperationDomainError("Production orders with received signal cannot be deleted");
    }
    await this.repository.deleteProductionOrder(id);
  }
}

export class MarkProductionOrderDeliveredUseCase {
  constructor(private readonly repository: IErpRepository) {}

  async execute(id: number, deliveredAt = new Date()): Promise<ProductionOrderWithProduct> {
    const order = await this.repository.getProductionOrder(id);
    if (!order) throw new NotFoundDomainError("Production order not found");
    if (order.status !== "DONE") {
      throw new InvalidOperationDomainError("Only completed production orders can be marked as delivered");
    }
    if (order.deliveredAt) {
      return order;
    }

    await this.repository.markProductionOrderDelivered(id, deliveredAt);
    const updated = await this.repository.getProductionOrder(id);
    if (!updated) throw new NotFoundDomainError("Production order not found after delivery update");
    return updated;
  }
}

export class MoveProductionOrderUseCase {
  constructor(private readonly repository: IErpRepository) {}

  async execute(id: number, input: MoveProductionOrderInput): Promise<ProductionOrderWithProduct> {
    const order = await this.repository.getProductionOrder(id);
    if (!order) throw new NotFoundDomainError("Production order not found");

    const orders = await this.repository.getProductionOrders();
    const destinationIds = orders
      .filter((entry) => entry.status === input.status && entry.id !== id)
      .map((entry) => entry.id);

    const expectedIds = new Set([...destinationIds, id]);
    if (expectedIds.size !== input.orderedIds.length || input.orderedIds.some((orderedId) => !expectedIds.has(orderedId))) {
      throw new ValidationDomainError("orderedIds must contain the full destination column ordering");
    }

    return this.repository.withTransaction(async (txRepository) => {
      // Status changes no longer depend on BOM presence.

      await txRepository.moveProductionOrder(id, input);
      const movedOrder = await txRepository.getProductionOrder(id);
      if (!movedOrder) throw new NotFoundDomainError("Production order not found after move");
      return movedOrder;
    });
  }
}
