import type { InsertMaterial, Material, UpdateMaterialRequest } from "@shared/schema";
import type { IErpRepository } from "../contracts/erp-repository";
import { ConflictDomainError, NotFoundDomainError, ValidationDomainError } from "../../domain/errors/domain-error";

function normalizeMaterialInput(input: InsertMaterial | UpdateMaterialRequest): InsertMaterial | UpdateMaterialRequest {
  const normalized = { ...input };
  if (normalized.name !== undefined) normalized.name = normalized.name.trim();
  if (normalized.unit !== undefined) normalized.unit = normalized.unit.trim();

  const hasPolicy = normalized.policy !== undefined;
  const hasStockQty = normalized.stockQty !== undefined;

  if (hasPolicy || hasStockQty) {
    const policy = normalized.policy;
    const stockQty = normalized.stockQty;

    if (policy === "CONSUMPTION_TRACKED") {
      normalized.stockQty = null;
    }

    if (policy === "STOCK_CONTROLLED" && stockQty === null) {
      throw new ValidationDomainError("stockQty is required for STOCK_CONTROLLED material");
    }

    if (stockQty !== undefined && stockQty !== null && Number(stockQty) < 0) {
      throw new ValidationDomainError("stockQty cannot be negative");
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
    if (existing) throw new ConflictDomainError("Material name must be unique");
    return this.repository.createMaterial(normalized);
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

    const nextPolicy = normalized.policy ?? material.policy;
    const nextStockQty = normalized.stockQty ?? material.stockQty;

    if (nextPolicy === "STOCK_CONTROLLED" && (nextStockQty === null || nextStockQty === undefined)) {
      throw new ValidationDomainError("stockQty is required for STOCK_CONTROLLED material");
    }

    if (nextPolicy === "CONSUMPTION_TRACKED" && normalized.stockQty === undefined) {
      normalized.stockQty = null;
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
