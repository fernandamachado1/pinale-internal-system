import { InventoryMovement } from "../../domain/entities/inventory-movement";
import { Material } from "../../domain/entities/material";
import { NotFoundDomainError, ValidationDomainError } from "../../domain/errors/domain-error";
import type { IErpRepository } from "../contracts/erp-repository";

export interface AdjustMaterialStockInput {
  materialId: number;
  quantityChange: number;
  reason: string;
}

export interface AdjustMaterialStockOutput {
  materialId: number;
}

export class AdjustMaterialStockUseCase {
  constructor(private readonly repository: IErpRepository) {}

  async execute(input: AdjustMaterialStockInput): Promise<AdjustMaterialStockOutput> {
    return this.repository.withTransaction(async (txRepository) => {
      const materialRecord = await txRepository.getMaterial(input.materialId);
      if (!materialRecord) throw new NotFoundDomainError("Material not found");

      const material = new Material({
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
      });

      if (!material.stockTracked) {
        throw new ValidationDomainError(`Material ${materialRecord.name} does not use stock control`);
      }

      material.adjustStock(input.quantityChange);
      await txRepository.updateMaterialStockQty(material.id, material.toPersistence().stockQty);

      const movement = InventoryMovement.create({
        entityType: "MATERIAL",
        entityId: material.id,
        direction: input.quantityChange >= 0 ? "IN" : "OUT",
        qty: Math.abs(input.quantityChange),
        reason: "ADJUSTMENT",
        referenceType: "MANUAL",
        metadata: { reason: input.reason },
      });
      await txRepository.createInventoryMovement(movement.toData());

      return { materialId: material.id };
    });
  }
}
