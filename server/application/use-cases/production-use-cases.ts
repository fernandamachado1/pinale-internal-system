import type {
  InsertProductionOrder,
  MoveProductionOrderInput,
  ProductionOrderWithProduct,
  UpdateProductionOrderInput,
  UpdateProductionOrderFinancialsInput,
} from "@shared/schema.ts";
import type { IErpRepository } from "../contracts/erp-repository.ts";
import { InvalidOperationDomainError, NotFoundDomainError, ValidationDomainError } from "../../domain/errors/domain-error.ts";
import { Material } from "../../domain/entities/material.ts";
import { TechnicalSpecItem } from "../../domain/entities/technical-spec-item.ts";

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

    return this.repository.withTransaction(async (txRepository) => {
      const bom = await txRepository.getActiveBomByProductId(input.productId);
      if (!bom) throw new ValidationDomainError("Product must have one active BOM before creating production order");

      const created = await txRepository.createProductionOrder({ ...input, bomId: bom.id });

      const order = await txRepository.getProductionOrder(created.id);
      if (!order) throw new NotFoundDomainError("Production order not found after creation");
      return order;
    });
  }
}

export class UpdateProductionOrderUseCase {
  constructor(private readonly repository: IErpRepository) {}

  async execute(id: number, input: UpdateProductionOrderInput): Promise<ProductionOrderWithProduct> {
    const order = await this.repository.getProductionOrder(id);
    if (!order) throw new NotFoundDomainError("Production order not found");
    if (order.status === "DONE") {
      throw new InvalidOperationDomainError("Done production orders cannot be edited");
    }

    const mutatingCoreFields = input.productId !== undefined || input.qtyPlanned !== undefined || input.orderType !== undefined;
    let productForValidation = order.product;

    if (mutatingCoreFields) {
      if (order.status !== "BACKLOG") {
        throw new InvalidOperationDomainError("Only backlog production orders can change product, quantity or type");
      }
      const nextProductId = input.productId ?? order.productId;
      const product = await this.repository.getProduct(nextProductId);
      if (!product) throw new NotFoundDomainError("Product not found");
      const bom = await this.repository.getActiveBomByProductId(nextProductId);
      if (!bom) {
        throw new ValidationDomainError("Product must have one active BOM before editing production order");
      }
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

    await this.repository.updateProductionOrder(id, input);
    const updated = await this.repository.getProductionOrder(id);
    if (!updated) throw new NotFoundDomainError("Production order not found after update");
    return updated;
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

    await this.repository.updateProductionOrderFinancials(id, input);
    const updated = await this.repository.getProductionOrder(id);
    if (!updated) throw new NotFoundDomainError("Production order not found after update");
    return updated;
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
    if (order.status === "DONE") throw new InvalidOperationDomainError("Done production orders cannot be moved");

    const orders = await this.repository.getProductionOrders();
    const destinationIds = orders
      .filter((entry) => entry.status === input.status && entry.id !== id)
      .map((entry) => entry.id);

    const expectedIds = new Set([...destinationIds, id]);
    if (expectedIds.size !== input.orderedIds.length || input.orderedIds.some((orderedId) => !expectedIds.has(orderedId))) {
      throw new ValidationDomainError("orderedIds must contain the full destination column ordering");
    }

    return this.repository.withTransaction(async (txRepository) => {
      if (order.status !== input.status) {
        const product = await txRepository.getProduct(order.productId);
        if (!product) throw new NotFoundDomainError("Product not found");

        const bom = order.bomId ? await txRepository.getBomById(order.bomId) : await txRepository.getActiveBomByProductId(order.productId);
        if (!bom || bom.items.length === 0) {
          throw new ValidationDomainError("Product must have one active BOM before moving production order");
        }

        const specs = bom.items.map(
          (item) =>
            new TechnicalSpecItem({
              materialId: item.materialId,
              qtyPerUnit: Number(item.qtyPerUnit),
            }),
        );

        const materialsMap = new Map<number, Material>();

        for (const spec of specs) {
          const materialRecord = await txRepository.getMaterial(spec.materialId);
          if (!materialRecord) throw new NotFoundDomainError(`Material ${spec.materialId} not found`);

          materialsMap.set(
            spec.materialId,
            new Material({
              id: materialRecord.id,
              name: materialRecord.name,
              unitOfMeasure: materialRecord.unitOfMeasure,
              stockTracked: materialRecord.stockTracked !== false,
              stockQty: Number(materialRecord.stockQty),
              reservedQty: Number(materialRecord.reservedQty ?? 0),
              category: materialRecord.category,
              purchasePrice: Number(materialRecord.purchasePrice),
              pricePerSquareMeter: materialRecord.pricePerSquareMeter ? Number(materialRecord.pricePerSquareMeter) : null,
              isActive: materialRecord.isActive === 1,
            }),
          );
        }

        if (order.status === "BACKLOG" && input.status === "IN_PROGRESS") {
          for (const spec of specs) {
            const material = materialsMap.get(spec.materialId);
            if (!material) continue;
            if (!material.stockTracked) continue;
            material.reserve(spec.calculateFixedConsumption(order.qtyPlanned));
          }

          for (const material of Array.from(materialsMap.values())) {
            if (!material.stockTracked) continue;
            await txRepository.updateMaterialReservedQty(material.id, material.toPersistence().reservedQty);
          }
        }

        if (order.status === "IN_PROGRESS" && input.status === "BACKLOG") {
          for (const spec of specs) {
            const material = materialsMap.get(spec.materialId);
            if (!material) continue;
            if (!material.stockTracked) continue;
            material.releaseReservation(spec.calculateFixedConsumption(order.qtyPlanned));
          }

          for (const material of Array.from(materialsMap.values())) {
            if (!material.stockTracked) continue;
            await txRepository.updateMaterialReservedQty(material.id, material.toPersistence().reservedQty);
          }
        }
      }

      await txRepository.moveProductionOrder(id, input);
      const movedOrder = await txRepository.getProductionOrder(id);
      if (!movedOrder) throw new NotFoundDomainError("Production order not found after move");
      return movedOrder;
    });
  }
}
