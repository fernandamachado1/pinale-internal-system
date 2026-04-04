import type { InsertProductionOrder, MoveProductionOrderInput, ProductionOrderWithProduct } from "@shared/schema.ts";
import type { IErpRepository } from "../contracts/erp-repository.ts";
import { InvalidOperationDomainError, NotFoundDomainError, ValidationDomainError } from "../../domain/errors/domain-error.ts";
import { InventoryMovement } from "../../domain/entities/inventory-movement.ts";
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

    const product = await this.repository.getProduct(input.productId);
    if (!product) throw new NotFoundDomainError("Product not found");

    return this.repository.withTransaction(async (txRepository) => {
      const bom = await txRepository.getActiveBomByProductId(input.productId);
      if (!bom) throw new ValidationDomainError("Product must have one active BOM before creating production order");

      const created = await txRepository.createProductionOrder(input);

      const order = await txRepository.getProductionOrder(created.id);
      if (!order) throw new NotFoundDomainError("Production order not found after creation");
      return order;
    });
  }
}

export class MoveProductionOrderUseCase {
  constructor(private readonly repository: IErpRepository) {}

  async execute(id: number, input: MoveProductionOrderInput): Promise<ProductionOrderWithProduct> {
    const order = await this.repository.getProductionOrder(id);
    if (!order) throw new NotFoundDomainError("Production order not found");
    if (order.status === "DONE") throw new InvalidOperationDomainError("Done production orders cannot be moved");
    if (order.status === "IN_PROGRESS" && input.status === "BACKLOG") {
      throw new InvalidOperationDomainError("Production orders already in progress cannot return to backlog");
    }

    const orders = await this.repository.getProductionOrders();
    const destinationIds = orders
      .filter((entry) => entry.status === input.status && entry.id !== id)
      .map((entry) => entry.id);

    const expectedIds = new Set([...destinationIds, id]);
    if (expectedIds.size !== input.orderedIds.length || input.orderedIds.some((orderedId) => !expectedIds.has(orderedId))) {
      throw new ValidationDomainError("orderedIds must contain the full destination column ordering");
    }

    return this.repository.withTransaction(async (txRepository) => {
      if (order.status === "BACKLOG" && input.status === "IN_PROGRESS") {
        const product = await txRepository.getProduct(order.productId);
        if (!product) throw new NotFoundDomainError("Product not found");

        const bom = await txRepository.getActiveBomByProductId(order.productId);
        if (!bom || bom.items.length === 0) {
          throw new ValidationDomainError("Product must have one active BOM before starting production");
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
              stockQty: Number(materialRecord.stockQty),
              category: materialRecord.category,
              purchasePrice: Number(materialRecord.purchasePrice),
              pricePerSquareMeter: materialRecord.pricePerSquareMeter ? Number(materialRecord.pricePerSquareMeter) : null,
              isActive: materialRecord.isActive === 1,
            }),
          );
        }

        for (const spec of specs) {
          const material = materialsMap.get(spec.materialId);
          if (!material) continue;
          material.consumeStock(spec.calculateFixedConsumption(order.qtyPlanned));
        }

        for (const material of Array.from(materialsMap.values())) {
          await txRepository.updateMaterialStockQty(material.id, material.toPersistence().stockQty);
        }

        for (const spec of specs) {
          const movement = InventoryMovement.create({
            entityType: "MATERIAL",
            entityId: spec.materialId,
            direction: "OUT",
            qty: spec.calculateFixedConsumption(order.qtyPlanned),
            reason: "PRODUCTION_CONSUMPTION",
            referenceType: "OP",
            referenceId: id,
          });
          await txRepository.createInventoryMovement(movement.toData());
        }
      }

      await txRepository.moveProductionOrder(id, input);
      const movedOrder = await txRepository.getProductionOrder(id);
      if (!movedOrder) throw new NotFoundDomainError("Production order not found after move");
      return movedOrder;
    });
  }
}
