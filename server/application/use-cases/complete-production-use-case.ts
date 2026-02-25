import type { ConcludeProductionOrderInput } from "@shared/schema";
import { InventoryMovement } from "../../domain/entities/inventory-movement";
import { Material } from "../../domain/entities/material";
import { Product } from "../../domain/entities/product";
import { ProductionOrder } from "../../domain/entities/production-order";
import { TechnicalSpecItem } from "../../domain/entities/technical-spec-item";
import { NotFoundDomainError, ValidationDomainError } from "../../domain/errors/domain-error";
import type { IErpRepository } from "../contracts/erp-repository";

export interface ConcludeProductionOrderOutput {
  orderId: number;
}

export class CompleteProductionUseCase {
  constructor(private readonly repository: IErpRepository) {}

  async execute(orderId: number, input: ConcludeProductionOrderInput): Promise<ConcludeProductionOrderOutput> {
    return this.repository.withTransaction(async (txRepository) => {
      const consumptions = input.consumptions ?? [];
      const orderRecord = await txRepository.getProductionOrder(orderId);
      if (!orderRecord) throw new NotFoundDomainError("Production order not found");

      const productRecord = await txRepository.getProduct(orderRecord.productId);
      if (!productRecord) throw new NotFoundDomainError("Product not found");

      const bom = await txRepository.getActiveBomByProductId(productRecord.id);
      if (!bom || bom.items.length === 0) {
        throw new ValidationDomainError("Product must have one active BOM before concluding production");
      }

      const order = new ProductionOrder({
        id: orderRecord.id,
        productId: orderRecord.productId,
        qtyPlanned: orderRecord.qtyPlanned,
        status: orderRecord.status,
        createdAt: new Date(orderRecord.createdAt),
        completedAt: orderRecord.completedAt,
      });
      order.ensureOpen();

      const product = new Product({
        id: productRecord.id,
        name: productRecord.name,
        price: Number(productRecord.price),
        stockQty: productRecord.stockQty,
        isActive: productRecord.isActive === 1,
      });

      const specs = bom.items.map((item) => {
        if (item.itemType === "FIXED_MATERIAL") {
          return new TechnicalSpecItem({
            itemType: "FIXED_MATERIAL",
            materialId: item.materialId!,
            qtyPerUnit: Number(item.qtyPerUnit),
          });
        }

        return new TechnicalSpecItem({
          itemType: "VARIABLE_MATERIAL",
          materialGroup: item.materialGroup!,
          plannedQtyPerUnit: Number(item.plannedQtyPerUnit),
          unit: item.unit!,
        });
      });
      product.setBomItems(specs);

      const fixedMaterialsMap = new Map<number, Material>();
      const requiredVariableGroups = new Set<string>();

      for (const spec of specs) {
        if (spec.itemType === "FIXED_MATERIAL") {
          const materialId = spec.materialId!;
          const materialRecord = await txRepository.getMaterial(materialId);
          if (!materialRecord) throw new NotFoundDomainError(`Material ${materialId} not found`);

          fixedMaterialsMap.set(
            materialId,
            new Material({
              id: materialRecord.id,
              name: materialRecord.name,
              unit: materialRecord.unit,
              policy: materialRecord.policy,
              stockQty: materialRecord.stockQty === null ? null : Number(materialRecord.stockQty),
              group: materialRecord.group,
              isActive: materialRecord.isActive === 1,
            }),
          );
        }

        if (spec.itemType === "VARIABLE_MATERIAL") {
          requiredVariableGroups.add(spec.materialGroup!);
        }
      }

      if (requiredVariableGroups.size > 0) {
        for (const group of Array.from(requiredVariableGroups)) {
          const hasAny = consumptions.some((consumption) => consumption.materialGroup === group);
          if (!hasAny) {
            throw new ValidationDomainError(`Consumption for group ${group} is required to conclude this production order`);
          }
        }
      }

      for (const consumption of consumptions) {
        if (Number(consumption.quantityUsed) <= 0) {
          throw new ValidationDomainError("Variable consumption quantityUsed must be greater than zero");
        }
        if (Number(consumption.thicknessMm) <= 0) {
          throw new ValidationDomainError("thicknessMm is required and must be greater than zero");
        }
      }

      for (const spec of specs) {
        if (spec.itemType !== "FIXED_MATERIAL") continue;
        const material = fixedMaterialsMap.get(spec.materialId!);
        if (!material) continue;

        const requiredQty = spec.calculateFixedConsumption(orderRecord.qtyPlanned);
        material.consumeStock(requiredQty);
      }

      for (const material of Array.from(fixedMaterialsMap.values())) {
        await txRepository.updateMaterialStockQty(material.id, material.toPersistence().stockQty);
      }

      product.increaseStock(orderRecord.qtyPlanned);
      await txRepository.updateProductStockQty(product.id, product.toPersistence().stockQty);

      await txRepository.createProductionVariableConsumptions(orderId, consumptions);

      for (const spec of specs) {
        if (spec.itemType !== "FIXED_MATERIAL") continue;
        const movement = InventoryMovement.create({
          entityType: "MATERIAL",
          entityId: spec.materialId,
          direction: "OUT",
          qty: spec.calculateFixedConsumption(orderRecord.qtyPlanned),
          reason: "PRODUCTION_CONSUMPTION",
          referenceType: "OP",
          referenceId: orderId,
        });
        await txRepository.createInventoryMovement(movement.toPersistence());
      }

      for (const consumption of consumptions) {
        const movement = InventoryMovement.create({
          entityType: "MATERIAL_GROUP",
          group: consumption.materialGroup,
          direction: "OUT",
          qty: Number(consumption.quantityUsed),
          reason: "PRODUCTION_CONSUMPTION",
          referenceType: "OP",
          referenceId: orderId,
          metadata: {
            thicknessMm: consumption.thicknessMm,
            panelsCount: consumption.panelsCount ?? null,
            note: consumption.note ?? null,
          },
        });
        await txRepository.createInventoryMovement(movement.toPersistence());
      }

      const productMovement = InventoryMovement.create({
        entityType: "PRODUCT",
        entityId: product.id,
        direction: "IN",
        qty: orderRecord.qtyPlanned,
        reason: "PRODUCTION_OUTPUT",
        referenceType: "OP",
        referenceId: orderId,
      });
      await txRepository.createInventoryMovement(productMovement.toPersistence());

      const completedAt = order.markDone();
      await txRepository.markProductionOrderDone(orderId, completedAt);

      return { orderId };
    });
  }
}
