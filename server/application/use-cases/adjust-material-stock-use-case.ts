import { InventoryMovement } from "../../domain/entities/inventory-movement";
import { Material } from "../../domain/entities/material";
import { NotFoundDomainError } from "../../domain/errors/domain-error";
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
        unit: materialRecord.unit,
        policy: materialRecord.policy,
        stockQty: materialRecord.stockQty === null ? null : Number(materialRecord.stockQty),
        group: materialRecord.group,
        isActive: materialRecord.isActive === 1,
      });

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
      await txRepository.createInventoryMovement(movement.toPersistence());

      return { materialId: material.id };
    });
  }
}
