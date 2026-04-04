import type { CreateManyMaterialsInput, InsertMaterial, Material, UpdateMaterialRequest } from "@shared/schema.ts";
import type { IErpRepository } from "../contracts/erp-repository.ts";
import { ConflictDomainError, NotFoundDomainError, ValidationDomainError } from "../../domain/errors/domain-error.ts";

function normalizeMaterialInput(input: InsertMaterial | UpdateMaterialRequest): InsertMaterial | UpdateMaterialRequest {
  const normalized = { ...input };
  if (normalized.name !== undefined) normalized.name = normalized.name.trim();

  if (normalized.stockQty !== undefined && Number(normalized.stockQty) < 0) {
    throw new ValidationDomainError("stockQty cannot be negative");
  }

  if (normalized.purchasePrice !== undefined && Number(normalized.purchasePrice) < 0) {
    throw new ValidationDomainError("purchasePrice cannot be negative");
  }

  if (normalized.category === "RAW_MATERIAL") {
    if (!normalized.pricePerSquareMeter || Number(normalized.pricePerSquareMeter) < 0) {
      throw new ValidationDomainError("pricePerSquareMeter is required for raw materials");
    }
  }

  return normalized;
}

export class ListMaterialsUseCase {
  constructor(private readonly repository: IErpRepository) {}

  execute(): Promise<Material[]> {
    return this.repository.getMaterials();
  }
}

export class GetMaterialUseCase {
  constructor(private readonly repository: IErpRepository) {}

  async execute(id: number): Promise<Material> {
    const material = await this.repository.getMaterial(id);
    if (!material) throw new NotFoundDomainError("Material not found");
    return material;
  }
}

export class CreateMaterialUseCase {
  constructor(private readonly repository: IErpRepository) {}

  async execute(input: InsertMaterial): Promise<Material> {
    const normalized = normalizeMaterialInput(input) as InsertMaterial;
    const existing = await this.repository.getMaterialByName(normalized.name);
    if (existing) {
      if (existing.isActive === 0) {
        return this.repository.updateMaterial(existing.id, { ...normalized, isActive: 1 });
      }
      throw new ConflictDomainError("Material name must be unique");
    }
    return this.repository.createMaterial(normalized);
  }
}

export class CreateManyMaterialsUseCase {
  constructor(private readonly repository: IErpRepository) {}

  async execute(input: CreateManyMaterialsInput): Promise<Material[]> {
    const normalizedItems = input.items.map((item) => normalizeMaterialInput(item) as InsertMaterial);
    const seenNames = new Set<string>();

    return this.repository.withTransaction(async (txRepository) => {
      const results: Material[] = [];

      for (const item of normalizedItems) {
        if (seenNames.has(item.name)) throw new ConflictDomainError("Material name must be unique");
        seenNames.add(item.name);

        const existing = await txRepository.getMaterialByName(item.name);
        if (!existing) {
          results.push(await txRepository.createMaterial(item));
          continue;
        }

        if (existing.isActive === 0) {
          results.push(await txRepository.updateMaterial(existing.id, { ...item, isActive: 1 }));
          continue;
        }

        throw new ConflictDomainError("Material name must be unique");
      }

      return results;
    });
  }
}

export class UpdateMaterialUseCase {
  constructor(private readonly repository: IErpRepository) {}

  async execute(id: number, input: UpdateMaterialRequest): Promise<Material> {
    const material = await this.repository.getMaterial(id);
    if (!material) throw new NotFoundDomainError("Material not found");

    const normalized = normalizeMaterialInput(input) as UpdateMaterialRequest;
    if (normalized.name && normalized.name !== material.name) {
      const existing = await this.repository.getMaterialByName(normalized.name);
      if (existing && existing.id !== id) {
        throw new ConflictDomainError("Material name must be unique");
      }
    }

    return this.repository.updateMaterial(id, normalized);
  }
}

export class DeleteMaterialUseCase {
  constructor(private readonly repository: IErpRepository) {}

  async execute(id: number): Promise<void> {
    const material = await this.repository.getMaterial(id);
    if (!material) throw new NotFoundDomainError("Material not found");
    await this.repository.deactivateMaterial(id);
  }
}
