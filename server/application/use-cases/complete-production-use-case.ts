import type { ConcludeProductionOrderInput } from "@shared/schema.ts";
import { InventoryMovement } from "../../domain/entities/inventory-movement.ts";
import { ProducedProductStock } from "../../domain/entities/produced-product-stock.ts";
import { ProductionOrder } from "../../domain/entities/production-order.ts";
import { InvalidOperationDomainError, NotFoundDomainError, ValidationDomainError } from "../../domain/errors/domain-error.ts";
import { Material } from "../../domain/entities/material.ts";
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

      const bom = orderRecord.bomId
        ? await txRepository.getBomById(orderRecord.bomId)
        : await txRepository.getActiveBomByProductId(productRecord.id);
      if (!bom || bom.items.length === 0) {
        throw new ValidationDomainError("Product must have one active BOM before concluding production");
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
        material.consumeReserved(spec.calculateFixedConsumption(orderRecord.qtyPlanned));
      }

      for (const material of Array.from(materialsMap.values())) {
        await txRepository.updateMaterialQuantities(material.id, material.toPersistence());
      }

      for (const spec of specs) {
        const movement = InventoryMovement.create({
          entityType: "MATERIAL",
          entityId: spec.materialId,
          direction: "OUT",
          qty: spec.calculateFixedConsumption(orderRecord.qtyPlanned),
          reason: "PRODUCTION_CONSUMPTION",
          referenceType: "OP",
          referenceId: orderId,
        });
        await txRepository.createInventoryMovement(movement.toData());
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
