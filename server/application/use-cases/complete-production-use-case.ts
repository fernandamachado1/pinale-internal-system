import type { ConcludeProductionOrderInput } from "@shared/schema.ts";
import { InventoryMovement } from "../../domain/entities/inventory-movement.ts";
import { Material } from "../../domain/entities/material.ts";
import { ProducedProductStock } from "../../domain/entities/produced-product-stock.ts";
import { ProductionOrder } from "../../domain/entities/production-order.ts";
import { InvalidOperationDomainError, NotFoundDomainError } from "../../domain/errors/domain-error.ts";
import { TechnicalSpecItem } from "../../domain/entities/technical-spec-item.ts";
import type { IErpRepository } from "../contracts/erp-repository.ts";

export interface ConcludeProductionOrderOutput {
  orderId: number;
}

export class CompleteProductionUseCase {
  constructor(private readonly repository: IErpRepository) {}

  async execute(orderId: number, _input: ConcludeProductionOrderInput): Promise<ConcludeProductionOrderOutput> {
    return this.repository.withTransaction(async (txRepository) => {
      const orderRecord = await txRepository.getProductionOrder(orderId);
      if (!orderRecord) throw new NotFoundDomainError("Production order not found");

      if (orderRecord.status === "DONE") {
        return { orderId };
      }
      if (orderRecord.status !== "IN_PROGRESS") {
        throw new InvalidOperationDomainError("Only in-progress production orders can be concluded");
      }

      const productRecord = await txRepository.getProduct(orderRecord.productId);
      if (!productRecord) throw new NotFoundDomainError("Product not found");

      const bom = orderRecord.bomId ? await txRepository.getBomById(orderRecord.bomId) : null;
      if (bom && bom.items.length > 0) {
        const specs = bom.items.map(
          (item) =>
            new TechnicalSpecItem({
              materialId: item.materialId,
              qtyPerUnit: Number(item.qtyPerUnit),
            }),
        );

        const materialsMap = new Map<number, Material>();
        const consumedSpecs: Array<{ materialId: number; qty: number }> = [];
        for (const spec of specs) {
          const materialRecord = await txRepository.getMaterial(spec.materialId);
          if (!materialRecord) continue;
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

        for (const spec of specs) {
          const material = materialsMap.get(spec.materialId);
          if (!material) continue;
          if (!material.stockTracked) continue;
          const consumption = spec.calculateFixedConsumption(orderRecord.qtyPlanned);
          const availableStock = Number(material.toPersistence().stockQty);
          if (availableStock < consumption) continue;
          material.consumeStock(consumption);
          consumedSpecs.push({ materialId: spec.materialId, qty: consumption });
        }

        for (const material of Array.from(materialsMap.values())) {
          if (!material.stockTracked) continue;
          await txRepository.updateMaterialStockQty(material.id, material.toPersistence().stockQty);
        }

        for (const consumed of consumedSpecs) {
          const material = materialsMap.get(consumed.materialId);
          if (!material?.stockTracked) continue;
          const movement = InventoryMovement.create({
            entityType: "MATERIAL",
            entityId: consumed.materialId,
            direction: "OUT",
            qty: consumed.qty,
            reason: "PRODUCTION_CONSUMPTION",
            referenceType: "OP",
            referenceId: orderId,
          });
          await txRepository.createInventoryMovement(movement.toData());
        }
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
